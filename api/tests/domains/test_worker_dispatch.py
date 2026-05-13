from unittest.mock import AsyncMock
from uuid import uuid4

from pydantic import ValidationError
import pytest

from app.domains.worker_dispatch import events
from app.domains.worker_dispatch.schemas import (
    ExtractTextBatchRequest,
    OcrEvaluationPdfsRequest,
    OcrEvaluationRequest,
    OptimizePromptRequest,
)


class TestOptimizePromptRequest:
    def test_defaults_match_workers_context_engineering_command(self):
        request = OptimizePromptRequest(
            project_id=uuid4(),
            template_id=1,
            labeled_pdfs=[uuid4()],
        )

        assert request.max_cost_usd == 1.0
        assert request.beta == 1.0
        assert request.ner_chat_model == "gpt-5.4-mini"
        assert request.prompt_eng_chat_model == "gpt-5.4-mini"

    def test_requires_positive_template_id(self):
        with pytest.raises(ValidationError):
            OptimizePromptRequest(project_id=uuid4(), template_id=0, labeled_pdfs=[uuid4()])

    def test_requires_positive_max_cost(self):
        with pytest.raises(ValidationError):
            OptimizePromptRequest(
                project_id=uuid4(),
                template_id=1,
                labeled_pdfs=[uuid4()],
                max_cost_usd=0,
            )

    def test_requires_labeled_pdfs(self):
        with pytest.raises(ValidationError):
            OptimizePromptRequest(project_id=uuid4(), template_id=1, labeled_pdfs=[])


class TestOcrEvaluationRequest:
    def test_defaults_match_workers_ocr_evaluation_command(self):
        request = OcrEvaluationRequest(project_id=uuid4(), judge_model="gemini-3.1-flash-lite")

        assert request.max_pdfs == 5
        assert request.max_pages_per_pdf == 3
        assert request.max_cost_usd == 0.5
        assert request.pdf_ids is None
        assert request.gpu_model == "olm-ocr2"
        assert request.ocr_only is True

    def test_requires_judge_model(self):
        with pytest.raises(ValidationError):
            OcrEvaluationRequest(project_id=uuid4(), judge_model="")

    def test_requires_positive_sampling_and_cost(self):
        with pytest.raises(ValidationError):
            OcrEvaluationRequest(
                project_id=uuid4(),
                judge_model="gemini-3.1-flash-lite",
                max_pdfs=0,
            )
        with pytest.raises(ValidationError):
            OcrEvaluationRequest(
                project_id=uuid4(),
                judge_model="gemini-3.1-flash-lite",
                max_pages_per_pdf=0,
            )
        with pytest.raises(ValidationError):
            OcrEvaluationRequest(
                project_id=uuid4(),
                judge_model="gemini-3.1-flash-lite",
                max_cost_usd=0,
            )

    def test_rejects_invalid_gpu_model(self):
        with pytest.raises(ValidationError):
            OcrEvaluationRequest(
                project_id=uuid4(),
                judge_model="gemini-3.1-flash-lite",
                gpu_model="bad-ocr",
            )

    def test_pdf_request_requires_pdf_ids(self):
        with pytest.raises(ValidationError):
            OcrEvaluationPdfsRequest(
                project_id=uuid4(),
                judge_model="gemini-3.1-flash-lite",
                pdf_ids=[],
            )


class TestExtractTextBatchRequest:
    def test_requires_pdf_ids(self):
        with pytest.raises(ValidationError):
            ExtractTextBatchRequest(project_id=uuid4(), pdf_ids=[], extract_method="pdfium")

    def test_rejects_invalid_extract_method(self):
        with pytest.raises(ValidationError):
            ExtractTextBatchRequest(
                project_id=uuid4(),
                pdf_ids=[uuid4()],
                extract_method="metadata",
            )


