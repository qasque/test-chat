"""Прокси Groq STT: запрос с IP NL, чтобы обойти 403 с РФ. Совместим с multipart OpenAI/Groq."""

import os

import httpx
from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.responses import Response

app = FastAPI(title="STT Groq relay")
GROQ_KEY = (os.environ.get("GROQ_API_KEY") or "").strip()
RELAY_TOKEN = (os.environ.get("RELAY_TOKEN") or "").strip()
GROQ_URL = "https://api.groq.com/openai/v1/audio/transcriptions"


@app.get("/health")
async def health():
    return {"status": "ok", "groq_configured": bool(GROQ_KEY), "relay_auth": bool(RELAY_TOKEN)}


@app.post("/openai/v1/audio/transcriptions")
async def transcribe(
    file: UploadFile = File(...),
    model: str = Form("whisper-large-v3-turbo"),
    language: str | None = Form(None),
    x_relay_token: str | None = Header(None, alias="X-Relay-Token"),
):
    if RELAY_TOKEN and (x_relay_token or "").strip() != RELAY_TOKEN:
        raise HTTPException(status_code=401, detail="invalid relay token")
    if not GROQ_KEY:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY not set on relay")

    body = await file.read()
    if not body:
        raise HTTPException(status_code=400, detail="empty file")

    fname = file.filename or "audio.ogg"
    ctype = file.content_type or "application/octet-stream"
    files = {"file": (fname, body, ctype)}
    data: dict = {"model": model}
    if language:
        data["language"] = language

    async with httpx.AsyncClient(timeout=120) as client:
        r = await client.post(
            GROQ_URL,
            headers={"Authorization": f"Bearer {GROQ_KEY}"},
            data=data,
            files=files,
        )
    ct = r.headers.get("content-type") or "application/json"
    return Response(content=r.content, status_code=r.status_code, media_type=ct)
