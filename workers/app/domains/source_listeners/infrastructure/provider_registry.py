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
registry.register("outlook", OutlookEmailListener())
registry.register("outlook_email", OutlookEmailListener())
registry.register("gmail", GmailListener())
registry.register("external_s3", S3Listener())
registry.register("aws_s3", S3Listener())
registry.register("gdrive", GoogleDriveListener())
registry.register("google_drive", GoogleDriveListener())
registry.register("onedrive", OneDriveListener())
registry.register("az_blob", AzureBlobListener())
registry.register("azure_blob", AzureBlobListener())
registry.register("gcs", GoogleCloudStorageListener())
