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

```
cd backend
sam build
sam deploy --guided   # first time only; creates samconfig.toml
```

Subsequent deploys: `sam deploy`.

`template.yaml` provisions: the Lambda function, an HTTP API in front of it, an RDS Postgres instance + RDS Proxy, and a Secrets Manager secret holding DB credentials. See comments in `backend/template.yaml` for details.

To test the Lambda entrypoint locally before deploying:
```
cd backend
sam build
sam local start-api
```

## Environment variables

See `.env.example` at the repo root for an overview, and `backend/.env.example` / `frontend/.env.example` for the values each app actually reads.
