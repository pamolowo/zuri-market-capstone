# Zuri Market Frontend

React + Vite single-page storefront for Zuri Market. It lists products, filters by category and talks to the backend API.

Part of the [Zuri Market DevOps Capstone](../README.md). Starter code: [Test-class2026/zuriapp-frontend](https://github.com/Test-class2026/zuriapp-frontend).

## Configuration

| Variable | Default in code | Purpose |
|---|---|---|
| `VITE_API_URL` | none (empty means same host) | Base URL of the backend |
| `VITE_STORE_NAME` | `Shop` | Store name shown in the page |

Vite reads `VITE_*` values **at build time** and bakes them into the JavaScript. A Kubernetes ConfigMap cannot change them afterwards, which is why Docker takes them as build arguments.

`App.jsx` resolves the API base like this:

```js
const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000";
```

`??` (not `||`) is deliberate. An **empty** `VITE_API_URL` means "call the same host", which is how the container and Kubernetes work: the Ingress routes `/api` to the backend. With `||`, an empty value fell back to `localhost:5000`, which breaks in a browser on another machine. This is the only source change made to the starter app.

Local template:

```
# .env.example
VITE_API_URL=http://localhost:5000
VITE_STORE_NAME=Zuri Market
```

## Run locally

Requires Node 22 (`nvm use`, see `.nvmrc`). Start the backend first (port 5000).

```bash
cp .env.example .env
npm install        # first time; creates package-lock.json
npm run dev        # http://localhost:3000
```

The dev server runs on port **3000** (set in `vite.config.js`), and proxies `/api` to `VITE_API_URL` (default `http://localhost:5000`).

## Scripts

| Script | Command | Notes |
|---|---|---|
| `npm run dev` | `vite` | Dev server on port 3000 |
| `npm run build` | `vite build` | Output in `dist/`. **This is the test gate**: the app has no test suite, so a successful build is required to pass CI |
| `npm run preview` | `vite preview` | Serve the built output locally |
| `npm run lint` | `eslint src` | Flat config in `eslint.config.js` (ESLint 9 + `eslint-plugin-react`) |

There is no `npm start` or `npm test` script. CI runs `npm test --if-present`, so it skips cleanly.

> ESLint is pinned to major version 9 because `eslint-plugin-react` does not yet declare support for ESLint 10.

## Docker

Multi-stage build: Node compiles the app, then `nginx-unprivileged` serves the static files on port **8080**.

```bash
docker build -t zuri-frontend:local --build-arg VITE_API_URL= .
```

| Build arg | Default | Purpose |
|---|---|---|
| `VITE_API_URL` | empty | Empty = same-origin `/api` calls |
| `VITE_STORE_NAME` | `Zuri Market` | Store name baked into the bundle |

- The runtime image has no Node, source or build tools, so it is small and has less to attack.
- It runs as a non-root user (numeric UID, which Kubernetes `runAsNonRoot` requires).
- The final stage upgrades `brotli-libs`, `curl` and `libcurl` to clear the HIGH findings Trivy reported.
- `.dockerignore` keeps `node_modules`, `dist` and `.env` out of the build context, so a local `.env` pointing at `localhost:5000` cannot leak into the image.

Check that nothing points at localhost in the bundle:

```bash
docker run --rm --entrypoint sh zuri-frontend:local \
  -c "grep -rl 'localhost:5000' /usr/share/nginx/html || echo clean"
```

### nginx

- **Docker Compose:** `nginx.conf` forwards `/api/` to `http://backend:5000` (the Compose service name) and falls back to `index.html` for single-page-app routes.
- **Kubernetes:** the nginx config comes from the `frontend-nginx` ConfigMap with no `/api` proxy, because the Traefik Ingress sends `/api` to the backend and `/` to this service.

## CI

Pull requests run `npm ci`, `npm run lint`, `npm run build`, `npm audit --omit=dev --audit-level=high`, a SonarQube scan and a Trivy scan of the built image. Merges to `main` publish `ghcr.io/pamolowo/zuri-market-capstone-frontend:sha-<7 chars>`.

## Known issues

- The **Linen throw blanket** product image is broken. The Unsplash URL in the starter backend data (`photo-1600369671854-5a77c585b49e`) no longer resolves. This is a dead link in the starter data, not a platform fault, and it is left unchanged because the brief forbids product changes.

## Troubleshooting

| Symptom | Check |
|---|---|
| `npm ci` says there is no lock file | Run `npm install` once and commit `package-lock.json` |
| `ERESOLVE` when adding ESLint packages | Keep `eslint@9` and `@eslint/js@9` |
| Page loads but API calls go to `localhost:5000` | `VITE_API_URL` is baked in at build time. Rebuild with `--build-arg VITE_API_URL=` and confirm `??` is used in `App.jsx` |
| nginx: `host not found in upstream "backend"` | Only happens outside Compose. Run with the backend on the same network, or use the Kubernetes ConfigMap config |
| Pod `InvalidImageName` or `ImagePullBackOff` | The tag in `k8s/frontend/deployment.yaml` must be a real `sha-` tag, and the GHCR package must be public |
| Pod refuses to start: `runAsNonRoot` and non-numeric user | The image must end with a numeric user (`USER 101`) |