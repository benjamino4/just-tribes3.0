# TRIBES-FILE: pyscore/app.py
# PHASE: 4 — Rise of the Eternal Flame
#
# Optional Python scoring microservice (FastAPI). The Node game server
# (server/src/lib/pyscore.js) POSTs raw reaction-time arrays here and gets back
# an authoritative 0..100 score. This is the "Python into the system" hybrid:
# run it as a sidecar and point the Node server at it with PYSCORE_URL, e.g.
#
#     pip install -r pyscore/requirements.txt
#     uvicorn app:app --host 127.0.0.1 --port 8100    # run from the pyscore/ dir
#     # then on the Node service:  PYSCORE_URL=http://127.0.0.1:8100
#
# If PYSCORE_URL is NOT set, Node uses its own identical fallback and this
# service is simply not required — nothing else changes.
#
# SECURITY: this service does NO auth of its own by design. It MUST bind to
# 127.0.0.1 / a private network reachable only by the trusted Node backend —
# never expose it to the public internet. Hardening applied here:
#   * hard cap on request body size (rejects oversized/abusive payloads),
#   * strict input validation (bounded list length, numeric range clamp),
#   * no CORS (browsers cannot call it cross-origin),
#   * every handler is total — bad input yields a 422/413, never a 500.

from __future__ import annotations

from typing import List

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, field_validator

# --- limits -----------------------------------------------------------------
MAX_BODY_BYTES = 16 * 1024      # 16 KB is ample for a few dozen numbers
MAX_ROUNDS = 200                # never trust an unbounded array
MAX_MS = 60_000                 # clamp any single sample to <= 60 s

app = FastAPI(title="TRIBES pyscore", version="1.1", docs_url=None, redoc_url=None)


@app.middleware("http")
async def limit_body(request: Request, call_next):
    """Reject oversized bodies before they are parsed."""
    cl = request.headers.get("content-length")
    if cl is not None:
        try:
            if int(cl) > MAX_BODY_BYTES:
                return JSONResponse({"error": "payload too large"}, status_code=413)
        except ValueError:
            return JSONResponse({"error": "bad content-length"}, status_code=400)
    return await call_next(request)


class ReflexIn(BaseModel):
    # Bounded list of reaction times in milliseconds.
    times: List[float] = Field(default_factory=list, max_length=MAX_ROUNDS)

    model_config = {"extra": "ignore"}  # ignore any unexpected keys, don't crash

    @field_validator("times")
    @classmethod
    def _clean(cls, v: List[float]) -> List[float]:
        out: List[float] = []
        for t in v:
            try:
                f = float(t)
            except (TypeError, ValueError):
                continue
            if f != f or f in (float("inf"), float("-inf")):  # NaN / inf
                continue
            if f <= 0:
                continue
            out.append(min(f, MAX_MS))
        return out


def reflex_score(times: List[float]) -> int:
    """0..100 from reaction times in ms. Twin of reflexScoreLocal() in Node/JS.

    ~200 ms average -> 120 (capped at 100); every extra 6 ms drops one point.
    Empty / all-invalid input scores 0.
    """
    if not times:
        return 0
    avg = sum(times) / len(times)
    return max(0, min(100, round(120 - (avg - 200) / 6)))


@app.exception_handler(Exception)
async def _fallback(_: Request, exc: Exception):  # never leak a stack trace
    return JSONResponse({"error": "internal"}, status_code=500)


@app.get("/health")
def health() -> dict:
    return {"ok": True, "service": "pyscore", "version": "1.1"}


@app.post("/score/reflex")
def score_reflex(body: ReflexIn) -> dict:
    return {"score": reflex_score(body.times), "rounds": len(body.times), "game": "reflex"}


@app.post("/score/practice")
def score_practice(body: ReflexIn) -> dict:
    # Practice Pit uses the same reflex scoring today; kept as its own route
    # so the drill can diverge later without touching the duel path.
    return {"score": reflex_score(body.times), "rounds": len(body.times), "game": "practice"}
