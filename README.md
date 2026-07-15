# Kampung Calls

An interactive Three.js neighbourhood mission set across a stylised Singapore. Make your rounds, help six neighbours, and bring the kampung back together.

## Run locally

Node.js 20 or newer is required. No third-party development dependencies are needed.

```sh
npm ci
npm run dev
```

Open `http://127.0.0.1:4173`. Set `PORT` to use another port.

## Quality checks

```sh
npm test
```

This validates HTML and asset references, the scenario/work-order contract, diagnostic choices and feedback, transitional performance budgets, JSON, and basic formatting. Pull requests and pushes to `main` run the same checks in GitHub Actions.

The application continues to deploy from `kampung-post.html`; `/` rewrites to `/kampung-post` on Vercel. See [docs/COMMERCIAL-READINESS.md](docs/COMMERCIAL-READINESS.md) for the remaining enterprise launch gates.
