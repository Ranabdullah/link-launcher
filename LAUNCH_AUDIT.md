PROJECT: DreamsLab Link Launcher 2.0 — web only

CURRENT STATE: Web app and Cloudflare migration implemented and tested locally. Prepared changes are not pushed or deployed. Remote migration and public launch remain pending account access and current production export.

DEPLOYMENT TARGET: Cloudflare Workers Free + D1, account `2bd585fdb9252b0687c939a434d19886`, requested email `abdullahinayat24@gmail.com`. Render remains in place until transfer verification. See `CLOUDFLARE_MIGRATION.md` for exact current status and cutover steps.

COMMERCIAL MODEL: Personal link manager; no pricing, payments, subscription entitlement or sales promise currently implemented. Decide whether to keep it free/open source or offer a supported paid service before adding billing.

## 🔴 LAUNCH BLOCKERS

- **Cloudflare account mismatch.** Local Cloudflare implementation, runtime/API/browser tests and deployment dry run pass. The authorized Wrangler login still belongs to a different account and cannot access the user-supplied target. No Cloudflare remote database or Worker was created. Sign in with the requested account before verifying Workers Free and publishing.
- **Latest source export and transfer still pending.** All five preserved local records migrated into local D1 with exact fingerprint verification. They are not established as the latest cloud records. Render read-only production access remains forbidden; a fresh production export, write freeze and post-import verification are required. The dashboard screenshot shows database expiry on 13 October 2026. Do not delete Render or reset existing accounts.

- **Live deployment and database are unverified.** Render returned “not found” for service `srv-dajgffnqj5pc73dhla8g` and “forbidden” for database `dpg-dajgev7qj5pc73dhjbgg-a`. The connected workspace listed no services. The public API health probe also timed out; this is not proof of permanent failure. Connect the owning Render account or use its dashboard. Deploy and validate the real PostgreSQL path; local tests exercised the real API with isolated development file storage.
- **Durable storage must be confirmed.** The old Blueprint created a free Render PostgreSQL instance. Free Render PostgreSQL expires after 30 days, so it cannot be assumed to hold permanent account data. Inspect the supplied database's actual plan, expiry and backup status. The revised Blueprint requires an explicitly configured database URL and does not provision another temporary database. [Render free-tier limits](https://render.com/docs/free)
- **Private account data was tracked in Git.** `server/data/vaults.json` contained five account records, including encrypted vaults, email identifiers and authentication hashes. It has been removed from tracking and is ignored; the local file was preserved. This does not purge previously pushed commits. Review exposure, remove historical copies from both relevant repositories/backups/releases, and assess password/credential changes for affected accounts. No private records were copied into audit output or the public build.
- **Customer trust requirements are unfinished.** Before selling or collecting customer data publicly, provide reviewed Privacy/Terms wording and a real support/contact method. Explain hosted encrypted data, email identifiers, browser caches, deletion, offline limitations, and irreversible master-password loss. No legal terms or business identity were invented. There is no checkout, license/entitlement system or pricing promise to audit as working.

## 🟠 IMPORTANT

