import setupDB from "./db-setup"
import setupDOM from "./dom-setup"

const tasks = []
tasks.push(setupDOM())
if (process.env.TEST_DB === "true") tasks.push(setupDB())

await Promise.all(tasks)
