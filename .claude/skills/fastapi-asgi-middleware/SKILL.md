---
name: fastapi-middleware
description: Guide for writing pure ASGI middleware in FastAPI/Starlette. Use when creating custom middleware, intercepting requests/responses, adding headers, logging, authentication, or any request processing pipeline.
---

When writing ASGI middleware for FastAPI or Starlette, follow these patterns:

## What is ASGI?

ASGI (Asynchronous Server Gateway Interface) is a spiritual successor to WSGI, intended to provide a standard interface between async-capable Python web servers, frameworks, and applications.

Where WSGI provided a standard for synchronous Python apps, ASGI provides one for both asynchronous and synchronous apps, with a WSGI backwards-compatibility implementation and multiple servers and application frameworks.

## How ASGI Works

ASGI is structured as a single, asynchronous callable with three arguments:

- **scope** - A dict containing details about the specific connection
- **receive** - An async callable that lets the application receive event messages from the client
- **send** - An async callable that lets the application send event messages to the client

In its simplest form:

```python
async def application(scope, receive, send):
    event = await receive()
    ...
    await send({"type": "websocket.send", ...})
```

Every event sent or received is a Python dict with a predefined format. Each event has a `type` key that defines its structure.

Example incoming HTTP request body event:

```python
{
    "type": "http.request",
    "body": b"Hello World",
    "more_body": False,
}
```

Example outgoing WebSocket message event:

```python
{
    "type": "websocket.send",
    "text": "Hello world!",
}
```

This design allows multiple incoming/outgoing events per application and supports background coroutines for external triggers (like Redis queues).

## Prefer Pure ASGI Over BaseHTTPMiddleware

Always use pure ASGI middleware instead of `BaseHTTPMiddleware` for better performance and control.

## Basic Structure

Use the class-based pattern with proper type annotations:

```python
from starlette.types import ASGIApp, Message, Scope, Receive, Send

class MyMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        # Your middleware logic here
        await self.app(scope, receive, send)
```

## Key Patterns

### Filter by Request Type

Always guard for the scope type you need:

```python
if scope["type"] != "http":
    await self.app(scope, receive, send)
    return
```

### Access Request Data

Use Starlette's `Request` for easier access:

```python
from starlette.requests import Request
request = Request(scope)
# Use request.method, request.url, request.headers
```

### Modify Response Headers

Wrap the `send` callable:

```python
from starlette.datastructures import MutableHeaders

async def send_wrapper(message: Message) -> None:
    if message["type"] == "http.response.start":
        headers = MutableHeaders(scope=message)
        headers.append("X-Custom-Header", "value")
    await send(message)

await self.app(scope, receive, send_wrapper)
```

### Intercept Request Body

Wrap the `receive` callable:

```python
async def receive_wrapper():
    message = await receive()
    # Inspect or modify message["body"]
    return message

await self.app(scope, receive_wrapper, send)
```

### Send Early Response

Return a response without calling the app:

```python
from starlette.responses import JSONResponse
response = JSONResponse({"error": "Unauthorized"}, status_code=401)
await response(scope, receive, send)
return
```

### Pass Data to Endpoints

Store in scope dict with unique keys:

```python
scope["my_middleware_data"] = some_value
```

### Error Handling

Wrap app call in try/except/finally:

```python
try:
    await self.app(scope, receive, send)
except Exception as exc:
    # Handle error
    raise
finally:
    # Cleanup
```

## Critical Rules

1. **Keep middleware stateless** - All request-specific state must be scoped to `__call__`, never instance variables
2. **Always pass through non-HTTP requests** - Check `scope["type"]` and forward unhandled types
3. **Update Content-Length if modifying body** - When changing response body, recalculate the header
4. **Use `nonlocal` for wrapper state** - When inner functions need to share state within a request

## Registration

```python
from starlette.middleware import Middleware

middleware = [
    Middleware(MyMiddleware, arg1="value"),
]
app = FastAPI(middleware=middleware)
# or
app.add_middleware(MyMiddleware, arg1="value")
```
