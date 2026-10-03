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
    if cl is not None:
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
            try: f = float(t)
            except: continue
            if f != f or f in (float("inf"), float("-inf")) or f <= 0: continue
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

class Match3In(BaseModel):
    score: int = 0
    combos: int = 0
    model_config = {"extra": "ignore"}

class StackerIn(BaseModel):
    height: int = 0
    perfects: int = 0
    model_config = {"extra": "ignore"}

class CatchIn(BaseModel):
    caught: int = 0
    missed: int = 0
    model_config = {"extra": "ignore"}

def clamp(n, lo=0, hi=100):
    return max(lo, min(hi, int(round(n))))

@app.exception_handler(Exception)
async def _fallback(_, _e):
    return JSONResponse({"error": "internal"}, status_code=500)

@app.get("/health")
def health():
    return {"ok": True, "service": "pyscore", "version": "5.0"}

@app.post("/score/reaction")
def score_reaction(body: ReactionIn):
    if not body.times: return {"score": 0}
    avg = sum(body.times) / len(body.times)
    return {"score": clamp(120 - (avg - 200) / 6)}

@app.post("/score/memory")
def score_memory(body: MemoryIn):
    if body.total <= 0: return {"score": 0}
    acc = body.correct / max(1, body.total)
    depth = min(1.0, body.max_len / 12.0)
    return {"score": clamp(acc * 70 + depth * 30)}

@app.post("/score/choice")
def score_choice(body: ChoiceIn):
    g = body.wins + body.losses
    if g <= 0: return {"score": 0}
    return {"score": clamp(body.wins / g * 100)}

@app.post("/score/sequence")
def score_sequence(body: SequenceIn):
    base = min(100, body.chain_len * 8)
    return {"score": 100 if body.won else min(80, base)}

@app.post("/score/deduction")
def score_deduction(body: DeductionIn):
    g = body.rounds_won + body.rounds_lost
    if g <= 0: return {"score": 0}
    return {"score": clamp(body.rounds_won / g * 100)}

@app.post("/score/match3")
def score_match3(body: Match3In):
    return {"score": clamp(body.score + body.combos * 5)}

@app.post("/score/stacker")
def score_stacker(body: StackerIn):
    return {"score": clamp(body.height * 4 + body.perfects * 10)}

@app.post("/score/catch")
def score_catch(body: CatchIn):
    total = body.caught + body.missed
    if total <= 0: return {"score": 0}
    return {"score": clamp(body.caught / total * 100)}