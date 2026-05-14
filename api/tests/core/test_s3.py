from unittest.mock import MagicMock

import pytest

from app.integrations.s3 import get_object_bytes, put_object_bytes


class TestGetObjectBytes:
    @pytest.mark.anyio
    async def test_downloads_object_body(self):
        s3 = MagicMock()
        s3.get_object.return_value = {"Body": MagicMock(read=lambda: b"pdf-content")}

        result = await get_object_bytes(s3, "my-bucket", "path/to/file.pdf")

        assert result == b"pdf-content"
        s3.get_object.assert_called_once_with(Bucket="my-bucket", Key="path/to/file.pdf")


class TestPutObjectBytes:
    @pytest.mark.anyio
    async def test_uploads_object(self):
        s3 = MagicMock()

        await put_object_bytes(s3, "my-bucket", "path/to/file.pdf", b"content")

        s3.put_object.assert_called_once_with(
            Bucket="my-bucket", Key="path/to/file.pdf", Body=b"content"
        )
