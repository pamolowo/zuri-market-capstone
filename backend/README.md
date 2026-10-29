# Zuri Market Backend

Node.js / Express API for the Zuri Market store. Serves the product catalogue, store info and cart validation, and exposes a health endpoint and Prometheus metrics for the platform.

Part of the [Zuri Market DevOps Capstone](../README.md). Starter code: [Test-class2026/zuriapp-backend](https://github.com/Test-class2026/zuriapp-backend).

## Configuration

| Variable | Secret? | Default | Purpose |
|---|---|---|---|
| `PORT` | No | `5000` | Port the server listens on |
| `API_SECRET_KEY` | **Yes** | none | Key required by protected routes (`validateApiKey`) |
| `STORE_NAME` | No | `My Store` | Store name returned by `/api/store` |

Copy the template and edit it. `.env` is git-ignored; never commit it.

```bash
cp .env.example .env
```

```
# .env.example (fake values only)
PORT=5000
API_SECRET_KEY=local-dev-key
STORE_NAME=Zuri Market
```

In Kubernetes, `PORT` and `STORE_NAME` come from the `backend-config` ConfigMap and `API_SECRET_KEY` comes from the `backend-secrets` Secret, which is synced from AWS Secrets Manager.

## API

| Method | Route | Description |
|---|---|---|
| GET | `/api/store` | Store information |
| GET | `/api/products` | All products |
| GET | `/api/products/:id` | One product |
| POST | `/api/cart/validate` | Validate a cart. Protected: returns `401` without a valid key |
| GET | `/api/health` | Liveness and readiness probe: `{"status":"ok"}` |
| GET | `/metrics` | Prometheus metrics. Outside `/api`, so the Ingress never exposes it |

## Run locally

Requires Node 22 (`nvm use`, see `.nvmrc`).

```bash
npm install        # first time; creates package-lock.json
npm start          # http://localhost:5000
npm run dev        # with nodemon
```

```bash
curl http://localhost:5000/api/health
curl http://localhost:5000/api/products
curl -i -X POST http://localhost:5000/api/cart/validate     # expect 401
```

## Scripts

| Script | Command | Notes |
|---|---|---|
| `npm start` | `node server.js` | Production start |
| `npm run dev` | `nodemon server.js` | Development |
| `npm run lint` | `eslint .` | Flat config in `eslint.config.js` |
| `npm test` | `node --test` | Smoke test in `test/smoke.test.js` starts the server on port 5055 and polls `/api/health` |

## Metrics

The default Node process metrics plus a histogram, `http_request_duration_seconds`, labelled by `method`, `route` and `status_code`. The Grafana dashboard builds request rate, error rate and p95 latency from it.

## Docker

```bash
docker build -t zuri-backend:local .
docker run --rm -p 5000:5000 -e API_SECRET_KEY=local-dev-key zuri-backend:local
```

- Based on `node:22-alpine`; dependencies installed with `npm ci --omit=dev` in a build stage.
- npm, npx and yarn are removed from the runtime image to shrink the attack surface (they carried the HIGH findings Trivy reported).
- Runs as the non-root `node` user and starts with `node server.js` so the process receives shutdown signals directly during rolling updates.
- `.dockerignore` keeps `node_modules`, `.env` and tests out of the image.

## CI

Pull requests run `npm ci`, `npm run lint`, `npm test` and `npm audit --omit=dev --audit-level=high` (see `.github/workflows/ci.yml`), then a SonarQube scan and a Trivy scan of the built image. Merges to `main` publish `ghcr.io/pamolowo/zuri-market-capstone-backend:sha-<7 chars>`.

## Troubleshooting

| Symptom | Check |
|---|---|
| `npm ci` says there is no lock file | Run `npm install` once and commit `package-lock.json` |
| Cart route always returns `401` | `API_SECRET_KEY` must be set, and the request must send it the way `validateApiKey` expects (see `server.js`) |
| Smoke test `ECONNREFUSED` | Make sure `which node` is a Linux path (not `/mnt/c/...` in WSL); the test prints the server's output if it crashes |
| Pod `CrashLoopBackOff` | `kubectl -n zuri-market logs deploy/backend --previous`; confirm `backend-secrets` exists |
| Pod `InvalidImageName` or `ImagePullBackOff` | The image tag in `k8s/backend/deployment.yaml` must be a real `sha-` tag, and the GHCR package must be public |