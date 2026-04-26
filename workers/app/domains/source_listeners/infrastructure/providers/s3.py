from __future__ import annotations

import anyio
import boto3

from ...application.schemas import ListenerEventPayload, ListenerProvisioningPayload
from .common import empty_event, require_config


class S3Listener:
    """Configure S3 bucket notifications using config-provided AWS credentials."""

    async def create(self, connection: dict) -> ListenerProvisioningPayload:
        config = dict(connection.get("config") or {})
        bucket = require_config(config, "bucket")
        notification_id = config.get("notification_id", str(connection["id"]))
        events = config.get("events", ["s3:ObjectCreated:*"])
        target = self._notification_target(config, notification_id, events)

        client = self._client(config)

        def _put_notification() -> None:
            existing = client.get_bucket_notification_configuration(Bucket=bucket)
            existing.pop("ResponseMetadata", None)
            key = next(iter(target))
            values = [item for item in existing.get(key, []) if item.get("Id") != notification_id]
            existing[key] = values + target[key]
            client.put_bucket_notification_configuration(
                Bucket=bucket,
                NotificationConfiguration=existing,
            )

        await anyio.to_thread.run_sync(_put_notification)
        return ListenerProvisioningPayload(
            provider_subscription_id=notification_id,
            provider_payload={
                "bucket": bucket,
                "notification_id": notification_id,
                "target_type": next(iter(target)),
            },
        )

    async def renew(self, subscription: dict) -> ListenerProvisioningPayload:
        return ListenerProvisioningPayload(
            provider_subscription_id=subscription.get("provider_subscription_id"),
            provider_payload=dict(subscription.get("provider_payload") or {}),
        )

    async def disable(self, subscription: dict) -> None:
        payload = dict(subscription.get("provider_payload") or {})
        config = {**payload, **dict(subscription.get("config") or {})}
        bucket = require_config(config, "bucket")
        notification_id = require_config(subscription, "provider_subscription_id")
        target_type = config.get("target_type")
        client = self._client(config)

        def _remove_notification() -> None:
            existing = client.get_bucket_notification_configuration(Bucket=bucket)
            existing.pop("ResponseMetadata", None)
            if isinstance(target_type, str) and target_type in existing:
                existing[target_type] = [
                    item
                    for item in existing.get(target_type, [])
                    if item.get("Id") != notification_id
                ]
            client.put_bucket_notification_configuration(
                Bucket=bucket,
                NotificationConfiguration=existing,
            )

        await anyio.to_thread.run_sync(_remove_notification)

    async def normalize_event(
        self, subscription: dict, event_payload: dict
    ) -> ListenerEventPayload:
        return empty_event(subscription["id"], event_payload)

    @staticmethod
    def _client(config: dict):
        kwargs = {
            "aws_access_key_id": config.get("access_key_id"),
            "aws_secret_access_key": config.get("secret_access_key"),
            "region_name": config.get("region"),
        }
        if config.get("endpoint_url"):
            kwargs["endpoint_url"] = config["endpoint_url"]
        return boto3.client("s3", **kwargs)

    @staticmethod
    def _notification_target(config: dict, notification_id: str, events: list[str]) -> dict:
        target: dict
        if config.get("queue_arn"):
            target = {"QueueConfigurations": [{"QueueArn": config["queue_arn"]}]}
        elif config.get("topic_arn"):
            target = {"TopicConfigurations": [{"TopicArn": config["topic_arn"]}]}
        elif config.get("lambda_function_arn"):
            target = {
                "LambdaFunctionConfigurations": [
                    {"LambdaFunctionArn": config["lambda_function_arn"]}
                ]
            }
        else:
            raise ValueError(
                "S3 listener config requires queue_arn, topic_arn, or lambda_function_arn"
            )

        item = next(iter(target.values()))[0]
        item["Id"] = notification_id
        item["Events"] = events
        filters = []
        if config.get("prefix"):
            filters.append({"Name": "prefix", "Value": config["prefix"]})
        if config.get("suffix"):
            filters.append({"Name": "suffix", "Value": config["suffix"]})
        if filters:
            item["Filter"] = {"Key": {"FilterRules": filters}}
        return target
