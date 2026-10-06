"""Run inside the Vercel image; exercise actual handlers with a fake R2 client."""
import asyncio
from io import BytesIO
from types import SimpleNamespace
from unittest.mock import Mock, patch

from starlette.datastructures import UploadFile, Headers
from app.api.v1 import uploads, templates, generated_ads


async def verify():
    storage = Mock()
    database = Mock()
    uploads._s3_client = storage
    file = UploadFile(filename="test.png", file=BytesIO(b"test-image"),
                      headers=Headers({"content-type": "image/png"}))
    result = await templates.upload_winning_ad(images=[file], db=database, current_user=None)
    assert result['ads'][0].image_url.startswith('https://media.example.com/'), 'Template used ephemeral disk'
    assert storage.put_object.call_args.kwargs['Body'] == b'test-image'

    class Client:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            pass

        async def get(self, *args, **kwargs):
            return SimpleNamespace(content=b'generated-image', raise_for_status=lambda: None)

    with patch.object(generated_ads.httpx, 'AsyncClient', Client):
        url = await generated_ads.download_and_save_image('https://provider.example.com/image.png')
    assert url.startswith('https://media.example.com/'), 'Generated image used ephemeral disk'
    assert storage.put_object.call_args.kwargs['Body'] == b'generated-image'
    assert storage.put_object.call_count == 2
    print('PASS: template and generated-image handlers persist to R2 without provider calls')


asyncio.run(verify())
