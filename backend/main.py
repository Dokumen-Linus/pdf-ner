from fastapi import FastAPI, Depends, HTTPException
from db.client import get_connection
import asyncpg

app = FastAPI()

@app.get("/items")
async def get_all_items(conn: asyncpg.Connection = Depends(get_connection)):
    try:
        rows = await conn.fetch("SELECT * FROM table1;")
        return [dict(row) for row in rows]
    except asyncpg.PostgresError as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")