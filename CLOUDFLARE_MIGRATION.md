# Cloudflare migration — completed 2 October 2026

Live app: https://link-launcher.ranakaharian1.workers.dev
Owner: ranakaharian1@gmail.com
Cloudflare account: 4dddb56c05af56a431914f2cb7f48eb4
D1: link-launcher-vault / 2ea49342-0c59-4ce2-abc4-a671e5db0b75
Plan: Workers Free, verified in the account dashboard. No paid upgrade, domain purchase or Render deletion.

The fresh Render PostgreSQL export contained one account. It was taken after installing a reversible trigger preventing writes to the old users table. Original account identifiers, authentication salt/hash, timestamps, version and encrypted vault bytes were transferred and verified by this combined SHA-256 fingerprint:

49bf28b9c34dd45946f5be41f13564af4fd17a90b505db9d3ae195b6bb1ad699

The private production backup is `migration-private/transfer-2026-10-02T22-16-15-965Z.json` with its SQL sidecar. These and the private Render connection file are ignored and excluded from public assets/sales archives. Preserve encrypted backups securely. The older five-account local backup was not substituted for current production data.

The Worker was deployed with `MIGRATION_PENDING=true` during verification, then enabled with false. A fresh private JWT_SECRET was set directly on Cloudflare. Existing passwords did not change. Migration deployment version: 5d103be1-9101-4884-b851-33510b7bb5da. The obsolete Render frontend fallback was removed. The 3 October profile-selection update is deployed as abfdf725-4b61-4cd9-a39a-0b3c2d3fcfba with shell cache v5.

## Verification

- HTTPS app and `/api/health` return 200; D1 connected, schema ready, migrationPending false.
- Served frontend has no `storeSecureSession` call or Electron/DPAPI requirement.
- Live disposable-account tests passed registration, wrong-password rejection, login, read/save, stale-write protection, logout revocation and cleanup.
- Original account/encrypted-byte fingerprint was checked after cleanup and still matches the source.
- Private environment, migration, source and account-data paths return 404.
- The owner must personally verify readable links with their password; the agent did not use it. Choose All devices on the new browser origin.
- Local tests cover PC/phone, offline edits/reopening, ordering, labels, backups and conflicts. Physical-device installation and maximum-vault performance at the free CPU limit remain owner checks.

## Use the new address

Sign in with the existing vault email/master password. Do not create a replacement account. Use **Choose profiles for this device**, name the browser installation, select the profiles used here and save. **This device** shows their existing/future links alongside individually saved/assigned links; **All devices** keeps every account link. Other browser installations have independent selections. Browser data removal requires choosing again; the web app does not detect Chrome profiles. Install with the browser's Install app/Add to Home Screen action. Old-origin unsynced browser storage does not move automatically; export/import an encrypted backup first when needed.

Render is preserved but read-only. Its dashboard reports expiry on **13 October 2026**. It is no longer the active cloud store. Reversible freeze control is `scripts/cloudflare-source.cjs`. Do not simply resume old writes: after the new host changes, the old snapshot is stale. A rollback requires a new Cloudflare backup, write freeze and verified reconciliation before switching hosts.

Free limits include 100,000 Worker requests/day, 5 million D1 rows read/day, 100,000 written/day, 500 MB per database and 5 GB total D1 storage. CPU/platform limits apply. Quotas can pause sync. [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/) and [limits](https://developers.cloudflare.com/d1/platform/limits/).

## Code and sales edition

Origin: https://github.com/Ranabdullah/link-launcher. At the start of this turn, main contained the web implementation at 88aa537. Old Render upstream https://github.com/abdullahinayat24-lang/link-launcher remained at f1ef696. This turn's account/config/licensing changes are local for review; no Git push was made.

The commercial download is a clean separate edition with no owner database binding or credentials. Buyer instructions and signed activation are included. Signing keys stay in ignored `seller-private/`. The personal live app uses the migrated account backend; the sales edition adds browser/account licence checks. See `commercial/SELLER-GUIDE.md` for fulfilment and limitations.
