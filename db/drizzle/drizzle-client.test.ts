import { sql } from "drizzle-orm"
import { db } from "./client"

async function main() {
  try {
    console.log("Testing DB connection...")
    const result = await db.execute(sql`SELECT NOW()`)
    console.log("Connection successful:", result.rows[0])

    console.log("Testing schema query...")
    const users = await db.query.users.findMany({ limit: 1 })
    console.log("Users query successful. Count:", users.length)

    process.exit(0)
  } catch (error) {
    console.error("DB Verification failed:", error)
    process.exit(1)
  }
}

main()