- **Fixed locally:** Gmail-style desktop list and mobile drawer navigation; touch-visible actions; up/down ordering; bulk star/delete/device assignment; working account-label/cloud dialogs; direct link validation; optional label assignment; drawer form submission; stars/tags persistence; encrypted backup import/export; local reset; account deletion; consistent cloud/offline/conflict status.
- **Offline/device behavior:** A browser installation has its own persistent random device ID. New links are assigned here; All devices contains the signed-in account's links. Different browsers/cleared storage are different devices. Browsers cannot detect or switch installed Chrome profiles. Offline functionality covers the manager and saved link information, not the external websites.
- **Sync protection:** Saves are serialised; offline dirty/version metadata survives reopening. Sign-in preserves pending local changes. Stale updates return a conflict and keep local data. Reloading the cloud version warns before replacement. This is explicit conflict handling, not automatic merging; export a backup before choosing which copy to retain.
- **Security changes:** Removed Electron, native launch/update paths and personal hardcoded profile mappings. Removed the old separate Gist token/cloud system. Public files use a build allowlist; server source/data and installer paths return 404. URLs accept HTTP/HTTPS only; dynamic labels/categories are escaped for their actual contexts. Master passwords and cloud tokens remain in memory. Local vault data is encrypted. Logout revocations persist, and old tokens cannot access a deleted/recreated account. Account reads/writes are tied to token identity; database queries are parameterised and writes compare versions atomically. Production requires a stable secret and database, with no file-store fallback.
- **Deployment checks still required:** Confirm Node 22+, build/start commands, exact frontend origins, HTTPS, database TLS trust, production secret and backups. Deploying the session change requires users to sign in again. Keep database credentials only in server environment settings.
- **Authentication limits:** Email is a vault identifier; there is no verification email, password-reset email or recovery flow. Lost master passwords cannot decrypt old vaults. The server's auth limits are per-process; use shared limiting if scaling beyond one instance. Do not advertise verified identities or recovery that does not exist.
- **Browser accessibility:** Native category buttons, input labels, focus outlines and keyboard primary navigation are present. More complete screen-reader, focus-trap and real Safari/iOS/device testing remain important before commercial accessibility claims. Automated browser tests used Chrome with phone/tablet viewport sizes, not physical phones.
- **Operational visibility:** `/api/health`, Render logs and deployment health checks are sufficient for initial personal use. Add a simple availability alert before promising customer uptime. Analytics is unnecessary for core operation, and no analytics/email/payment service was added.
- **Frontend hardening:** Existing inline event handlers require an inline-script allowance in CSP. Tested user inputs do not execute as code; a future move to external event listeners would allow a stricter policy. Do not describe the present CSP as strict.
- **Repository cleanup:** Desktop launchers, duplicate HTML, installer manifests, outdated desktop tests, old marketing images and Electron packaging dependencies were removed. Ignored legacy desktop binaries/build folders were moved outside the maintained project to `F:\AntiGravity\Apps Data\Link Launcher legacy desktop archive 2026-10-01` as a recoverable archive. Historical remote releases/commits need separate cleanup; installed executables on users' PCs were not uninstalled.

## 🟢 OPTIONAL

- A public landing page, pricing page and genuine demo/screenshots/video once the commercial model is decided. The private app itself does not need a sitemap, fabricated schema or canonical URL before its real public host is known. It already has a descriptive title, metadata, favicon, manifest, robots exclusion for API routes and a server 404.
- OAuth/email verification and a separately designed recovery scheme if required by the product. Master-password recovery must account for encryption; an email reset alone cannot restore encrypted data.
- Stricter CSP via external event listeners, fuller keyboard/screen-reader coverage, richer conflict merging and optional monitoring if usage justifies them. No visual component library or gradient dependency is needed for this layout.

## 💰 COST

