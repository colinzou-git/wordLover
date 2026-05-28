# Google OAuth And Production Hosting

This is the validation path for the remaining online product features. The offline dictionary, vocabulary, quiz, checkpoint, rollback, and export features must continue to work without Google.

## Google OAuth Validation

1. Create a Google Cloud project for WordLover.
2. Configure the OAuth consent screen for an external test app.
3. Add the user's Google account as a test user.
4. Create a Web application OAuth client.
5. Add authorized JavaScript origins for each validation host:
   - `http://127.0.0.1:4173`
   - the local HTTPS iPhone test origin, for example `https://192.168.1.73:8443`
   - the production HTTPS host when created
6. Put the client ID in `apps/wordlover-pwa/public/wordlover-config.js` as `googleClientId` (build-time default), **or** open WordLover and tap **Set client ID** in the menu's Google section to paste it at runtime. Runtime values are stored in the device's encrypted IndexedDB and override the config file value.
7. Open WordLover, open the menu, and click **Sign in with Google**.
8. After sign-in, click **Sync now** and verify Drive app-data backup creation.
9. On a second browser/device, sign in with the same Google account and click **Restore**. Verify vocabulary, review progress, settings, and checkpoints restore.

Expected result: sync status reaches `Synced`; local use still works when offline; failed OAuth or missing consent must not block local dictionary use.

## Adding a Second User to Your OAuth Client

Use this when you already completed the validation above and want a family member or friend to sign in on their own iPhone, while both devices reach the same Windows server on the LAN. Their Drive data ends up in their own Google account's `appDataFolder` — accounts stay isolated. No code changes are needed.

Per-new-user procedure (about 30 seconds):

1. In Google Cloud Console -> APIs & Services -> **OAuth consent screen**, scroll to **Test users**, click **Add users**, paste their Gmail address, save. Google caps unverified apps at 100 test users; only listed addresses can complete sign-in until the consent screen is submitted for verification.
2. Confirm your existing OAuth client's **Authorized JavaScript origins** already include the LAN HTTPS URL the second iPhone will load (for example `https://192.168.1.73:8443`). If both iPhones hit the same URL, you do not need to add anything new here.
3. On the second iPhone, open the WordLover URL, **Add to Home Screen**, launch the PWA.
4. From the menu, tap **Set client ID**, paste the same client ID you used on your own device, save. The client ID is not a secret for browser PWAs — sharing it with people you trust is fine. It is stored locally on each device.
5. Tap **Sign in with Google**. The second user picks **their own** Google account in the Google sign-in dialog (not yours).
6. After sign-in, tap **Sync now** to create their first Drive snapshot in their own `appDataFolder`. From this point each device syncs to its own account; the two users do not see each other's vocabulary.

If the second user does **not** appear in **Test users** when they try to sign in, Google returns "Access blocked: WordLover has not completed the Google verification process." Fix by adding their Gmail to the test user list above.

If you want each user to use their own OAuth client (no test-user coupling and no shared client ID), have them create their own OAuth client in their own Google Cloud project, then paste that client ID via **Set client ID** on their device. The app does not care which client ID a given device uses, as long as the served origin is on that client's authorized origin list.

## Free HTTPS Hosting

The product install target is a trusted HTTPS URL followed by Add to Home Screen on iPhone. No local certificate install should be part of the product flow.

Recommended first host: Cloudflare Pages or GitHub Pages.

Minimum hosted files:

- `index.html`
- `app.js`
- `styles.css`
- `sw.js`
- `manifest.webmanifest`
- `icon.svg`
- `wordlover-config.js`
- `vendor/`
- `dictionary-manifest.json`
- `dictionary.sqlite.zst`

Current limitation: the app still keeps `dictionary.sqlite` for the `sql.js` fallback. Before using GitHub Pages as the production host, the installer should consume `dictionary.sqlite.zst` and write the decompressed SQLite file into OPFS; otherwise the uncompressed 197-206 MB SQLite file is too large and slow for production hosting.

Validation checklist:

1. Deploy the static app to the HTTPS host.
2. Open the URL in iPhone Safari.
3. Add WordLover to the Home Screen.
4. Launch once online and install the dictionary.
5. Disable Wi-Fi and cellular data.
6. Confirm app launch, dictionary search, vocabulary, review, checkpoint creation, rollback, and export still work offline.
7. Re-enable internet and confirm Google sync and Gemini remain optional online-only features.
