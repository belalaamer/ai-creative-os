"""Exercise the deploy image against disposable PostgreSQL, without provider keys."""
import argparse
import base64
import json
import os
import runpy
from pathlib import Path
import secrets
import subprocess
import tempfile
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


def docker(*args):
    return subprocess.check_output(["docker", *args], text=True).strip()


def wait_for(check, description, timeout=180):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            if check():
                return
        except (subprocess.CalledProcessError, URLError, OSError):
            pass
        time.sleep(2)
    raise RuntimeError(f"Timed out waiting for {description}")


def request(base, path, *, data=None, token=None, method=None, headers=None):
    headers = dict(headers or {})
    if data is not None:
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = Request(base + path, data=json.dumps(data).encode() if data is not None else None,
                  headers=headers, method=method)
    try:
        with urlopen(req, timeout=10) as response:
            body = response.read()
            return response.status, response.headers, json.loads(body) if body else None
    except HTTPError as error:
        # Do not print response bodies: auth responses can contain tokens.
        return error.code, error.headers, None


def verify_api(base, email, password):
    contract = runpy.run_path(str(Path(__file__).resolve().parents[2] / "scripts/v2-stack/smoke-api.py"))
    contract["verify"](base, "https://ai-creative-os-v2-ads.pages.dev", email, password)
    assert request(base, "/health")[0] == 200, "Health endpoint failed"
    assert request(base, "/api/v1/auth/me")[0] == 401, "Anonymous auth gate failed"
    status, _, login = request(base, "/api/v1/auth/login/json",
                               data={"email": email, "password": password})
    assert status == 200 and login.get("access_token"), "Seeded admin cannot log in"
    status, _, user = request(base, "/api/v1/auth/me", token=login["access_token"])
    assert status == 200 and user["email"] == email and user["is_superuser"], "Admin identity failed"
    origin = "https://ai-creative-os-v2-ads.pages.dev"
    status, headers, _ = request(base, "/api/v1/auth/login/json", method="OPTIONS", headers={
        "Origin": origin, "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
    })
    assert status == 200 and headers.get("Access-Control-Allow-Origin") == origin, "Ads CORS failed"


def main(image):
    suffix = secrets.token_hex(5)
    network, database, api = [f"creative-os-smoke-{suffix}-{name}" for name in ("net", "db", "api")]
    # Percent-encoded password deliberately exercises the Alembic URL patch.
    email, password = "smoke@example.com", secrets.token_urlsafe(24)
    try:
        docker("network", "create", network)
        docker("run", "-d", "--name", database, "--network", network,
               "-e", "POSTGRES_USER=smoke", "-e", "POSTGRES_DB=smoke",
               "-e", "POSTGRES_PASSWORD=smoke@percent%word", "postgres:16-alpine")
        wait_for(lambda: docker("exec", database, "pg_isready", "-U", "smoke", "-d", "smoke"), "PostgreSQL")
        with tempfile.TemporaryDirectory() as folder:
            env = Path(folder) / "runtime.env"
            env.write_text("\n".join([
                f"DATABASE_URL=postgresql://smoke:smoke%40percent%25word@{database}:5432/smoke",
                f"SECRET_KEY={secrets.token_urlsafe(32)}",
                # A Fernet key is URL-safe base64 encoding of 32 random bytes.
                f"OAUTH_TOKEN_ENCRYPTION_KEY={base64.urlsafe_b64encode(os.urandom(32)).decode()}",
                f"ADMIN_EMAIL={email}", f"ADMIN_PASSWORD={password}",
                "ALLOWED_ORIGINS=https://ai-creative-os-v2-ads.pages.dev",
                "FRONTEND_URL=https://ai-creative-os-v2-ads.pages.dev", "PORT=8000",
            ]) + "\n")
            env.chmod(0o600)
            docker("run", "-d", "--name", api, "--network", network,
                   "--env-file", str(env), "-p", "127.0.0.1::8000", image)

        def base_url():
            return "http://" + docker("port", api, "8000/tcp").splitlines()[0]

        def ready():
            return request(base_url(), "/health")[0] == 200

        def counts():
            return docker("exec", database, "psql", "-U", "smoke", "-d", "smoke", "-At", "-c",
                          "SELECT (SELECT count(*) FROM users), (SELECT count(*) FROM roles), "
                          "(SELECT count(*) FROM permissions), (SELECT version_num FROM alembic_version);")

        wait_for(ready, "API migrations and startup")
        verify_api(base_url(), email, password)
        before = counts()
        assert before.startswith("1|4|17|"), "Fresh database seeding failed"
        docker("restart", api)
        wait_for(ready, "API restart")
        verify_api(base_url(), email, password)
        assert counts() == before, "Restart duplicated users, roles or permissions"
        print("PASS: fresh migrations, encoded database password, admin login, auth gate, CORS, restart.")
    finally:
        for container in (api, database):
            subprocess.run(["docker", "rm", "-f", container], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        subprocess.run(["docker", "network", "rm", network], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("image", help="Locally loaded Creative OS API Docker image")
    main(parser.parse_args().image)
