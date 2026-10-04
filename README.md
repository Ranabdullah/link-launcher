# DreamsLab Link Launcher

Live personal app: **https://link-launcher.ranakaharian1.workers.dev**. Cloudflare Workers Free serves the app/API; D1 holds encrypted account vaults. Owner: ranakaharian1@gmail.com. Current Render account data was migrated without changing passwords; Render is retained read-only. See [migration evidence](CLOUDFLARE_MIGRATION.md).

There is no maintained Link Launcher EXE, Electron dependency or desktop installer. Install the PWA with Chrome/Edge's Install app action or a phone's Add to Home Screen.

## Use your links

- Sign in with your existing vault email/master password. Use **Choose profiles for this device**, give the browser installation a name (Home PC, My phone), choose its profiles and save. **This device** shows their existing/future links plus individually saved/assigned links. **All devices** retains the complete library. Other browser installations start with their own selection; clearing browser data requires choosing again. Device choices and names are saved in the encrypted vault. This is a view filter, not a separate access permission or automatic Chrome-profile detection.
- New accounts require a master password of at least 12 characters. The email identifies the vault; it is not a verified Google login. Account labels organise links, not Chrome profiles.
- Reorder with ↑ / ↓ in All Links with filters cleared. Use labels, priorities, stars, search and selection for organisation.
- Previously loaded apps reopen encrypted cached vaults offline. Reopening offline requires an online sign-in before cloud sync reconnects. Linked websites may need internet. Conflicts preserve local work; export a backup before resolving them.
- **Open / create local-only vault** keeps encrypted links in the browser without a cloud account. For first creation, confirm the password. Export backups before clearing browser data or switching site addresses.
- Backup exports encrypted `.dlvault`; import replaces the selected account vault and asks for confirmation. Readable JSON export is separately confirmed. Keep backups outside the browser.
- Lock clears the password/plaintext session from memory. There is no recovery for a lost master password. The API receives derived authentication material and encrypted links, not the master password or readable links.

## Commercial download

`sale-dist/Link-Launcher-Commercial-2.1.5.zip` is the clean buyer download. `START-HERE.html` explains local use with a loopback browser server; `OWN-CLOUD.md` explains a private Workers/D1 setup on the buyer's own account. No seller accounts, vaults, cloud IDs, private keys or credentials are included.

The sales edition adds signed activation bound to the purchase email and browser installation, up to three issued installations per single-person order. Activation fulfilment is manual after the seller verifies payment. Local use works offline after activation/loading. Its own-cloud API also checks the signed licence and account email. No payment platform or checkout is integrated.

[Seller guide and listing copy](commercial/SELLER-GUIDE.md) explains where to sell and how to issue signed files. Keep `seller-private/license-signing-key.pem` and the issued-order registry private; back them up securely. Never upload the development repository as a customer download.

Future releases now have the owner's authorized commercial licence. Earlier MIT copies and separately licensed code retain their original rights, with the earlier notice preserved in `commercial/CORE-MIT-LICENSE.txt`. A self-hosted source download cannot be guaranteed torrent-proof: signatures reject forged files, but buyers can modify their source/browser state. Offline activation has no remote revocation.

## Develop and verify

Node.js 22 or newer:

```text
npm ci
npm start
npm run build
npm test
```

Development uses ignored `server/data/vaults.json`; tests use isolated stores. `npm run test:web`, `npm run test:cloudflare:web` and `npm run test:commercial` need Playwright and Chrome (supplied by the Codex workspace runtime here). Commercial tests require the generated sales folder. Generate a fresh clean sales folder with `npm run commercial:build`; the builder refuses to overwrite an existing generated folder. Preserve or move it before rebuilding. Initialize a new seller installation with `node scripts/commercial-license.cjs init`; never rotate an existing buyer signing key casually.

## Deploy the owner's Cloudflare app

```text
npm run cloudflare -- whoami --json
npm run cloudflare:check
npm run cloudflare:deploy
```

The wrapper guards owner account 4dddb56c05af56a431914f2cb7f48eb4 and isolates Wrangler credentials in ignored `.cloudflare-auth/`. D1 is bound in `wrangler.jsonc`; JWT_SECRET is private on the Worker. Only allowlisted `web-dist/` assets are published. `MIGRATION_PENDING=true` freezes destination writes for future transfer work; the verified live deployment currently uses false. Migration snapshots, credentials and seller keys are excluded from assets.

Cloudflare Free has quotas: 100,000 Worker requests/day; D1 5 million rows read and 100,000 written/day; 500 MB/database, 5 GB total storage. CPU/platform limits also apply. Quotas can pause sync. [Current D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/) and [limits](https://developers.cloudflare.com/d1/platform/limits/). Firebase and Supabase are not configured or required.

Git origin is `Ranabdullah/link-launcher`; the old Render upstream is `abdullahinayat24-lang/link-launcher`. This turn's migration/config/licensing work remains local for review; deployment used local files, with no Git push.

Read [LAUNCH_AUDIT.md](LAUNCH_AUDIT.md) for verification, remaining physical-device checks and seller decisions. Old private account data was removed from tracking, but prior Git history was not purged. Do not distribute historical repository bundles as the sales file.

## Browser continuity and link routing

Name each workspace, such as Home PC or Work laptop, and save its profiles. In a new browser, open Choose profiles for this device and select Home PC from Saved workspace to reuse its selection. Names and selections sync in your encrypted vault; the browser remembers your chosen workspace locally. Incognito cannot identify the physical PC and forgets that local choice when closed.

Select Keep this browser unlocked only on your own trusted browser. It remembers the password locally using a browser encryption key, for up to 90 days. Anyone who can open that browser can access the vault. Lock or Log Out removes remembered access. Incognito forgets it when closed.

To open each account in its assigned Chrome or Edge profile, open Browser profiles and download the extension and Windows helper. Extract browser-bridge.zip into a permanent folder; load the extension through chrome://extensions or edge://extensions. Double-click Setup.cmd from the extracted browser setup folder. A private official runtime is downloaded and checksum-verified if needed. Load/reload the extension and refresh the app.


Colours: click the small coloured dot beside an account to change its colour; click the palette button above the links to change a category tab. Colour choices sync in the encrypted vault. All devices resets the Starred/Pinned account filter and shows every saved account, including accounts with no links. If a Chrome/Edge profile is missing, use Find browser profiles on this PC and select the accounts to add. Names/emails are saved in the encrypted vault only after you choose Add selected accounts; browser locations and routing stay local. Add Link accepts a pasted website address and displays both name and email to distinguish accounts. The interface uses restrained colour accents, rounded controls and a subtle frosted-glass header/dialog finish.
