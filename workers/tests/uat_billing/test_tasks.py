from unittest.mock import patch

MODULE = "app.domains.uat_billing.tasks"


def test_direct_payment_task_is_registered_with_expected_name():
    from app.domains.uat_billing.tasks import create_direct_payment_task

    assert create_direct_payment_task.name == "uat_billing.create_direct_payment"
    assert create_direct_payment_task.max_retries == 0


def test_current_cycle_task_is_registered_with_expected_name():
    from app.domains.uat_billing.tasks import charge_account_task

    assert charge_account_task.name == "uat_billing.charge_account"
    assert charge_account_task.max_retries == 0


def test_due_accounts_task_is_registered_with_expected_name():
    from app.domains.uat_billing.tasks import charge_due_accounts_task

    assert charge_due_accounts_task.name == "uat_billing.charge_due_accounts"
    assert charge_due_accounts_task.max_retries == 0


@patch(f"{MODULE}.anyio.run")
def test_direct_payment_task_delegates_to_async_wrapper(mock_anyio_run):
    from app.domains.uat_billing.tasks import _create_direct_payment, create_direct_payment_task

    mock_anyio_run.return_value = {"payment_intent_id": "pi_test"}

    result = create_direct_payment_task.run("individual", "user-1", 100)

    assert result == {"payment_intent_id": "pi_test"}
    mock_anyio_run.assert_called_once_with(_create_direct_payment, "individual", "user-1", 100)


@patch(f"{MODULE}.anyio.run")
def test_current_cycle_task_delegates_to_async_wrapper(mock_anyio_run):
    from app.domains.uat_billing.tasks import _charge_account, charge_account_task

    mock_anyio_run.return_value = {"status": "succeeded"}

    result = charge_account_task.run("organization", "org-1")

    assert result == {"status": "succeeded"}
    mock_anyio_run.assert_called_once_with(_charge_account, "organization", "org-1")


@patch(f"{MODULE}.anyio.run")
def test_due_accounts_task_delegates_to_async_wrapper(mock_anyio_run):
    from app.domains.uat_billing.tasks import _charge_due_accounts, charge_due_accounts_task

    mock_anyio_run.return_value = {"succeeded": 1, "failed": 0}

    result = charge_due_accounts_task.run(limit=10)

    assert result == {"succeeded": 1, "failed": 0}
    mock_anyio_run.assert_called_once_with(_charge_due_accounts, 10)
