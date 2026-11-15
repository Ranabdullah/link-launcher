# Make Link Launcher your own

## Your GitHub

Use **Fork** for upstream updates, or **Code → Download ZIP**, extract it and create an empty GitHub repository. In the extracted folder:

```sh
git init
git add .
git commit -m "Initial Link Launcher setup"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git
git push -u origin main
```

Replace both placeholders. Never commit credentials, `.env`, `.dev.vars`, `.wrangler`, account files or exported vaults. Transfer an existing repository through **Settings → General → Danger Zone → Transfer ownership**; the recipient accepts. Code transfer does not transfer hosting or records.

## Local use

Install Node.js 22+ and Git. In the project folder:

```sh
npm ci
npm start
```

Open `http://localhost:3000`. Local-only storage belongs to this browser and URL. Keep encrypted backups elsewhere. The Node API writes to ignored `server/data`; never publish that folder.

## Your Cloudflare Worker and D1

Workers serves both UI and API; Pages alone cannot run this API.

```sh
npm ci
npm run build
npx wrangler login
npx wrangler whoami
npx wrangler d1 create my-link-vault
```

Copy `wrangler.example.jsonc` to `wrangler.own.jsonc`. Set a unique Worker `name`, your D1 `database_name` and the `database_id` printed above. No developer account ID is needed.

```sh
npx wrangler d1 migrations apply my-link-vault --remote --config wrangler.own.jsonc
npx wrangler secret put JWT_SECRET --config wrangler.own.jsonc
```

For the secret prompt, generate a random value in a separate terminal:

```sh
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Paste it into Wrangler's secret prompt. Keep it in your password manager, never source or chat. Changing it signs out sessions.

```sh
npx wrangler deploy --config wrangler.own.jsonc
```

Open the printed workers.dev URL. Create an account, add a test link and sign in from another browser to check sync. Check `/api/health` if needed. Keep MIGRATION_PENDING false for fresh setups. Review Cloudflare limits and charges before inviting users.

For Git integration, connect your repository in Cloudflare, build with `npm run build`, deploy with `npx wrangler deploy --config wrangler.own.jsonc`, and configure your D1 and JWT_SECRET. Commit your own config only after checking it contains no secrets.

## Chrome / Edge for your URL (Windows only)

In `browser-bridge/manifest.json`, replace the production origin in `content_scripts[0].matches` with your exact HTTPS origin plus `/*`. Keep localhost patterns only for development. Avoid `<all_urls>`. Rebuild with `npm run build`.

Download **Browser profiles → Setup**, extract permanently and read `READ-FIRST.html`. Load unpacked in Chrome/Edge Developer mode, run `Setup.cmd`, reload extension and app. Install the extension in each browser profile, the helper once per Windows user. [Troubleshooting and uninstall](../browser-bridge/README.md). Phones open links in their normal browser.

## Transfer and backup

Unlock the old URL and export an encrypted `.dlvault`. Keep the old deployment until verified. Create an account at your new URL, import and confirm replacement. Check link counts and another device's sync. Export a fresh backup. Browser mappings and remembered unlock need configuring again. Never copy raw database records into GitHub.

Use D1 backup facilities and securely stored exports for server recovery, with a tested restore process. Keep encrypted vault exports outside the hosting account too. Sync alone is not backup.

## Alternative Node hosting

`npm start` serves UI/API on PORT (default 3000). Production needs HTTPS, NODE_ENV=production, a stable random JWT_SECRET of at least 32 characters, ALLOWED_ORIGINS set to your exact HTTPS origin, and persistent private DATA_DIR. Ephemeral filesystems lose accounts on restart. DATABASE_URL optionally selects PostgreSQL; configure it through the host's secret manager. Configure the reverse proxy correctly, never expose data as static files and maintain independent backups.

## Branding and updates

Edit titles/colours in `index.html` and `responsive.css`, icons in `icons/`, and install names in `manifest.webmanifest`. Renaming the extension requires updating the helper installer's expected name too. Increment `sw.js` CACHE after shell changes. A new URL creates separate browser storage.

```sh
npm ci
npm audit
npm test
npm run test:cloudflare:web
npm run build
npx wrangler deploy --config wrangler.own.jsonc
```

## Troubleshooting

- Wrong cloud account: check `npx wrangler whoami` before remote changes.
- Missing D1: check binding DB, database ID and applied migrations.
- Login: check JWT_SECRET and MIGRATION_PENDING; this is not Google OAuth.
- Missing browser profile: reload extension, run helper setup and choose assignments; missing profiles never silently fall back.
- Offline storage blocked: allow site storage and export backups; private browsers may discard data.
