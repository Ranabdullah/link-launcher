# Link Launcher browser setup (Windows)

1. Extract this ZIP into a permanent folder. Open READ-FIRST.html (in the parent folder if needed) to review its components, permissions, unsigned setup prompt and removal steps.
2. Open chrome://extensions (Edge: edge://extensions), enable Developer mode, choose Load unpacked and select this folder. Updating? Replace the extension files and click Reload.
3. Double-click **Setup.cmd** in the parent folder. No command typing is needed. Setup uses an existing Node.js 22+ runtime or downloads a private official Node.js 24 LTS runtime and verifies its SHA-256 checksum. It does not change the system PATH or require administrator access. Keep internet connected for the first download.
4. Reload the extension, refresh Link Launcher and open **Browser profiles → Profiles**. Choose a Chrome or Edge profile for each account and save.

Install the extension in each browser profile where you use the app. Install the helper once per Windows user. One unambiguous matching email can also be recognised automatically. A missing or ambiguous target leaves the link closed; it never falls back to the default profile. On phones, links use the current mobile browser.

The download cannot install itself. Windows may ask you to approve running Setup. If setup asks for an extension ID, copy it from the extension's details in Developer mode. If setup fails, read its message and retry; the PowerShell installer remains available in native-helper for advanced troubleshooting.

## Accounts and colours

Click **All accounts** above the account list to clear the selected account, within the current device scope. Use **All devices** to include every saved account and link. Clear category/search/priority filters if needed. All devices lists saved vault accounts, including empty ones; use **Find browser profiles on this PC** to explicitly import missing local profiles.

Click an account's coloured dot to change its colour. Use the palette button above the links to choose a category tab and save its colour. These colours sync in your encrypted vault.

## Privacy and saved workspaces

The helper reads local browser profile names and emails and receives only the vault account email, account label and clicked URL. It does not read passwords, cookies, history or link collections. Assignments are saved under %LOCALAPPDATA%\DreamsLab\LinkLauncherHelper. Website login depends on the cookies already in the chosen browser profile. Saved workspace selections such as Home PC sync in your encrypted vault; choose that workspace in a new browser. Incognito forgets local selections when closed and needs Allow in incognito on the extension.

## Own cloud

Change the first matches entry in manifest.json to your HTTPS app origin plus /*, then reload the extension. Localhost remains supported. Keep access limited to your app. This is an unpacked extension, not a published Web Store product.

## Remove

Run native-helper/Uninstall-Helper.ps1 to remove per-user browser registration. Delete the helper settings folder if you also want to forget assignments and remove its private runtime. Remove the extension from the browser's extension page. No Link Launcher EXE or background service is included; the private Node interpreter is only used when a browser requests the helper.
