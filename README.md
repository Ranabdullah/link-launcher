# DreamsLab Link Launcher — web app

An installable, Gmail-style link manager for computers and phones. There is no Windows executable, Electron dependency, protocol installer or desktop release pipeline.

## Use the app

Create a cloud account with an email identifier and a master password of at least 12 characters. Sign in with the same details on other devices. The master password encrypts the vault in your browser; the API receives a derived authentication verifier and encrypted vault, not your master password or readable links.

The email is an account identifier, not a verified Google identity. Account labels organise links; they do not switch the browser's Google or Chrome login.

- **This device:** links saved or assigned in this browser. A fresh browser has a fresh device ID.
- **All devices:** every link in the signed-in account. Use **+ Device** or select links and **Add to this device** to show existing links here.
- **↑ / ↓:** reorder the current device's list in All Links with filters cleared. Stars and priorities are filters; they do not silently override your order.
- **Offline:** reopen the previously loaded app, enter your master password, and manage encrypted cached links. First-time installation and cloud account creation require internet. External linked websites have their own internet requirements.
- **Sync:** offline changes persist locally and retry after reconnecting while signed in. Reopening offline requires signing in online to reconnect the cloud session. Conflicts preserve local changes; export a backup before choosing to replace them with the cloud vault.
- **Local-only:** explicitly create/open a vault without registering a cloud account. Later, Create Account with the same email/password uploads that local vault when no cloud account exists. For an existing cloud account, use backup/import after signing in.
- **Installation:** use Chrome/Edge's Install app action on a PC, or the phone browser's Add to Home Screen action. HTTPS is required outside localhost. Updates arrive through the service worker; save and close all app windows, then reopen when an update is ready.
- **Backup:** export `.dlvault`, protected by your master password. Import replaces the account vault and asks for confirmation. Plain JSON export is explicitly confirmed because it is readable.
- **Deletion:** the Cloud account dialog deletes the cloud account. Cached copies on other offline devices need clearing separately. Reset Local Device removes browser copies only; export unsynced work first.

The master password is kept in memory only while unlocked. There is no email/password recovery flow. Losing the master password loses access to encrypted backups and links. Keep it safely.

## Local development

Use Node.js 22 or newer:

```text
npm ci
npm start
```

Open `http://localhost:3000`. Development uses `server/data/vaults.json`, ignored by Git. Tests use temporary isolated databases and never modify your saved vaults.

```text
npm run build
npm test
```

`npm run test:web` needs Playwright and installed Chrome, supplied by the Codex workspace runtime during this task. The app itself has no browser automation or frontend framework dependency. Browser screenshots are generated in ignored `test-results/`.

`scripts/generate-icons.cjs` is an optional design helper requiring Sharp. PNG icons are already committed; normal builds do not need Sharp.

## Deploy on Cloudflare Free

Cloudflare Workers serves the app and account API; D1 stores account verifiers and encrypted vaults. The target account is `2bd585fdb9252b0687c939a434d19886`, supplied by the owner for `abdullahinayat24@gmail.com`. No domain purchase, paid Workers upgrade, R2 or other paid product is required. Stay on Workers Free: quotas can stop service, and this is not unlimited hosting.

See [CLOUDFLARE_MIGRATION.md](CLOUDFLARE_MIGRATION.md) for the current access blockers and exact transfer sequence. Cloudflare code, API tests, browser tests, migration and a deployment dry run passed locally. No remote Cloudflare database or Worker was created: the authorized CLI login still belongs to a different account and cannot access the requested account. Render production export remains inaccessible.

```text
npm run cloudflare -- login --device --browser=false --scopes account:read user:read workers:write workers_scripts:write d1:write
npm run cloudflare -- whoami --json
npm run cloudflare:check
npm test
npm run test:cloudflare:web
```

Cloudflare credentials are isolated in ignored `.cloudflare-auth/`; this does not replace other projects' global Wrangler login. Migration snapshots and SQL containing private account identifiers/authentication hashes are kept in ignored `migration-private/`. Never upload these as static assets or commit them. Only `web-dist/` is published.

The default `MIGRATION_PENDING=true` setting prevents registration, cloud vault writes and account deletion until the transfer is verified. Existing imported accounts can sign in and read their vaults; offline local changes stay in their browser. Disable it only after a fresh Render export is imported and verified, source writes are stopped, and the cutover is ready.

Cloudflare runtime tests use real local Workers/D1, including original verifier compatibility, concurrent writes, multi-chunk vaults over 2 MB, token revocation and account deletion. Browser tests use isolated databases. The offline cache version is now v3.

## Existing Render service (retained during transfer)

The existing architecture is Render Node.js + PostgreSQL. Firebase and Supabase Auth are not configured. Do not put database URLs, service secrets or passwords in frontend files.

1. Back up the current production database and export user vaults before changing hosting.
2. Review/commit/push the prepared changes using GitHub Desktop. Check the remote: local `origin` is `Ranabdullah/link-launcher`, while `upstream` is `abdullahinayat24-lang/link-launcher`. Confirm which repository the Render service actually deploys. This task did not push or deploy.
3. On the existing Render service, use root directory `server`, build command `npm ci --omit=dev && node ../scripts/build-web.cjs`, start command `node server.js`, and health check `/api/health`. If deploying from repository root, use `npm ci && npm run build`, then `node server/server.js`.
4. Set `NODE_ENV=production`, a stable random `JWT_SECRET` with at least 32 characters, and `DATABASE_URL` for a durable PostgreSQL database. Configure `ALLOWED_ORIGINS` for the exact HTTPS app origins if serving the frontend separately. The built app and API can share the Render service URL.
5. Keep TLS verification enabled. If your database provider requires its own CA, configure the connection trust appropriately; do not disable certificate verification to hide an error.
6. Deploy, check that `/api/health` reports PostgreSQL connected/schema ready, and run the live checks in `LAUNCH_AUDIT.md`.

The server keeps the existing `users` table and adds a `revoked_tokens` table for logout. Existing legacy sessions need a new sign-in. Private local vault data has been removed from Git tracking; five local accounts were preserved on disk. Previously committed data still exists in Git history until separately purged.

The public build uses an explicit asset allowlist (`web-dist/`). No repository files, server source, private database, credentials or installers are served. Bump the cache version in `sw.js` for each release with changed app assets.

Render free PostgreSQL expires after 30 days. Do not rely on it for permanent customer data. A Supabase PostgreSQL database can be connected to this backend through its server-only connection URL after selecting/authorizing the project; it needs a private schema or RLS/revoked Data API grants before reuse. No Supabase or Firebase project was provisioned here. See current provider pricing before choosing a plan.

## Launch status

Read `LAUNCH_AUDIT.md`: local app and API flows verified, live Render/PostgreSQL deployment unverified, commercial launch blocked by database durability/access, history exposure cleanup and customer-facing policy/support decisions.
