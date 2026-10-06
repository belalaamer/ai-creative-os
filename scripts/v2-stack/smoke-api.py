"""Verify the deployed Ads API without calling ad or paid-provider mutations.

Credentials are read from SMOKE_EMAIL/SMOKE_PASSWORD, never CLI arguments.
Login creates a session; use a dedicated test account on a live deployment.
"""
import argparse
import json
import os
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


def request(base, path, *, method="GET", payload=None, headers=None):
    data = json.dumps(payload).encode() if payload is not None else None
    req = Request(base + path, data=data, method=method,
                  headers={"Content-Type": "application/json", **(headers or {})})
    try:
        response = urlopen(req, timeout=10)
    except HTTPError as error:
        response = error
    with response:
        raw = response.read()
        try:
            body = json.loads(raw)
        except (ValueError, UnicodeDecodeError):
            body = None
        return response.status, response.headers, body


def verify(base, origin, email, password):
    status, _, body = request(base, "/health")
    assert status == 200 and body == {"status": "healthy"}, "API health failed"
    for path in ("/api/v1/auth/me", "/api/v1/dashboard/stats", "/api/v1/facebook/oauth/start"):
        status, _, _ = request(base, path)
        assert status in (401, 403), "Protected endpoint accepted anonymous access: " + path
    cors = {"Origin": origin, "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "authorization,content-type"}
    status, headers, _ = request(base, "/api/v1/auth/login/json", method="OPTIONS", headers=cors)
    assert status == 200 and headers.get("Access-Control-Allow-Origin") == origin, "Frontend CORS failed"
    status, headers, _ = request(base, "/api/v1/auth/login/json", method="OPTIONS",
                                 headers={**cors, "Origin": "https://untrusted.invalid"})
    assert status == 400 and not headers.get("Access-Control-Allow-Origin"), "Untrusted CORS origin accepted"
    status, _, body = request(base, "/api/v1/auth/login/json", method="POST",
                              payload={"email": email, "password": password})
    assert status == 200 and isinstance(body, dict) and body.get("access_token"), "Test account login failed"
    auth = {"Authorization": "Bearer " + body["access_token"], "Origin": origin}
    status, headers, body = request(base, "/api/v1/auth/me", headers=auth)
    assert status == 200 and body.get("email") == email, "Authenticated identity failed"
    assert headers.get("Access-Control-Allow-Origin") == origin, "Authenticated CORS failed"
    status, _, body = request(base, "/api/v1/dashboard/stats", headers=auth)
    assert status == 200 and isinstance(body, dict) and "brands_count" in body, "Database-backed dashboard failed"
    print("PASS: health, anonymous guards, CORS, login, identity, database-backed dashboard")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", required=True, help="API origin, without /api/v1")
    parser.add_argument("--origin", default="https://ai-creative-os-v2-ads.pages.dev")
    parser.add_argument("--wait-seconds", type=int, default=0)
    args = parser.parse_args()
    email, password = os.getenv("SMOKE_EMAIL"), os.getenv("SMOKE_PASSWORD")
    if not email or not password:
        parser.error("SMOKE_EMAIL and SMOKE_PASSWORD are required")
    base = args.base_url.rstrip("/")
    deadline = time.monotonic() + args.wait_seconds
    while True:
        try:
            status, _, body = request(base, "/health")
            if status == 200 and body == {"status": "healthy"}:
                break
        except (URLError, TimeoutError):
            pass
        if time.monotonic() >= deadline:
            raise SystemExit("API did not become healthy before the deadline")
        time.sleep(1)
    try:
        verify(base, args.origin, email, password)
    except (AssertionError, URLError, TimeoutError) as error:
        # Do not print response bodies, tokens, URLs with credentials, or passwords.
        raise SystemExit(str(error) if isinstance(error, AssertionError) else "API request failed")


if __name__ == "__main__":
    main()
