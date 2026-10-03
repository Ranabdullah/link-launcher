# Selling Link Launcher Commercial 2.1

Upload only `Link-Launcher-Commercial-2.1.1.zip`. Keep `seller-private/`, migration backups, Render credentials, account data and your entire development repository out of the storefront upload. The ZIP is a clean customer package with local app hosting, private Cloudflare setup and signed activation.

## Recommended storefront

Prioritise the storefronts where you have already made sales. Your experience with Gumroad, itch.io and Superhive is a stronger starting point than choosing a new storefront mainly for its fees.

1. **[Gumroad](https://gumroad.com/): primary launch.** Use your existing seller account and audience for this downloadable software. Upload the clean customer ZIP, desktop/phone screenshots and the listing copy below. Check [current pricing](https://gumroad.com/pricing) when setting your price.
2. **[itch.io](https://itch.io/): second launch.** Present it accurately as a downloadable tool. Show how it organises project references, documentation and useful websites. Use the same package and licence terms, with the local setup and manual activation requirements visible before purchase. [Creator documentation](https://itch.io/docs/creators/faq).
3. **[Superhive](https://superhivemarket.com/): confirm eligibility first.** Your sales history makes it worth considering, but its [Creator Policy](https://support.superhivemarket.com/article/277-creator-seller-policy) focuses on Blender products. Its standalone-product conditions include benefiting a Blender-specific workflow, functionality infeasible as an add-on and a GPL-compatible licence. Link Launcher currently has no Blender integration, and its restrictive commercial licence should not be presented as GPL-compatible. Ask Superhive whether this web app qualifies before preparing a listing there. A general link organiser is not automatically eligible simply because Blender creators could use it.

Keep **[Payhip](https://payhip.com/)** as an optional backup storefront. Since it has not produced sales for you, it is not the main launch recommendation for this product.

**[Lemon Squeezy](https://www.lemonsqueezy.com/)** is a possible future option for automated software licensing. Its licence API has **not** been integrated into this edition. [Licence documentation](https://docs.lemonsqueezy.com/help/licensing/generating-license-keys). This edition expects the seller's signed `.lllicense` file, not an automatically generated storefront key.

For the first launch, reuse your established Gumroad and itch.io audience, include a short real demonstration and keep pricing and licence terms consistent across both pages. Set a realistic activation turnaround before accepting orders. Neither storefront guarantees sales.

## Product listing copy

**Title:** Link Launcher — Private Link Manager for PC & Phone

Keep useful websites organised with a familiar inbox-style layout, labels, search, stars, priorities and simple up/down ordering. Install it as a web app. Keep links encrypted in your browser, or deploy your own Cloudflare copy to sync your account across computers and phones.

Includes: commercial web app download; local browser server; your-own-cloud Worker/D1 template; setup guide; encrypted backup import/export; single-person licence for up to three browser installations.

**Requirements:** Current Chrome/Edge on PC, or a modern phone browser for your own HTTPS cloud copy. Local computer setup requires Node.js 22 or newer; phone local-only operation uses a loaded HTTPS web app. Cloud setup requires Node/npm and your own Cloudflare account. No Link Launcher EXE, Firebase project, Supabase project or paid Cloudflare plan is required. Cloud providers have usage limits.

**Activation:** After purchase, send your installation code and purchase email through your order. The seller verifies payment and provides a signed activation file. Activation is manual, per browser installation. Local use works offline after activation and loading. Clear this timing and process with buyers before payment.

**Data:** Your master password is not sent to the seller or API. Local links are encrypted in your browser. Optional cloud storage contains account email, derived authentication material, sync metadata and encrypted vaults. Losing your master password loses access to encrypted links/backups. This product has no password-recovery or verified-email login service.

Set your price, real seller identity, support contact/process, activation turnaround, update terms and applicable refund terms on the storefront before accepting payment. The download does not invent those business commitments or create a payment integration. Do not advertise torrent-proof protection, unlimited hosting, included cloud hosting, automatic platform-key activation or guaranteed recovery.

## Fulfil a paid order

The signing key is already initialized in private `seller-private/license-signing-key.pem`. **Back it up securely.** Replacing it invalidates issued licences. The public verification key is safe to distribute; the private signing key and issued-order registry are not.

1. Confirm the order is genuinely paid and note its buyer email. Do not issue licences just because someone provides an order number.
2. Ask the buyer for the `LL1:...` installation code shown by their app. It is random and contains no master password or links.
3. In the development project run:

   ```text
   node scripts/commercial-license.cjs issue buyer@example.com ORDER123 LL1:browser-installation-uuid
   ```

   Replace all three values with the confirmed order information and exact code. Order IDs must use letters, numbers, underscore or hyphen.

4. Deliver **only** the generated `.lllicense` for that order from `seller-private/`, privately through the purchase platform. Do not deliver the key or registry. The buyer imports it in the app.
5. Repeat for that person's other installations, up to three per order. The issuer rejects a fourth installation and prevents using an existing order for another email. Requests after clearing data or changing browsers need an order review and controlled reissue; do not repeatedly issue new order IDs to bypass the limit.

Offline licences have no expiry/revocation callback. Refunds cannot remotely remove an already activated offline copy. The seller registry caps issued installations; it is not an online fraud-detection service. Deliberate copying of browser state or modification of buyer-owned source can bypass controls. A hosted licensing service is needed for centralized revocation, and even that cannot make a self-hosted source package absolutely copy-proof.

The commercial wrapper also validates signed licences on account API calls and binds account access to the signed buyer email. The customer controls their own server; neither this check nor the browser check is protected from their source modification.

## Earlier MIT copies

The current licence for future releases is commercial, as authorized by the owner. Earlier MIT releases keep their permission to copy, modify and redistribute. Their core notice is retained in the package. Selling setup convenience and the new signed commercial edition does not revoke earlier rights or stop people using an earlier free fork.

## Help people decide

Use the included clean desktop/phone screenshots, explain local versus own-cloud operation and show a short real demonstration: add link → label/star → reorder → open on phone → export backup. Lead with the concrete time-saving use case and privacy choices. Bring relevant visitors to your product page; choosing a storefront alone does not create demand. Do not use screenshots of real customer accounts or passwords.

No listing, account creation, financial transaction or public sales announcement has been performed in this task.

