"""Keep Nalarin media in R2 instead of the stateless Vercel filesystem."""
from pathlib import Path
import sys


def replace_once(path, old, new):
    source = path.read_text()
    if new in source:
        return
    if source.count(old) != 1:
        raise RuntimeError(f"Pinned upstream storage contract changed: {path.name}")
    path.write_text(source.replace(old, new, 1))


def patch(root):
    api = Path(root) / "backend/app/api/v1"
    generated = api / "generated_ads.py"
    replace_once(generated, '''            file_path = UPLOAD_DIR / filename

            # Save image
            with open(file_path, "wb") as f:
                f.write(response.content)

            # Return local URL
            return f"/uploads/{filename}"''', '''            from app.api.v1.uploads import upload_to_r2
            return await upload_to_r2(response.content, filename, "image/png")''')
    templates = api / "templates.py"
    replace_once(templates, '''        file_path = UPLOAD_DIR / filename
        
        # Save file
        with file_path.open("wb") as buffer:
            shutil.copyfileobj(image.file, buffer)''', '''        from app.api.v1.uploads import upload_to_r2
        media_url = await upload_to_r2(
            await image.read(), filename, image.content_type or "application/octet-stream"
        )''')
    replace_once(templates, '            image_url=f"/uploads/{filename}",',
                 '            image_url=media_url,')


if __name__ == "__main__":
    patch(sys.argv[1])
