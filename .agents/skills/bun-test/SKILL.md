---
name: bun-test
description: Use to learn bun:test syntax, assertions, describe/it, test.skip/only/each
---

# Bun Test Basics

Bun ships with a fast, built-in, Jest-compatible test runner. Tests run with the Bun runtime and support TypeScript/JSX natively.

## Quick Start

```bash
# Run all tests
bun test

# Run specific file
bun test ./test/math.test.ts

# Run tests matching pattern
bun test --test-name-pattern "addition"
```

## Writing Tests

```typescript
import { test, expect, describe } from "bun:test";

test("2 + 2", () => {
  expect(2 + 2).toBe(4);
});

describe("math", () => {
  test("addition", () => {
    expect(1 + 1).toBe(2);
  });

  test("subtraction", () => {
    expect(5 - 3).toBe(2);
  });
});
```

## Test File Patterns

Bun discovers test files matching:
- `*.test.{js|jsx|ts|tsx}`
- `*_test.{js|jsx|ts|tsx}`
- `*.spec.{js|jsx|ts|tsx}`
- `*_spec.{js|jsx|ts|tsx}`

## Test Modifiers

```typescript
// Skip a test
test.skip("not ready", () => {
  // won't run
});

// Only run this test
test.only("focus on this", () => {
  // other tests won't run
});

// Placeholder for future test
test.todo("implement later");

// Expected to fail
test.failing("known bug", () => {
  throw new Error("This is expected");
});
```

## Parameterized Tests

```typescript
test.each([
  [1, 1, 2],
  [2, 2, 4],
  [3, 3, 6],
])("add(%i, %i) = %i", (a, b, expected) => {
  expect(a + b).toBe(expected);
});

// With objects
test.each([
  { a: 1, b: 2, expected: 3 },
  { a: 5, b: 5, expected: 10 },
])("add($a, $b) = $expected", ({ a, b, expected }) => {
  expect(a + b).toBe(expected);
});
```

## Concurrent Tests

```typescript
// Run tests in parallel
test.concurrent("async test 1", async () => {
  await fetch("/api/1");
});

test.concurrent("async test 2", async () => {
  await fetch("/api/2");
});

// Force sequential when using --concurrent
test.serial("must run alone", () => {
  // runs sequentially
});
```

## Common Matchers

```typescript
// Equality
expect(value).toBe(4);           // Strict equality
expect(obj).toEqual({ a: 1 });   // Deep equality
expect(value).toStrictEqual(4);  // Strict + type

// Truthiness
expect(value).toBeTruthy();
expect(value).toBeFalsy();
expect(value).toBeNull();
expect(value).toBeDefined();
expect(value).toBeUndefined();

// Numbers
expect(value).toBeGreaterThan(3);
expect(value).toBeGreaterThanOrEqual(3);
expect(value).toBeLessThan(5);
expect(value).toBeCloseTo(0.3, 5);  // Floating point

// Strings
expect(str).toMatch(/pattern/);
expect(str).toContain("substring");
expect(str).toStartWith("Hello");
expect(str).toEndWith("world");

// Arrays
expect(arr).toContain(item);
expect(arr).toContainEqual({ a: 1 });
expect(arr).toHaveLength(3);

// Objects
expect(obj).toHaveProperty("key");
expect(obj).toHaveProperty("key", value);
expect(obj).toMatchObject({ a: 1 });

// Exceptions
expect(() => fn()).toThrow();
expect(() => fn()).toThrow("message");
expect(() => fn()).toThrow(CustomError);

// Async
await expect(promise).resolves.toBe(value);
await expect(promise).rejects.toThrow();

// Negation
expect(value).not.toBe(5);
```

## CLI Options

```bash
# Timeout per test (default 5000ms)
bun test --timeout 20

# Bail after N failures
bun test --bail
bun test --bail=10

# Watch mode
bun test --watch

# Random order
bun test --randomize
bun test --seed 12345

# Concurrent execution
bun test --concurrent
bun test --concurrent --max-concurrency 4

# Filter by name
bun test -t "pattern"
```

## Output Reporters

```bash
# Dots (compact)
bun test --dots

# JUnit XML (CI/CD)
bun test --reporter=junit --reporter-outfile=./results.xml
```

## Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `Test timeout` | Test exceeds 5s | Use `--timeout` or optimize |
| `No tests found` | Wrong file pattern | Check file naming |
| `expect is not defined` | Missing import | Import from `bun:test` |
| `Assertion failed` | Test failure | Check expected vs actual |


  ## Mock Functions

  ```typescript
  import { test, expect, mock } from "bun:test";

  // Create mock function
  const fn = mock(() => "original");

  test("mock function", () => {
    fn("arg1", "arg2");

    expect(fn).toHaveBeenCalled();
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("arg1", "arg2");
  });
  ```

  ### jest.fn() Compatibility

  ```typescript
  import { test, expect, jest } from "bun:test";

  const fn = jest.fn(() => "value");

  test("jest.fn works", () => {
    const result = fn();
    expect(result).toBe("value");
    expect(fn).toHaveBeenCalled();
  });
  ```

  ## Mock Return Values

  ```typescript
  const fn = mock();

  // Return value once
  fn.mockReturnValueOnce("first");
  fn.mockReturnValueOnce("second");

  // Permanent return value
  fn.mockReturnValue("default");

  // Promise returns
  fn.mockResolvedValue("resolved");
  fn.mockResolvedValueOnce("once");
  fn.mockRejectedValue(new Error("fail"));
  fn.mockRejectedValueOnce(new Error("once"));
  ```

  ## Mock Implementations

  ```typescript
  const fn = mock();

  // Set implementation
  fn.mockImplementation((x) => x * 2);

  // One-time implementation
  fn.mockImplementationOnce((x) => x * 10);

  // Chain implementations
  fn
    .mockImplementationOnce(() => "first")
    .mockImplementationOnce(() => "second")
    .mockImplementation(() => "default");
  ```

  ## Spy on Methods

  ```typescript
  import { test, expect, spyOn } from "bun:test";

  const obj = {
    method: () => "original",
  };

  test("spy on method", () => {
    const spy = spyOn(obj, "method");

    obj.method();

    expect(spy).toHaveBeenCalled();
    expect(obj.method()).toBe("original"); // Still works

    // Override implementation
    spy.mockImplementation(() => "mocked");
    expect(obj.method()).toBe("mocked");

    // Restore
    spy.mockRestore();
    expect(obj.method()).toBe("original");
  });
  ```

  ## Mock Modules

  ```typescript
  import { test, expect, mock } from "bun:test";

  // Mock entire module
  mock.module("./utils", () => ({
    add: mock(() => 999),
    subtract: mock(() => 0),
  }));

  // Now imports use mocked version
  import { add } from "./utils";

  test("mocked module", () => {
    expect(add(1, 2)).toBe(999);
  });
  ```

  ### Mock Node Modules

  ```typescript
  mock.module("axios", () => ({
    default: {
      get: mock(() => Promise.resolve({ data: "mocked" })),
      post: mock(() => Promise.resolve({ data: "created" })),
    },
  }));
  ```

  ### Mock with Factory

  ```typescript
  mock.module("./config", () => {
    return {
      API_URL: "http://test.local",
      DEBUG: true,
    };
  });
  ```

  ## Mock Assertions

  ```typescript
  const fn = mock();

  fn("a", "b");
  fn("c", "d");

  // Call count
  expect(fn).toHaveBeenCalled();
  expect(fn).toHaveBeenCalledTimes(2);

  // Call arguments
  expect(fn).toHaveBeenCalledWith("a", "b");
  expect(fn).toHaveBeenLastCalledWith("c", "d");
  expect(fn).toHaveBeenNthCalledWith(1, "a", "b");

  // Return values
  fn.mockReturnValue("result");
  fn();
  expect(fn).toHaveReturned();
  expect(fn).toHaveReturnedWith("result");
  expect(fn).toHaveReturnedTimes(1);
  ```

  ## Mock Properties

  ```typescript
  const fn = mock(() => "value");

  fn("arg1");
  fn("arg2");

  // Access call info
  fn.mock.calls;        // [["arg1"], ["arg2"]]
  fn.mock.results;      // [{ type: "return", value: "value" }, ...]
  fn.mock.lastCall;     // ["arg2"]

  // Clear history
  fn.mockClear();       // Clear calls, keep implementation
  fn.mockReset();       // Clear calls + implementation
  fn.mockRestore();     // Restore original (for spies)
  ```

  ## Common Patterns

  ### Mock Fetch

  ```typescript
  import { test, expect, spyOn } from "bun:test";

  test("mock fetch", async () => {
    const spy = spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: "mocked" }))
    );

    const response = await fetch("/api/data");
    const json = await response.json();

    expect(json.data).toBe("mocked");
    expect(spy).toHaveBeenCalledWith("/api/data");

    spy.mockRestore();
  });
  ```

  ### Mock Console

  ```typescript
  test("mock console", () => {
    const spy = spyOn(console, "log");

    console.log("test message");

    expect(spy).toHaveBeenCalledWith("test message");
    spy.mockRestore();
  });
  ```

  ### Mock Class Methods

  ```typescript
  class UserService {
    async getUser(id: string) {
      // Real implementation
    }
  }

  test("mock class method", () => {
    const service = new UserService();
    const spy = spyOn(service, "getUser").mockResolvedValue({
      id: "1",
      name: "Test User",
    });

    const user = await service.getUser("1");

    expect(user.name).toBe("Test User");
    expect(spy).toHaveBeenCalledWith("1");
  });
  ```

  ## Common Errors In Mocking

  | Error | Cause | Fix |
  |-------|-------|-----|
  | `Cannot spy on undefined` | Property doesn't exist | Check property name |
  | `Not a function` | Trying to mock non-function | Use correct mock approach |
  | `Already mocked` | Double mocking | Use mockRestore first |
  | `Module not found` | Wrong module path | Check path in mock.module |
