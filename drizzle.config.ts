import { config } from "dotenv"
import { defineConfig } from "drizzle-kit"

config()

export default defineConfig({
  schema: "./db/drizzle/schema/index.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