class TestWorkerDispatchEndpoints:
    @pytest.mark.anyio
    async def test_optimize_prompt_dispatches_context_engineering_task(
        self, async_client, mock_redis, monkeypatch
    ):
        project_id = uuid4()
        pdf_id = uuid4()
        task_id = "mock-task-id-123"
        dispatch_calls = []

        def fake_dispatch(**kwargs):
            dispatch_calls.append(kwargs)
            return task_id

        monkeypatch.setattr(events, "dispatch_optimize_prompt", fake_dispatch)

        response = await async_client.post(
            "/api/v1/worker-dispatch/optimize-prompt",
            json={
                "project_id": str(project_id),
                "template_id": 1,
                "labeled_pdfs": [str(pdf_id)],
                "beta": 2,
                "max_cost_usd": "1.25",
                "ner_chat_model": "gpt-5.4-mini",
                "prompt_eng_chat_model": "gpt-5.4",
            },
        )

        assert response.status_code == 200
        assert response.json() == {"task_id": task_id}
        assert dispatch_calls == [
            {
                "project_id": str(project_id),
                "template_id": 1,
                "labeled_pdfs": [str(pdf_id)],
                "beta": 2.0,
                "max_cost_usd": 1.25,
                "ner_chat_model": "gpt-5.4-mini",
                "prompt_eng_chat_model": "gpt-5.4",
                "convergence_threshold": 0.02,
            }
        ]
        mock_redis.set.assert_called_once_with(
            f"worker-dispatch:task:project:{task_id}",
            str(project_id),
            ex=86400,
        )

    @pytest.mark.anyio
    async def test_ocr_evaluation_dispatches_worker_task(
        self, async_client, mock_redis, monkeypatch
    ):
        project_id = uuid4()
        task_id = "ocr-task-id-123"
        dispatch_calls = []

        def fake_dispatch(**kwargs):
            dispatch_calls.append(kwargs)
            return task_id

        monkeypatch.setattr(events, "dispatch_ocr_evaluation", fake_dispatch)

        response = await async_client.post(
            "/api/v1/worker-dispatch/ocr-evaluation",
            json={
                "project_id": str(project_id),
                "judge_model": "gemini-3.1-flash-lite",
                "max_pdfs": 2,
                "max_pages_per_pdf": 1,
                "max_cost_usd": 0.75,
                "gpu_model": "deepseek-ocr",
                "ocr_only": True,
            },
        )

        assert response.status_code == 200
        assert response.json() == {"task_id": task_id}
        assert dispatch_calls == [
            {
                "project_id": str(project_id),
                "judge_model": "gemini-3.1-flash-lite",
                "max_pdfs": 2,
                "max_pages_per_pdf": 1,
                "max_cost_usd": 0.75,
                "pdf_ids": None,
                "gpu_model": "deepseek-ocr",
                "ocr_only": True,
            }
        ]
        mock_redis.set.assert_called_once_with(
            f"worker-dispatch:task:project:{task_id}",
            str(project_id),
            ex=86400,
        )

    @pytest.mark.anyio
    async def test_ocr_evaluation_pdfs_dispatches_worker_task(
        self, async_client, mock_redis, monkeypatch
    ):
        project_id = uuid4()
        pdf_id = uuid4()
        task_id = "ocr-task-id-456"
        dispatch_calls = []

        def fake_dispatch(**kwargs):
            dispatch_calls.append(kwargs)
            return task_id

        monkeypatch.setattr(events, "dispatch_ocr_evaluation", fake_dispatch)

        response = await async_client.post(
            "/api/v1/worker-dispatch/ocr-evaluation/pdfs",
            json={
                "project_id": str(project_id),
                "judge_model": "gemini-3.1-flash-lite",
                "pdf_ids": [str(pdf_id)],
                "gpu_model": "olm-ocr2",
            },
        )

        assert response.status_code == 200
        assert response.json() == {"task_id": task_id}
        assert dispatch_calls == [
            {
                "project_id": str(project_id),
                "judge_model": "gemini-3.1-flash-lite",
                "max_pdfs": 5,
                "max_pages_per_pdf": 3,
                "max_cost_usd": 0.5,
                "pdf_ids": [str(pdf_id)],
                "gpu_model": "olm-ocr2",
                "ocr_only": True,
            }
        ]
        mock_redis.set.assert_called_once_with(
            f"worker-dispatch:task:project:{task_id}",
            str(project_id),
            ex=86400,
        )

    @pytest.mark.anyio
    async def test_status_returns_project_id_from_redis(
        self, async_client, mock_redis, monkeypatch
    ):
        project_id = str(uuid4())
        task_id = "test-task-123"

        mock_redis.get = AsyncMock(return_value=project_id)
        monkeypatch.setattr(
            events,
            "get_task_status",
            lambda tid: {"task_id": tid, "status": "PENDING"},
        )

        response = await async_client.get(
            f"/api/v1/worker-dispatch/optimize-prompt/{task_id}/status"
        )

        assert response.status_code == 200
        assert response.json() == {
            "task_id": task_id,
            "status": "PENDING",
            "project_id": project_id,
        }
        mock_redis.get.assert_called_once_with(f"worker-dispatch:task:project:{task_id}")

    @pytest.mark.anyio
    async def test_status_decodes_project_id_from_redis_bytes(
        self, async_client, mock_redis, monkeypatch
    ):
        project_id = str(uuid4())
        task_id = "test-task-123"

        mock_redis.get = AsyncMock(return_value=project_id.encode())
        monkeypatch.setattr(
            events,
            "get_task_status",
            lambda tid: {"task_id": tid, "status": "SUCCESS", "result": {"ok": True}},
        )

        response = await async_client.get(
            f"/api/v1/worker-dispatch/ocr-evaluation/{task_id}/status"
        )

        assert response.status_code == 200
        assert response.json()["project_id"] == project_id

    @pytest.mark.anyio
    async def test_status_returns_null_project_id_for_unknown_task(
        self, async_client, mock_redis, monkeypatch
    ):
        mock_redis.get = AsyncMock(return_value=None)
        monkeypatch.setattr(
            events,
            "get_task_status",
            lambda tid: {"task_id": tid, "status": "PENDING"},
        )

        response = await async_client.get(
            "/api/v1/worker-dispatch/ocr-evaluation/unknown-task/status"
        )

        assert response.status_code == 200
        assert response.json()["project_id"] is None

    @pytest.mark.anyio
    async def test_text_extract_dispatches_worker_task(self, async_client, mock_redis, monkeypatch):
        project_id = uuid4()
        pdf_id = uuid4()
        task_id = "text-extract-task-123"
        dispatch_calls = []

        def fake_dispatch(**kwargs):
            dispatch_calls.append(kwargs)
            return task_id

        monkeypatch.setattr(
            "app.domains.worker_dispatch.router.repository.fetch_pdf_ids_outside_project",
            AsyncMock(return_value=[]),
        )
        monkeypatch.setattr(events, "dispatch_text_extract", fake_dispatch)

        response = await async_client.post(
            "/api/v1/worker-dispatch/text-extract",
            json={
                "project_id": str(project_id),
                "pdf_ids": [str(pdf_id)],
                "extract_method": "pdfium",
            },
        )

        assert response.status_code == 200
        assert response.json() == {"task_id": task_id}
        assert dispatch_calls == [
            {
                "project_id": str(project_id),
                "pdf_ids": [str(pdf_id)],
                "extract_method": "pdfium",
            }
        ]
        mock_redis.set.assert_called_once_with(
            f"worker-dispatch:task:project:{task_id}",
            str(project_id),
            ex=86400,
        )

    @pytest.mark.anyio
    async def test_text_extract_rejects_pdf_ids_outside_project(
        self, async_client, mock_redis, monkeypatch
    ):
        project_id = uuid4()
        pdf_id = uuid4()
        dispatch_calls = []

        monkeypatch.setattr(
            "app.domains.worker_dispatch.router.repository.fetch_pdf_ids_outside_project",
            AsyncMock(return_value=[pdf_id]),
        )
        monkeypatch.setattr(
            events, "dispatch_text_extract", lambda **kwargs: dispatch_calls.append(kwargs)
        )

        response = await async_client.post(
            "/api/v1/worker-dispatch/text-extract",
            json={
                "project_id": str(project_id),
                "pdf_ids": [str(pdf_id)],
                "extract_method": "pdfium",
            },
        )

        assert response.status_code == 422
        assert response.json() == {
            "detail": {
                "message": "All pdf_ids must belong to project_id",
                "pdf_ids": [str(pdf_id)],
            }
        }
        assert dispatch_calls == []
        mock_redis.set.assert_not_called()

    @pytest.mark.anyio
    async def test_old_llm_ner_routes_are_not_mounted(self, async_client):
        response = await async_client.post(
            "/api/v1/llm-ner/optimize-prompt",
            json={"project_id": str(uuid4()), "template_id": 1},
        )

        assert response.status_code == 404


