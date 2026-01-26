import "bun:test"

declare module "bun:test" {
  interface Matchers {
    toBeUuid(): void
  }
}
