# Cloud Vault API

Web-only Node.js/Express service. It serves the reviewed `../web-dist` build and an authenticated encrypted-vault API.

Run `npm ci && npm start` from this directory. Production requires `NODE_ENV=production`, a durable `DATABASE_URL` and a stable random `JWT_SECRET` of at least 32 characters. See the root README for Render deployment and backups.

| Route | Behaviour |
| --- | --- |
| GET /api/health | Health/storage status; no secrets or database connection errors |
| POST /api/auth/register | Create account using a derived authentication verifier and encrypted vault |
| POST /api/auth/login | Authenticate and return token, encrypted vault and version |
| POST /api/auth/logout | Revoke the current token |
| GET /api/vault | Read only the signed-in account's vault |
| POST /api/vault | Atomic version-checked update; stale version returns 409 |
| DELETE /api/account | Delete the signed-in account and its encrypted cloud vault |

Tokens expire after 24 hours, are tied to the account creation timestamp, and remain in browser memory. Logout revocations are persisted. Recreating a deleted email account does not restore validity to its old tokens.

Client master passwords are never transmitted. Auth verifiers are hashed with a random server salt. TLS, backups and protecting the server environment remain necessary. There are no payments, emails, file uploads or analytics integrations.

Production never falls back to filesystem data. Development file data is private and ignored by Git. All account lookup/write operations use parameterised PostgreSQL queries. Rate limits are per-process: suitable for the current single-instance deployment, with shared limiting needed before horizontal scaling.
