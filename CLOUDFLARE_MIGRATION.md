# Link Launcher Cloudflare transfer

Current status, 1 October 2026: implementation and local verification complete; remote transfer pending access. No paid plan, remote database, remote Worker, Git push or Render deletion was performed.

The local preview at `http://localhost:4173/` now runs the Cloudflare backend against the verified five-account local D1 copy, bound only to this computer. Cloud writes, new registrations and deletion are held while the migration is pending; existing accounts can be tested with their own password. This is still a local preview, not a live cloud transfer.

## Verified locally

- Cloudflare Workers API and D1 schema retain original account identifiers, PBKDF2 verifier hashes, timestamps, vault versions and encrypted vault bytes. Passwords are not requested or reset. Legacy opaque payloads are also retained unchanged; retaining them does not guarantee an old malformed/test payload can be decrypted.
- Vaults are stored in chunks to support the app's 15 MB request limit despite D1's 2 MB row limit. Each save commits metadata and chunks in one atomic batch. Concurrent stale writes cannot overwrite the winning version.
- Account isolation, validation, wrong credentials, duplicate registration, logout revocation, deletion/recreation, shared edge rate limits, cross-origin rejection and private-file denial passed Workers/D1 tests.
- Actual Chrome desktop/mobile flows passed against Workers/D1: CRUD, ordering, labels, search, device scope, offline reload/edit/reopen, reconnect, conflicts, encrypted export/import and lock. Widths: 320, 390, 768, 1024 and 1440.
- All five records in the preserved local backup were imported into local D1. Verification compared the SHA-256 fingerprint of every account's preserved fields and encrypted bytes: exact match. This backup is not established as the latest Render production data.
- Wrangler deployment dry run passed. Production dependencies reported zero vulnerabilities.

## Access blockers

1. Target Cloudflare account: `2bd585fdb9252b0687c939a434d19886`, requested email `abdullahinayat24@gmail.com`. Wrangler authorization completed as `ranakaharian1@gmail.com`, which only has account `4dddb56c05af56a431914f2cb7f48eb4`. The target account API rejects this login. Sign out of Cloudflare in the authorization browser, sign in to the requested account, then authorize a new Wrangler login. Check `whoami --json` before any remote writes.
2. Render production database `dpg-dajgev7qj5pc73dhjbgg-a`: read-only query still returns forbidden. Either reconnect the owning Render workspace or supply the external PostgreSQL connection through a private local environment variable. Do not paste database credentials into chat, source files or the public frontend.
3. Screenshot shows Render database expiry on **13 October 2026**. Back up and complete the cutover before expiry. Retain Render until migration and real sign-in are verified.

## Cutover sequence after access is restored

1. Confirm that the exact target Cloudflare account uses **Workers Free** in its Workers plans page. Do not enable paid billing. The project uses only static assets, Workers, D1 and native rate-limit bindings.
2. Export the current Render database with the read-only export tool. Privately set its external `DATABASE_URL` in your terminal, then run:

   ```text
   node scripts/cloudflare-migrate.cjs export
   ```

   This takes a read-only repeatable-read snapshot and creates a timestamped JSON backup and SQL file under ignored `migration-private/`. No emails, hashes or ciphertext are printed. A local-file export is also supported, but must not silently replace a newer production export.

3. Create a new empty destination:

   ```text
   npm run cloudflare -- d1 create link-launcher-vault
   ```

   Set the returned database ID in `wrangler.jsonc`, replacing the all-zero placeholder. Keep the original account ID. Apply the schema:

   ```text
   npm run cloudflare -- d1 migrations apply link-launcher-vault --remote
   ```

4. Stop saves to the old host during the final transfer. Take a fresh export after saves stop. Keep a complete source backup. Import that snapshot into the empty destination:

   ```text
   node scripts/cloudflare-migrate.cjs import migration-private/transfer-TIMESTAMP.json
   ```

   The importer refuses nonempty destinations. It regenerates SQL from the fingerprint-checked backup and verifies account count, authentication fields, metadata and encrypted bytes after import. On failure, do not switch hosts; preserve the source and inspect the destination. No automated overwrite/merge is performed.

5. Generate a fresh random secret of at least 32 characters, store it privately as the Worker `JWT_SECRET`, and keep it stable. New host sessions require a new sign-in; account passwords and encryption keys are unchanged.

   ```text
   npm run cloudflare -- secret put JWT_SECRET
   npm run cloudflare:deploy
   ```

   Keep `MIGRATION_PENDING=true` for initial read-only verification. Test existing user sign-in on the new host and confirm encrypted links open. Do not create replacement accounts. A separate local Miniflare fixture exercises test-account mutations; avoid altering real accounts to test writes during the freeze.

6. When source snapshot and new-host checks are verified, set `MIGRATION_PENDING=false`, deploy again, and switch clients to the new HTTPS Worker URL. Check `/api/health`, two-device sync/conflicts, logout, installation, updates, encrypted backup restore and offline reopening. Do not keep editing both hosts.

7. Old-origin browser storage does not move automatically. Export unsynced work from the old app before switching; new-host sign-in downloads transferred cloud data, with a new browser device ID. Existing transferred links appear under **All devices** and can be assigned to this browser. Keep the old database and migration backup until the transition is proven. Render deletion is a separate explicit action.

## Free-plan limits

Current published limits include 100,000 Worker requests/day, 500 MB per D1 database, 5 million rows read/day and 100,000 rows written/day. Static asset delivery is free; API calls consume Worker quotas. Free CPU limits also apply, so high-load/large-vault performance needs live verification. Reaching quotas can interrupt sync; it does not make hosting unlimited. Offline encrypted copies remain available.

Sources: [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [D1 limits](https://developers.cloudflare.com/d1/platform/limits/), [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [static asset billing](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/).