class TestWorkerDispatchEvents:
    def test_dispatch_sends_context_engineering_task(self, monkeypatch):
        send_task_calls = []

        class FakeResult:
            id = "task-123"

        def fake_send_task(*args, **kwargs):
            send_task_calls.append((args, kwargs))
            return FakeResult()

        monkeypatch.setattr(events.celery_client, "send_task", fake_send_task)
        monkeypatch.setattr(events, "celery_message_headers", lambda: {"request-id": "test"})

        task_id = events.dispatch_optimize_prompt(
            project_id=str(uuid4()),
            template_id=3,
            labeled_pdfs=[str(uuid4())],
            max_cost_usd=2.5,
        )

        assert task_id == "task-123"
        args, kwargs = send_task_calls[0]
        assert args == ("context_engineering.optimize_prompt",)
        assert kwargs["args"][0]
        assert kwargs["kwargs"] == {
            "template_id": 3,
            "labeled_pdfs": [kwargs["kwargs"]["labeled_pdfs"][0]],
            "beta": 1.0,
            "max_cost_usd": 2.5,
            "ner_chat_model": "gpt-5.4-mini",
            "prompt_eng_chat_model": "gpt-5.4-mini",
            "convergence_threshold": 0.02,
        }
        assert kwargs["headers"] == {"request-id": "test"}

    def test_dispatch_sends_ocr_evaluation_task(self, monkeypatch):
        send_task_calls = []

        class FakeResult:
            id = "ocr-task-123"

        def fake_send_task(*args, **kwargs):
            send_task_calls.append((args, kwargs))
            return FakeResult()

        monkeypatch.setattr(events.celery_client, "send_task", fake_send_task)
        monkeypatch.setattr(events, "celery_message_headers", lambda: {"request-id": "test"})

        task_id = events.dispatch_ocr_evaluation(
            project_id=str(uuid4()),
            judge_model="gemini-3.1-flash-lite",
            max_pdfs=2,
            max_pages_per_pdf=1,
            max_cost_usd=0.75,
            pdf_ids=[str(uuid4())],
            gpu_model="deepseek-ocr",
            ocr_only=True,
        )

        assert task_id == "ocr-task-123"
        args, kwargs = send_task_calls[0]
        assert args == ("ocr_evaluation.evaluate_project",)
        assert kwargs["args"][0]
        assert kwargs["args"][1] == "gemini-3.1-flash-lite"
        assert kwargs["kwargs"] == {
            "max_pdfs": 2,
            "max_pages_per_pdf": 1,
            "max_cost_usd": 0.75,
            "pdf_ids": [kwargs["kwargs"]["pdf_ids"][0]],
            "gpu_model": "deepseek-ocr",
            "ocr_only": True,
        }
        assert kwargs["headers"] == {"request-id": "test"}

    def test_dispatch_sends_text_extract_task(self, monkeypatch):
        send_task_calls = []

        class FakeResult:
            id = "text-task-123"

        def fake_send_task(*args, **kwargs):
            send_task_calls.append((args, kwargs))
            return FakeResult()

        monkeypatch.setattr(events.celery_client, "send_task", fake_send_task)
        monkeypatch.setattr(events, "celery_message_headers", lambda: {"request-id": "test"})

        pdf_id = str(uuid4())
        project_id = str(uuid4())
        task_id = events.dispatch_text_extract(
            project_id=project_id,
            pdf_ids=[pdf_id],
            extract_method="pdfium",
        )

        assert task_id == "text-task-123"
        args, kwargs = send_task_calls[0]
        assert args == ("text_extract.extract_missing_pdf_texts",)
        assert kwargs["args"] == [project_id, [pdf_id], "pdfium"]
        assert kwargs["headers"] == {"request-id": "test"}


