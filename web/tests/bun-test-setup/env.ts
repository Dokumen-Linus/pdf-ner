const TEST_SERVER_ENV: Record<string, string> = {
  DATABASE_URL: "postgres://postgres:dev@localhost:5432/postgres?sslmode=disable",
  AUTH_DATABASE_URL: "postgres://postgres:dev@localhost:5432/postgres?sslmode=disable",
  WEB_DATABASE_URL: "postgres://postgres:dev@localhost:5432/postgres?sslmode=disable",
  BASE_URL: "http://localhost:3000",
  BETTER_AUTH_SECRET: "test-better-auth-secret",
  BETTER_AUTH_URL: "http://localhost:3000",
  MICROSOFT_CLIENT_ID: "test-microsoft-client-id",
  MICROSOFT_CLIENT_SECRET: "test-microsoft-client-secret",
  FROM_EMAIL: "no-reply@example.test",
  MY_EMAIL: "admin@example.test",
  STRIPE_SECRET_KEY: "sk_test_dummy",
  API_URL: "http://api.test",
  API_KEY: "test-api-key",
  SES_AWS_REGION: "us-east-1",
  PDF_STORAGE_AWS_REGION: "us-east-1",
}

for (const [key, value] of Object.entries(TEST_SERVER_ENV)) {
  process.env[key] ??= value
}
