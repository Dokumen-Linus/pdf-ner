import asyncpg

from ..domain.services import WatcherRegistry
from .materializers import PostgresDocumentMaterializer
from .providers import GoogleDriveWatcher, OneDriveWatcher


def build_registry(conn: asyncpg.Connection) -> WatcherRegistry:
    materializer = PostgresDocumentMaterializer(conn)
    registry = WatcherRegistry()
    registry.register("gdrive", GoogleDriveWatcher(materializer=materializer))
    registry.register("google_drive", GoogleDriveWatcher(materializer=materializer))
    registry.register("onedrive", OneDriveWatcher(materializer=materializer))
    return registry


registry = WatcherRegistry()
registry.register("gdrive", GoogleDriveWatcher())
registry.register("google_drive", GoogleDriveWatcher())
registry.register("onedrive", OneDriveWatcher())