class TestGetTaskStatus:
    def test_returns_pending_when_task_not_ready(self, monkeypatch):
        class FakeAsyncResult:
            status = "PENDING"
            info = None

            def ready(self):
                return False

        monkeypatch.setattr(events, "AsyncResult", lambda tid, app: FakeAsyncResult())

        result = events.get_task_status("task-1")

        assert result == {"task_id": "task-1", "status": "PENDING"}

    def test_returns_result_on_success(self, monkeypatch):
        class FakeAsyncResult:
            status = "SUCCESS"
            result = {"best_prompt_id": "abc"}

            def ready(self):
                return True

            def successful(self):
                return True

        monkeypatch.setattr(events, "AsyncResult", lambda tid, app: FakeAsyncResult())

        result = events.get_task_status("task-2")

        assert result == {
            "task_id": "task-2",
            "status": "SUCCESS",
            "result": {"best_prompt_id": "abc"},
        }

    def test_returns_error_on_failure(self, monkeypatch):
        class FakeAsyncResult:
            status = "FAILURE"
            result = RuntimeError("Something went wrong")

            def ready(self):
                return True

            def successful(self):
                return False

        monkeypatch.setattr(events, "AsyncResult", lambda tid, app: FakeAsyncResult())

        result = events.get_task_status("task-3")

        assert result["task_id"] == "task-3"
        assert result["status"] == "FAILURE"
        assert "Something went wrong" in result["error"]

    def test_returns_progress_on_pending_with_info(self, monkeypatch):
        class FakeAsyncResult:
            status = "PROGRESS"
            info = {"phase": "evaluating_variant", "percent": 45}

            def ready(self):
                return False

        monkeypatch.setattr(events, "AsyncResult", lambda tid, app: FakeAsyncResult())

        result = events.get_task_status("task-4")

        assert result == {
            "task_id": "task-4",
            "status": "PROGRESS",
            "progress": {"phase": "evaluating_variant", "percent": 45},
        }

    def test_ignores_non_dict_info(self, monkeypatch):
        class FakeAsyncResult:
            status = "PROGRESS"
            info = "some string"

            def ready(self):
                return False

        monkeypatch.setattr(events, "AsyncResult", lambda tid, app: FakeAsyncResult())

        result = events.get_task_status("task-5")

        assert result == {"task_id": "task-5", "status": "PROGRESS"}