| Required component | Expected availability / limitation |
| --- | --- |
| Target Cloudflare Workers + D1 | Free within quotas: 100,000 API requests/day, 500 MB per database, 5 million rows read/day and 100,000 rows written/day. Target account plan and remote access still need verification. No paid upgrade enabled. [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [D1 limits](https://developers.cloudflare.com/d1/platform/limits/), [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/) |
| Web app assets, PWA installation, offline cache | No added service fee or installer license |
| Existing Render Node.js service | Free web tier is available for hobby/testing use, subject to quotas and idle cold starts; Render advises against free instances for production promises. Existing service plan could not be read. [Render limits](https://render.com/docs/free) |
| Durable PostgreSQL | Existing Render database price/expiry is unknown. Its free plan expires after 30 days. A durable paid Render plan requires an explicit pricing decision, or use an approved non-expiring alternative. |
| Supabase PostgreSQL alternative | Free tier currently advertises 500 MB database and two active projects, with pausing after one week of inactivity. Could back the existing API through a server-only connection URL after project selection, migration and access hardening; not provisioned or integrated as a browser service here. [Supabase pricing](https://supabase.com/pricing) |
| GitHub source hosting | Existing repositories; no additional integration or paid GitHub feature required by this change |
| Domain, analytics, email, payments | None required for personal use. Not added. Costs depend on future sales decisions. |

€0/month personal/testing operation may be achievable within provider limits after choosing durable storage. Permanent customer hosting at €0/month is not verified, and no paid resource or billing upgrade was created.

## 🚀 LAUNCH CHECKLIST

- [x] Implement Cloudflare API/D1, large-vault chunks, atomic version protection and native edge rate limits.
- [x] Test Cloudflare original account compatibility, mutations, isolation and PC/mobile/offline browser flows.
- [x] Export all five preserved local records and verify exact migration into local D1.
- [x] Validate Cloudflare deployment with a dry run.
- [ ] Authenticate the requested Cloudflare account, confirm Workers Free, and create its empty D1 destination.
- [ ] Export latest Render records, freeze source writes, import and compare destination fingerprints.
- [ ] Deploy to Cloudflare, verify existing sign-in, switch origins and test live sync/install/offline behavior.

- [x] Implement web-only desktop/mobile interface and remove maintained EXE/Electron packaging.
- [x] Build installable PWA assets with same-origin offline caching and local icons.
- [x] Test desktop/mobile CRUD, ordering, selection, labels, search, editing, large-vault encryption and encrypted export/import.
- [x] Test distinct device scopes, offline reload/edit/reopen/reconnect and multi-device conflict preservation.
- [x] Test API ownership, duplicate registration, wrong passwords, input validation, version conflicts, token revocation, deletion and old-token rejection after account recreation.
- [x] Verify public build asset routes; deny source/data/environment/installer paths and unknown routes.
- [x] Audit root and server production dependencies: zero reported vulnerabilities in current lockfiles.
- [ ] Connect the Render account that owns the supplied resources; confirm service repository/branch and database plan/expiry.
- [ ] Export a production database backup and user vault backups before rollout.
- [ ] Review historical exposure and purge sensitive Git history safely; assess affected credential changes.
- [ ] Review prepared changes in GitHub Desktop; push only when authorized. The Cloudflare CLI can deploy local reviewed assets without a Git push.
- [ ] Verify the deployed PostgreSQL path with two test accounts: sign-in on two devices, account isolation, edit/delete/order, logout, offline reopen, reconnect, conflict and backup restore.
- [ ] Verify real PC installation and phone Add to Home Screen, HTTPS, update delivery and offline reopening.
- [ ] Complete real support/contact information and reviewed customer policies before public/customer launch.
- [ ] Choose a commercial model before advertising paid features; implement/test billing only if selling subscriptions requires it.

FINAL TEST: Local build succeeded. Real API integration tests passed. Chrome desktop/mobile browser tests passed at widths 320, 390, 768, 1024 and 1440; screenshots were inspected. Browser flows included encrypted export/import, offline edits preserved across reopening, reconnect upload, multi-device conflict retention, labels/category injection checks, unsafe URL rejection, large-vault encryption and lock removing plaintext rows. Root/server production dependency audits reported zero vulnerabilities. Live Render deployment, PostgreSQL durability/migration and physical-device installation remain unverified.

Cloudflare verification added: API/runtime and full Chrome desktop/mobile flows passed against local Workers/D1. All five preserved local accounts imported into local D1 with exact account-field/encrypted-byte fingerprint matching. Deployment dry run passed. This does not establish a successful remote production transfer or verify free CPU limits under live load.

Exact remaining actions: sign in to the requested Cloudflare account and confirm Workers Free; obtain and back up latest Render production data; freeze old-host writes, create an empty D1 destination, import and verify fingerprints; deploy and verify existing sign-in; switch origins and run live/physical-device checks; review historical exposure; provide policy/support/commercial decisions only if publicly launching. No remote push, deployment, billing upgrade or source deletion was performed.
