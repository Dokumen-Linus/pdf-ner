from app.core.messaging import celery_client


class TestCeleryClient:
    def test_client_is_configured(self):
        assert celery_client.conf.broker_url is not None

