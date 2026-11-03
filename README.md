# Foreign Exchange Management System — Frontend

A Vue 3 + Vite frontend prototype for foreign-exchange bureau operations. The codebase uses the **Composition API** in Vue single-file components, **Pinia** for shared application state, and a service layer for backend communication.

> **Important:** The current screens and demo data are a prototype, not a production financial system. Authentication, authorization, KYC/AML decisions, NBE limits, rates, approvals, ledger postings, and audit evidence must be enforced and persisted by a trusted backend. Never treat client-side checks as compliance controls.

## Features in the demo
- Role-oriented operations console for administrator, teller, supervisor, compliance, branch manager, and finance/audit.
- Trading, customer/KYC, rate approval, vault/till, reconciliation, reversals, ledger, and governance views.
- Pinia store for shared session/navigation state.
- API service foundation with consistent JSON handling, timeout support, and normalized errors.
- Environment configuration through Vite `VITE_*` variables.

## Requirements
- Node.js 18+ (Node.js 20 LTS recommended)
- npm 9+
- Access to the API backend for live data (optional for the sample-only demo)

## Installation
```bash
git clone https://github.com/tadiosgb1/Foreign-exchange-Management-frontend.git
cd Foreign-exchange-Management-frontend
npm install
cp .env.example .env
npm run dev
```

Open the local URL printed by Vite (normally `http://localhost:5173`). If your environment uses a different port, use the URL shown in the terminal.

## Environment variables
Copy `.env.example` to `.env` and set the values for your environment:

| Variable | Purpose | Example |
| --- | --- | --- |
| `VITE_API_BASE_URL` | Backend API base URL | `http://localhost:8080/api/v1` |
| `VITE_API_TIMEOUT_MS` | Request timeout in milliseconds | `15000` |
| `VITE_APP_NAME` | Display/application label | `FX Control` |

Vite exposes `VITE_*` variables to browser code. **Never put passwords, private keys, database credentials, signing secrets, or privileged API tokens in these variables.** Keep real secrets on the server.

## Scripts
- `npm run dev` — start the local development server.
- `npm run build` — create the production bundle in `dist/`.
- `npm run preview` — preview the production bundle locally.

## Project conventions
- **Vue:** prefer `<script setup>` and Composition API (`ref`, `computed`, composables).
- **State:** shared cross-view state belongs in Pinia stores; transient form state can remain local to a component.
- **Services:** API calls live in `src/services/`, not in templates or UI event handlers.
- **Errors:** surface safe, actionable messages; never display raw stack traces or sensitive server responses.
- **Money:** use integer minor units or decimal-safe server representations; do not rely on binary floating-point for authoritative calculations.
- **Security:** backend must validate every request, enforce RBAC, maker-checker separation, idempotency, transaction limits, and immutable audit logging.
- **Production:** replace demo login and in-memory sample operations with backend-backed flows before deployment.

## Service layer
`src/services/apiClient.js` provides a reusable fetch wrapper. Domain services should be added alongside it (for example, `trades.js`, `rates.js`, `customers.js`, `vault.js`, `reconciliation.js`, and `reports.js`) as corresponding backend endpoints become available. API paths and response schemas must match the backend contract.

## Suggested production checklist
- [ ] Connect the backend and document its OpenAPI contract.
- [ ] Implement server-side authentication, refresh/session expiry, and authorization.
- [ ] Enforce maker-checker approval and separation of duties on the server.
- [ ] Add unit/component/e2e tests and CI build checks.
- [ ] Add accessibility, responsive, and browser testing.
- [ ] Configure CSP, secure headers, HTTPS, dependency scanning, and release environments.
- [ ] Verify reconciliation, reversal, idempotency, decimal arithmetic, and audit trails with finance/compliance owners.

## Demo credentials
The current prototype displays sample role-based access. Password `demo123` is for demonstration only and must not be reused or enabled in a production deployment.
