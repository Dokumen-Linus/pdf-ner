from ..domain.services import ListenerRegistry
from .providers import (
    AzureBlobListener,
    GmailListener,
    GoogleCloudStorageListener,
    GoogleDriveListener,
    OneDriveListener,
    OutlookEmailListener,
    S3Listener,
)

registry = ListenerRegistry()
registry.register("outlook_email", OutlookEmailListener())
registry.register("gmail", GmailListener())
registry.register("aws_s3", S3Listener())
registry.register("google_drive", GoogleDriveListener())
registry.register("onedrive", OneDriveListener())
registry.register("azure_blob", AzureBlobListener())
registry.register("gcs", GoogleCloudStorageListener())
