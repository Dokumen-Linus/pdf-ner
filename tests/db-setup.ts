import { Pool } from "pg"

// --- Database Setup ---
export default async function setupDB() {
  // Ensure DATABASE_URL is set for tests if not already in environment
  process.env.DATABASE_URL =
    process.env.DATABASE_URL || "postgres://postgres:dev@localhost:5432/postgres?sslmode=disable"

  // Optional: Verify DB connection before running tests to give clear errors
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  try {
    await pool.query("SELECT NOW()")
    await pool.end()
  } catch (_e) {
    console.error("CRITICAL ERROR: Database connection failed.")
    console.error(`Attempted connection to: ${process.env.DATABASE_URL}`)
    console.error(
      "Please ensure your PostgreSQL database is running and the credentials are correct.",
    )
    process.exit(1)
  }
}
