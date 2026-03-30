import anyio


async def get_object_bytes(s3_client, bucket: str, key: str) -> bytes:
    """Download an object from S3 and return its bytes."""

    def _download():
        response = s3_client.get_object(Bucket=bucket, Key=key)
        return response["Body"].read()

    return await anyio.to_thread.run_sync(_download)


async def put_object_bytes(s3_client, bucket: str, key: str, data: bytes) -> None:
    """Upload bytes to S3."""

    def _upload():
        s3_client.put_object(Bucket=bucket, Key=key, Body=data)

    await anyio.to_thread.run_sync(_upload)
