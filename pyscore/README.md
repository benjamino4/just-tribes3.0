# pyscore — optional Python scoring sidecar

A tiny FastAPI service that scores the Ember Reflex mini-game from raw reaction
times. It is **optional**: the Node server has a byte-for-byte identical
fallback, so the app runs unchanged whether or not this service is up.

## Run locally

```bash
cd pyscore
pip install -r requirements.txt
uvicorn app:app --host 127.0.0.1 --port 8100
```

Then point the Node game server at it:

```bash
export PYSCORE_URL=http://127.0.0.1:8100
```

With `PYSCORE_URL` set, `POST /warband/challenge/:id/resolve` and
`POST /bot-practice/claim` send the raw `times[]` here to be scored. Without
it, Node scores locally with the same formula.

## Endpoints

- `GET  /health` → `{ ok: true }`
- `POST /score/reflex`   body `{ "times": [ms, ...] }` → `{ score }`
- `POST /score/practice` body `{ "times": [ms, ...] }` → `{ score }`

## Security

No auth of its own — bind to `127.0.0.1` / a private network and let only the
trusted Node backend reach it. Do **not** expose it publicly.
