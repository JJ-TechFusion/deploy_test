# stackshift-deploy-test

A tiny Node.js app for checking a StackShift deploy end to end, with and without a Postgres database attached.

## Routes

| Route | What it shows |
|---|---|
| `/` | App info, and whether a database is attached |
| `/healthz` | Always 200 when the app is up (use it as the health check path) |
| `/db` | Writes a row to a `visits` table and returns the visit count, Postgres version and whether the connection uses TLS. Returns 503 when no database is attached |

## Deploy settings

- Runtime: Node 24 (from `engines` in `package.json`)
- Install: `npm ci`
- Start: `npm start`
- Health check path: `/healthz`
- Port: the app listens on `0.0.0.0:$PORT`

## Test plan

1. Deploy with no database. `/` and `/healthz` return 200, and `/db` returns 503 with `"attached": false`.
2. Attach a Postgres database and redeploy. `/db` returns 200 with `"attached": true`, and the visit count goes up on each request.

The app reads `DATABASE_URL`. When `PGSSLROOTCERT` is set it verifies the server against that CA; otherwise it uses TLS whenever `PGSSLMODE` is set to anything other than `disable`.

## Run locally

```bash
npm ci
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/postgres npm start
```
