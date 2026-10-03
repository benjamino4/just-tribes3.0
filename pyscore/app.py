# ═══════════════════════════════════════════════════════════════════
# FILE: pyscore/app.py
# PURPOSE: Authoritative scoring service. One endpoint per archetype.
#          Mirrors lib/pyscore.js exactly. Never returns 500.
# DEPENDS ON: requirements.txt
# ═══════════════════════════════════════════════════════════════════
from __future__ import annotations
from typing import List
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, field_validator

MAX_BODY = 32 * 1024
MAX_ROUNDS = 400
MAX_MS = 60_000

app = FastAPI(title="TRIBES pyscore", version="5.0", docs_url=None, redoc_url=None)


@app.middleware("http")
async def limit_body(request: Request, call_next):
    cl = request.headers.get("content-length")
    if cl:
        try:
            if int(cl) > MAX_BODY:
                return JSONResponse({"error": "payload too large"}, status_code=413)
        except ValueError:
            return JSONResponse({"error": "bad content-length"}, status_code=400)
    return await call_next(request)


class ReactionIn(BaseModel):
    times: List[float] = Field(default_factory=list, max_length=MAX_ROUNDS)
    model_config = {"extra": "ignore"}

    @field_validator("times")
    @classmethod
    def _clean(cls, v):
        out = []
        for t in v:
            try:
                f = float(t)
            except (TypeError, ValueError):
                continue
            if f != f or f in (float("inf"), float("-inf")) or f <= 0:
                continue
            out.append(min(f, MAX_MS))
        return out


class MemoryIn(BaseModel):
    correct: int = 0
    total: int = 0
    max_len: int = 1
    model_config = {"extra": "ignore"}


class ChoiceIn(BaseModel):
    wins: int = 0
    losses: int = 0
    model_config = {"extra": "ignore"}


class SequenceIn(BaseModel):
    chain_len: int = 0
    won: bool = False
    model_config = {"extra": "ignore"}


class DeductionIn(BaseModel):
    rounds_won: int = 0
    rounds_lost: int = 0
    model_config = {"extra": "ignore"}


def reaction_score(times):
    if not times:
        return 0
    avg = sum(times) / len(times)
    return max(0, min(100, round(120 - (avg - 200) / 6)))


def memory_score(correct, total, max_len):
    if total <= 0:
        return 0
    acc = correct / max(1, total)
    depth = min(1.0, max_len / 12.0)
    return max(0, min(100, round(acc * 70 + depth * 30)))


def choice_score(wins, losses):
    g = wins + losses
    if g <= 0:
        return 0
    return max(0, min(100, round(wins / g * 100)))


def sequence_score(chain_len, won):
    base = min(100, chain_len * 8)
    return 100 if won else min(80, base)


def deduction_score(won, lost):
    g = won + lost
    if g <= 0:
        return 0
    return max(0, min(100, round(won / g * 100)))


@app.exception_handler(Exception)
async def _fallback(_: Request, _e: Exception):
    return JSONResponse({"error": "internal"}, status_code=500)


@app.get("/health")
def health():
    return {"ok": True, "service": "pyscore", "version": "5.0"}


@app.post("/score/reaction")
def score_reaction(body: ReactionIn):
    return {"score": reaction_score(body.times), "rounds": len(body.times)}


@app.post("/score/memory")
def score_memory(body: MemoryIn):
    return {"score": memory_score(body.correct, body.total, body.max_len)}


@app.post("/score/choice")
def score_choice(body: ChoiceIn):
    return {"score": choice_score(body.wins, body.losses)}


@app.post("/score/sequence")
def score_sequence(body: SequenceIn):
    return {"score": sequence_score(body.chain_len, body.won)}


@app.post("/score/deduction")
def score_deduction(body: DeductionIn):
    return {"score": deduction_score(body.rounds_won, body.rounds_lost)}