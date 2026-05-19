# tauri-plugin-getappscafe-auth

Drop-in device activation + license UI for Tauri 2 apps shipped through [getapps.cafe](https://getapps.cafe). One line in Rust, one line in JS, and the plugin handles:

- Activation flow (`init` → open browser → poll → store token).
- Shared OS keychain entry so multiple apps on the same machine **reuse one license slot**.
- 1-day grace period for fresh installs: user can use the app immediately; sign-in is enforced after the grace window.
- Floating sign-in button (bottom-right) while in grace; full-screen overlay once locked.
- Automatic `whoami` re-check every 30 min — handles "license moved to another device" and "subscription lapsed" without any code in the host app.

> Backend reference (server-side activation routes, web account UI, billing): see the [getapps.cafe repo](https://github.com/mrleepng/getappscafe).

## Install

In the Tauri app's `src-tauri/Cargo.toml`:
```toml
[dependencies]
tauri-plugin-getappscafe-auth = { git = "https://github.com/3aesala/tauri-plugin-getappscafe-auth" }
```

In the app's `package.json`:
```bash
npm install github:3aesala/tauri-plugin-getappscafe-auth
# or `pnpm add` / `yarn add`
```

## Wire it up

`src-tauri/src/lib.rs`:
```rust
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_getappscafe_auth::init())
        // ... your other plugins
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

`src-tauri/capabilities/default.json`:
```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "getappscafe-auth:default"
  ]
}
```

In your frontend entry (any framework — pure DOM):
```js
import { setupAuth } from '@getapps/tauri-plugin-auth';

