# Launch audit — 2 October 2026

The personal app is live at https://link-launcher.ranakaharian1.workers.dev on ranakaharian1@gmail.com's Cloudflare Workers Free account and D1. Current Render production data was backed up, transferred and verified. Render remains preserved and read-only. No paid plan or source deletion was performed.

## Completed

- Web-only PC/phone app: inbox-style lists/drawers, touch actions, ordering, labels, safe URLs, priorities, selection and encrypted backup/import.
- Installable PWA with allowlisted same-origin shell caching; API/vault responses are never service-worker cached. Offline encrypted edits persist and conflicts preserve local data.
- Workers/D1 ownership, validation, atomic version conflicts, multi-chunk payloads over 2 MB, original password-verifier compatibility, logout and deletion/recreation tests passed.
- Original production account/authentication metadata and encrypted bytes match the new D1 fingerprint exactly. Five older local records were kept separate.
- Live registration/login/read/save/conflict/logout checks passed with a disposable QA account; it was removed and the original account fingerprint rechecked.
- Served frontend contains no missing desktop session helper. Private environment/data/source paths return 404.
- Six baseline API tests passed. Full PC/phone browser checks passed again after the final cache/fallback update at widths 320, 390, 768, 1024 and 1440.
- Commercial edition rejects unlicensed, forged, copied-to-another-browser and wrong-email activation. Valid PC/phone activation, encrypted local links and offline reopening passed.
- Commercial own-cloud template passed actual local Workers/D1 browser registration/login/save, two-device scope/assignment and relocking. Signed API licence checks and spoofed-email rejection passed. Seller issuer signature/owner/three-installation limit tests passed. Deployment dry run passed.
- Root/customer dependency audits reported zero vulnerabilities at preparation time.

## Sales delivery

3 October update: added named browser installations and explicit profile selection for This device. Profiles are filtered along with their links; chosen profiles include future links and empty profiles. Other installations keep independent selections. Legacy unassigned links remain in All devices. Browser tests passed cloud reload, desktop/phone separation, no deletion on unassignment, offline reopen/reconnect, escaped labels and picker widths 320/390/768/1440.

Customer archive: `sale-dist/Link-Launcher-Commercial-2.1.1.zip`. Buyer guide: START-HERE.html; self-host guide: OWN-CLOUD.md. Seller guide: `commercial/SELLER-GUIDE.md`. Archive creation excludes account data, credentials, .wrangler state, signing keys, fixtures, dependencies and installers.

Future releases now use a single-person commercial licence, as authorized. Earlier MIT copies and separately licensed code retain their permissions; the earlier notice is preserved. The unmodified sales edition requires a signed file for the purchase email/browser, up to three issued installations per order. Fulfilment is manual after checking a paid order. No payment platform/API is connected.

Self-hosted downloadable source cannot be guaranteed torrent-proof. Buyers control their files/server. Signatures reject forged files, but source/browser-state modification or deliberate sharing can bypass controls. Offline activation has no remote revocation. Do not promise complete piracy prevention, unlimited hosting or automatic marketplace-key activation.

## Owner and seller follow-up

- Personally sign in to verify readable links; choose All devices on the new origin. The agent did not use the master password.
- Check installation on real PC/phone and large-vault performance under free-plan limits.
- Back up private signing key and encrypted migration snapshot securely. Losing the signing key prevents compatible new issuance; losing a master password prevents decryption.
- Set price, real seller identity, support channel, activation turnaround, update promise and lawful refund terms on the storefront before accepting payment. No checkout or invented commitments are included.
- Review Git changes and push when desired. Cloud deployment used local reviewed files.
- Earlier Git history contained private local account records. This package excludes them but does not purge historical copies or revoke MIT rights. Review exposure before distributing old repositories/history.

No storefront upload, sales announcement, financial transaction, Render deletion or Git history rewrite was performed.

## Browser continuity and routing update

Deployed 3 October 2026, Worker version 4a9db6dd-c03a-437c-8e88-fc7dfc97be6b. Live health reports connected D1 and migrationPending false; served HTML, session/routing scripts, app script, extension ZIP and service worker match the reviewed local files. Private signing, migration and vault routes return 404.

Saved named workspaces can be selected from a fresh browser. Optional trusted-browser unlock passed browser restart/offline tests; Lock/Log Out remove remembered access. Incognito remains separate and temporary. Real Chrome extension same-profile tab creation and simulated standalone routing passed; physical installed-PWA and phone checks remain. No arbitrary cross-profile launch is promised. Commercial 2.1.1 rejects invalid licences and passes local/offline and buyer-owned D1 sync tests. The ZIP includes a sanitised own-origin extension, a dependency lockfile and verified extraction hashes.
