---
name: anyio
description: AnyIO async library for Python that should be used instead of AsyncIO when possible. Use when working with async concurrency, task groups, cancellation, timeouts, threads, file I/O, or subprocesses in Python async code.
---

# AnyIO

AnyIO is an async concurrency library that works on top of asyncio or Trio, implementing structured concurrency. Prefer AnyIO APIs over raw asyncio for better cancellation semantics, task management, and cross-framework compatibility.

## Task Groups (Structured Concurrency)

Task groups ensure all child tasks complete before the context exits. If any task raises an exception, all others are cancelled.

```python
from anyio import create_task_group, run, sleep

async def worker(num: int) -> None:
    print(f'Task {num} running')
    await sleep(1)
    print(f'Task {num} finished')

async def main() -> None:
    async with create_task_group() as tg:
        for num in range(5):
            tg.start_soon(worker, num)
    print('All tasks finished!')

run(main)
```

### Wait for Task Initialization

Use `tg.start()` to wait until a task signals readiness via `task_status.started()`:

```python
from anyio import TASK_STATUS_IGNORED, create_task_group, create_tcp_listener, run
from anyio.abc import TaskStatus

async def start_server(port: int, *, task_status: TaskStatus[None] = TASK_STATUS_IGNORED):
    async with await create_tcp_listener(local_host="127.0.0.1", local_port=port) as listener:
        task_status.started()  # Signal ready
        await listener.serve(handler)

async def main():
    async with create_task_group() as tg:
        await tg.start(start_server, 5000)  # Waits for started()
        # Server is now ready
```

### Handle Multiple Exceptions

Use `except*` (Python 3.11+) to catch exceptions from multiple tasks:

```python
try:
    async with create_task_group() as tg:
        tg.start_soon(task_a)
        tg.start_soon(task_b)
except* ValueError as excgroup:
    for exc in excgroup.exceptions:
        ...  # handle each ValueError
```

## Cancellation and Timeouts

AnyIO uses **level cancellation** (not edge cancellation like asyncio). Once a cancel scope is cancelled, it stays cancelled and re-raises on every yield point.

### Timeouts

```python
from anyio import create_task_group, move_on_after, fail_after, sleep, run

async def main():
    # move_on_after: exits silently on timeout
    with move_on_after(1) as scope:
        await sleep(10)
    if scope.cancelled_caught:
        print('Timed out')

    # fail_after: raises TimeoutError on timeout
    with fail_after(1):
        await sleep(10)  # Raises TimeoutError
```

### Cancel a Task Group

```python
async def main():
    async with create_task_group() as tg:
        tg.start_soon(worker, 1)
        tg.start_soon(worker, 2)
        await sleep(0.1)
        tg.cancel_scope.cancel()  # Cancels all tasks
```

### Shielding from Cancellation

```python
from anyio import CancelScope, move_on_after

async def cleanup_with_timeout():
    try:
        await some_operation()
    except BaseException:
        # Shield cleanup from parent cancellation, with 10s timeout
        with move_on_after(10, shield=True):
            await resource.close()
        raise
```

### Catching Cancellation

```python
from anyio import get_cancelled_exc_class, CancelScope

async def do_something():
    try:
        await operation()
    except get_cancelled_exc_class():
        with CancelScope(shield=True):
            await cleanup()  # Must shield to await during cancellation
        raise  # Always re-raise cancellation!
```

## Synchronization Primitives

All primitives are NOT thread-safe. Use `from_thread.run_sync()` from worker threads.

```python
from anyio import Event, Lock, Semaphore, Condition, CapacityLimiter

# Event - one-shot notification (cannot be reused)
event = Event()
event.set()
await event.wait()

# Lock - exclusive access
async with Lock() as lock:
    ...

# Semaphore - limit concurrent access
async with Semaphore(5):
    ...

# CapacityLimiter - like semaphore but one token per task
limiter = CapacityLimiter(10)
async with limiter:
    ...
```

## Memory Object Streams (Instead of Queues)

