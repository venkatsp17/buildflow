# Tracker

Monorepo base setup:
- `backend/` — Go + Gin API, GORM/Postgres, JWT auth. Runs as a normal HTTP server locally and as an AWS Lambda (via API Gateway) in production.
- `frontend/` — Expo + Expo Router app targeting iOS, Android, and web from one codebase.

## Local development

1. **Database**
   ```
   docker compose up -d
   ```
   Starts Postgres on `localhost:5433` (mapped from the container's 5432 to avoid clashing with any native Postgres install; user/pass/db: `tracker`).

2. **Backend**
   ```
   cd backend
   cp .env.example .env
   go run ./cmd/local
   ```
   Serves on `http://localhost:8080`. On startup it connects to Postgres and auto-migrates the schema.

3. **Frontend**
   ```
   cd frontend
   npm install
   cp .env.example .env
   npx expo start
   ```
   Press `w` for web, or scan the QR code with Expo Go for a device. Make sure `EXPO_PUBLIC_API_URL` in `frontend/.env` points at the backend (use your LAN IP instead of `localhost` when testing on a physical device).

## Deploying the backend (AWS Lambda via SAM)

**First, a one-time IAM bootstrap** (needs your root/admin session): see
[`backend/iam/README.md`](backend/iam/README.md). It creates a scoped deploy
user (and the CloudFormation execution role it's allowed to hand off) so
routine deploys never need root credentials again.

Database is [Supabase](https://supabase.com) Postgres, not RDS — create a free
project there first, then grab the **pooled** connection string (Connection
Pooling → Transaction mode, port `6543`, not the direct `:5432` one) from
Project Settings → Database.

```
cd backend
sam build
sam deploy --guided --profile buildflow-deploy --parameter-overrides DatabaseUrl='postgres://...:6543/postgres?sslmode=require'   # first time only; creates samconfig.toml
```

Subsequent deploys: `sam deploy --profile buildflow-deploy` (the `DatabaseUrl` override is remembered in `samconfig.toml` — avoid committing that file if it captures the connection string in plaintext; keep it in `.gitignore` or pass `--parameter-overrides` explicitly each time instead).

`template.yaml` provisions: the Lambda function (no VPC — it talks to Supabase over the public internet via TLS, so no NAT Gateway is needed either), an HTTP API in front of it, and a Secrets Manager secret holding the JWT signing key. See comments in `backend/template.yaml` for details.

To test the Lambda entrypoint locally before deploying:
```
cd backend
sam build
sam local start-api
```

## Deploying the frontend (EAS Build + auto-updating via EAS Update)

Native builds (the actual installable app) go through EAS Build/Submit as usual:
```
cd frontend
eas build --profile production --platform android
eas submit --profile production --platform android
```
For a small internal team, submit to Google Play's **Internal Testing** track
(up to 100 testers via an email allowlist, no public listing, near-instant
review) rather than full production.

JS/asset-only changes after that don't need a new build or store review —
`.github/workflows/eas-update-production.yml` publishes an EAS Update to the
`production` channel automatically on every push to `main` that touches
`frontend/`, and it reaches all installed builds within the app's normal
update-check interval. Requires a repo secret **`EXPO_TOKEN`** (Settings →
Secrets and variables → Actions): generate one at
https://expo.dev/accounts/[your-account]/settings/access-tokens.

Two things to keep in mind:
- The `production` channel/branch only exists once you've run an
  `eas build --profile production` at least once — do that before expecting
  the workflow's updates to reach anything.
- `runtimeVersion` uses the `"appVersion"` policy (set by `eas update:configure`),
  meaning OTA updates are only offered to installs whose native `version` in
  `app.json` matches. If you ever add a native module or other change that
  needs a new binary, bump `version` and ship a new build — don't rely on the
  auto-update workflow to carry native changes, it can't.

## Environment variables

See `.env.example` at the repo root for an overview, and `backend/.env.example` / `frontend/.env.example` for the values each app actually reads.