setupAuth({
  apiUrl: 'https://getapps.cafe',  // use 'http://localhost:3000' for dev
  appName: 'ClipShelf',
});
```

That's it. The plugin auto-mounts its UI into `document.body`. Open the app — you'll see the floating user button bottom-right.

### Vanilla JS (no bundler)

If your Tauri app's frontend is plain HTML + JS (no Vite/Webpack/etc.), the bare specifier `@getapps/tauri-plugin-auth` can't be resolved by the browser. Two things to set up:

1. Enable the global Tauri object in `src-tauri/tauri.conf.json`:
   ```json
   {
     "app": {
       "withGlobalTauri": true
     }
   }
   ```
   The plugin will pick up `window.__TAURI__.core.invoke` automatically — no `@tauri-apps/api` import needed.

2. Import the plugin from its actual file path:
   ```html
   <script type="module">
     import { setupAuth } from './node_modules/@getapps/tauri-plugin-auth/guest-js/index.js';

     setupAuth({
       apiUrl: 'https://getapps.cafe',
       appName: 'ClipShelf',
     });
   </script>
   ```
   (Or copy `guest-js/` into your `src/` and import from there.)

## How it behaves

| Situation | Plugin UI | Host app usable? |
|---|---|---|
| First boot, no token | Floating user button | ✅ yes, for 24h |
| Floating button clicked | Full overlay with code + "Re-open activation page". Browser opens at `/activate?code=…` | ❌ blocked while overlaying — user dismiss-able if still in grace |
| 24h passed, still no token | Full overlay: "Sign in to continue" | ❌ blocked, no dismiss |
| Has token, `/whoami` OK | Nothing | ✅ yes |
| Has token, `/whoami` 401 (revoked) | Returns to grace logic above | depends on grace |
| Has token, `/whoami` 402 (license expired) | Full overlay: "Trial ended" / "Subscription lapsed" with "Upgrade" | ❌ blocked |
| Network down during boot | Stays in last good state, surfaces error | unchanged |

## Sharing the license across multiple apps

The plugin stores the device token in the **OS-level shared credential store**:

- macOS: Keychain via Security.framework, pinned to access group `VFYA7T675R.cafe.getapps.shared` in the **DataProtectionKeychain** (item `cafe.getapps.device` / account `device_token`).
- Windows: Credential Manager (Windows scopes per-user, not per-app).
- Linux: libsecret schema `cafe.getapps.device`.

### macOS requirements (mandatory — otherwise you get the "enter your Keychain password" dialog)

1. Every host app must be **code-signed with Apple Team ID `VFYA7T675R`**. The plugin hardcodes this Team ID; forks/3rd-party use would need to fork and change `ACCESS_GROUP` in `src/storage_macos.rs`.
2. Every host app must declare the shared access group in its entitlements. With Tauri, put this in `src-tauri/Entitlements.plist` (or the file referenced by `tauri.conf.json > bundle.macOS.entitlements`):
   ```xml
   <key>keychain-access-groups</key>
   <array>
     <string>$(AppIdentifierPrefix)cafe.getapps.shared</string>
   </array>
   ```
   At code-sign time `$(AppIdentifierPrefix)` expands to `VFYA7T675R.`, giving the full group `VFYA7T675R.cafe.getapps.shared` that the plugin writes to.
3. Unsigned / ad-hoc-signed builds (the default `cargo tauri dev` output) **cannot** join an access group. You'll see the OS password dialog when a second app tries to read app 1's token. This is expected in development; once both apps ship signed with the same Team ID + entitlement, the dialog goes away.

After activating app A, install app B from the same publisher — it reads the same token, calls `/whoami`, and boots straight into the authenticated state. No browser, no second activation, no extra license slot used (the server unique-keys on `hardware_id`).

> **Upgrading from earlier plugin versions**: the macOS backend was switched from the legacy file keychain to DataProtectionKeychain with a shared access group. Existing tokens are not migrated — users will re-activate once on next launch.

## API

### `setupAuth(opts) -> Auth`

| Option | Default | What it does |
|---|---|---|
| `apiUrl` | `https://getapps.cafe` | Server base URL. Use `http://localhost:3000` for dev. |
| `appName` | (required) | Used in the locked overlay copy and as a fallback device name. |
| `graceMs` | `86400000` (24h) | How long after first boot the app stays usable without sign-in. |
| `pollIntervalMs` | `2500` | Activation poll cadence. |
| `pollTimeoutMs` | `600000` (10m) | Give up on the activation request after this. |
| `whoamiInterval` | `1800000` (30m) | Periodic license re-check after sign-in. |
| `mountUi` | `true` | Set to `false` if you want to render your own UI and just consume `state`. |
| `onChange(state)` | — | Callback on every state change. |
| `upgradeUrl` | derived | Where the "Upgrade" button opens. Defaults to `${apiUrl}/account#/billing`. |
| `deviceName` | hostname or appName | Sent to the server on `init` so it shows up in `/account`. |

### `Auth` instance

```js
const auth = setupAuth({ ... });

auth.state;                     // current snapshot
auth.subscribe(fn);             // returns an unsubscribe fn
await auth.startActivation();   // force start the flow (= clicking the floating button)
auth.cancelActivation();        // only effective if still in grace
await auth.signOut();           // clear shared token, fall back to grace
auth.openUpgradeUrl();          // open billing page
auth.destroy();                 // unmount UI, clear timers
```

### State shape

See `guest-js/index.d.ts`. Phases: `loading | authenticated | grace | locked | activating | license_expired`.

### Headless mode

Pass `mountUi: false` and render your own UI from `state`:

```js
const auth = setupAuth({ apiUrl, appName, mountUi: false, onChange: (s) => render(s) });

function render(s) {
  // your framework here
}
```

The lower-level functions are also re-exported (`getHardwareId`, `initActivation`, `pollActivation`, `whoami`, `getSharedToken`, `setSharedToken`, `removeSharedToken`, `getGraceState`, `openActivationUrl`) — use them directly if you don't want the bundled state machine either.

## Theming the UI

The injected stylesheet exposes CSS variables on `.gac-host`:

```css
.gac-host {
  --gac-bg: rgba(15, 11, 7, 0.72);
  --gac-card: #faf6ef;
  --gac-ink: #2b1810;
  --gac-accent: #c84b1c;
  --gac-radius: 14px;
  --gac-z: 2147483600;
}
```

Override them in your app's stylesheet to match brand colors.

## License

MIT