Prefer memory object streams over asyncio queues - they support async iteration and proper shutdown.

```python
from anyio import create_memory_object_stream, create_task_group

async def producer(send_stream):
    async with send_stream:
        for i in range(10):
            await send_stream.send(i)

async def consumer(receive_stream):
    async with receive_stream:
        async for item in receive_stream:
            print(item)

async def main():
    send_stream, receive_stream = create_memory_object_stream[int](max_buffer_size=10)
    async with create_task_group() as tg:
        tg.start_soon(producer, send_stream)
        tg.start_soon(consumer, receive_stream)
```

## Working with Threads

### Run Blocking Code in Worker Thread

```python
from anyio import to_thread, run
import time

async def main():
    await to_thread.run_sync(time.sleep, 5)
    # Or with cancellation support:
    await to_thread.run_sync(blocking_func, cancellable=True)

run(main)
```

### Call Async Code from Worker Thread

```python
from anyio import from_thread, sleep, to_thread, run

def blocking_function():
    from_thread.run(sleep, 5)  # Call coroutine from thread

async def main():
    await to_thread.run_sync(blocking_function)
```

### Call Sync Code in Event Loop from Thread

```python
from anyio import Event, from_thread, to_thread
import time

def worker(event):
    time.sleep(1)
    from_thread.run_sync(event.set)  # Thread-safe event setting
```

### Adjust Thread Pool Size

```python
from anyio import to_thread

async def configure():
    to_thread.current_default_thread_limiter().total_tokens = 60  # Default is 40
```

## Async File I/O

```python
from anyio import open_file, Path, run

async def main():
    # File operations
    async with await open_file('/path/to/file') as f:
        contents = await f.read()
        async for line in f:
            print(line)

    # Path operations
    path = Path('/foo/bar')
    await path.write_bytes(b'hello')
    if await path.is_file():
        text = await path.read_text()
```

## Subprocesses

```python
from anyio import run_process, open_process, run

async def main():
    # One-shot command
    result = await run_process(['ls', '-la'])
    print(result.stdout.decode())

    # Interactive process
    async with await open_process(['cat']) as proc:
        await proc.stdin.send(b'hello')
        output = await proc.stdout.receive()
```

### Run CPU-Intensive Code in Worker Process

```python
from anyio import run, to_process

def cpu_intensive(x, y):
    return x + y

async def main():
    result = await to_process.run_sync(cpu_intensive, 1, 2)

if __name__ == '__main__':  # Required guard!
    run(main)
```

## Testing with Pytest

Use `pytest.mark.anyio` instead of `pytest.mark.asyncio`:

```python
import pytest

@pytest.fixture
def anyio_backend():
    return "asyncio"  # Or "trio", or test both by default

@pytest.mark.anyio
async def test_something():
    ...

# Or set globally in pyproject.toml:
# [tool.pytest.ini_options]
# anyio_mode = "auto"
```

### Async Fixtures

```python
import pytest

pytestmark = pytest.mark.anyio

@pytest.fixture
async def server():
    server = await setup_server()
    yield server
    await server.shutdown()

async def test_server(server):
    result = await server.do_something()
    assert result == 'foo'
```

## Key Differences from asyncio

| Feature | asyncio | AnyIO |
|---------|---------|-------|
| Cancellation | Edge (one-shot) | Level (persistent) |
| Task groups | Limited API | Full cancel scope access |
| Task readiness | Not supported | `tg.start()` + `task_status.started()` |
| Queues | Unbounded default | Memory streams with capacity |
| Shielding | `asyncio.shield()` (footgun) | `CancelScope(shield=True)` |
| File I/O | Not included | `open_file()`, async `Path` |

## FastAPI Thread Warning

Non-async FastAPI dependencies run in threads:

```python
# BAD - runs in thread pool
def http_client(request: Request) -> AsyncClient:
    return request.state.client

# GOOD - runs in event loop
async def http_client(request: Request) -> AsyncClient:
    return request.state.client
```
