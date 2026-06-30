# tauri-plugin-getappscafe-auth

Drop-in device activation + license UI for Tauri 2 apps shipped through [getapps.cafe](https://getapps.cafe). One line in Rust, one line in JS, and the plugin handles:

- Activation flow (`init` → open browser → poll → store token).
- Shared OS keychain entry so multiple apps on the same machine **reuse one license slot**.
- 1-day grace period for fresh installs: user can use the app immediately; sign-in is enforced after the grace window.
- Floating sign-in button (blue accent, bottom-right) while in grace; full-screen overlay once locked.
- Boot-time `whoami` check with a cached snapshot fallback - launches stay fast and survive transient network failures (no periodic polling; `auth.refresh()` for an on-demand re-check).
- Hidden info modal (Cmd/Ctrl+Shift+J) for support: user, device, plan, grace, masked token, "Re-check now / Copy hardware ID / Sign out".

> Backend reference (server-side activation routes, web account UI, billing): see the [getapps.cafe repo](https://github.com/mrleepng/getappscafe).

## Install

In the Tauri app's `src-tauri/Cargo.toml`:
```toml
[dependencies]
tauri-plugin-getappscafe-auth = { git = "https://github.com/getappscafe/tauri-plugin-getappscafe-auth.git", tag = "v0.1.7" }
```

(Not published on crates.io - distribution is git-tag only. Bump the `tag` to adopt a new release.)

In the app's `package.json`:
```bash
npm install github:getappscafe/tauri-plugin-getappscafe-auth
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

In your frontend entry (any framework - pure DOM):
```js
import { setupAuth } from '@getapps/tauri-plugin-auth';

setupAuth({
  apiUrl: 'https://getapps.cafe',  // use 'http://localhost:3000' for dev
  appName: 'ClipShelf',
});
```

That's it. The plugin auto-mounts its UI into `document.body`. Open the app - you'll see the floating user button bottom-right.

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
   The plugin will pick up `window.__TAURI__.core.invoke` automatically - no `@tauri-apps/api` import needed.

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
| First boot, no token | Floating user button (blue, bottom-right) | ✅ yes, for 24h |
| Floating button clicked | Full overlay with activation code + "Re-open sign-in page". Browser auto-opens `/activate?code=…` via Rust `open` (works inside Tauri webview) | ❌ blocked while overlaying - user dismiss-able if still in grace |
| 24h passed, still no token | Full overlay: "Sign in to continue" | ❌ blocked, no dismiss |
| Has token, boot `/whoami` OK | Nothing | ✅ yes |
| Has token, boot `/whoami` 401 (revoked) | Returns to grace logic above | depends on grace |
| Has token, boot `/whoami` 402 (license expired) | Full overlay: "Trial ended" / "Subscription lapsed" with "Upgrade" | ❌ blocked |
| Has token, network down at boot | Nothing - session restored from cached whoami snapshot with `state.offline = true` + `lastCheckedAt`; cleared on next successful `auth.refresh()` | ✅ yes |
| No token, network down at boot, grace expired | Falls through to locked overlay | ❌ blocked |

## Sharing the license across multiple apps

The plugin stores the device token in the **OS-level shared credential store**:

- macOS: Keychain via Security.framework, pinned to access group `VFYA7T675R.cafe.getapps.shared` in the **DataProtectionKeychain** (item `cafe.getapps.device` / account `device_token`).
- Windows: Credential Manager (Windows scopes per-user, not per-app).
- Linux: libsecret schema `cafe.getapps.device`.

### macOS requirements (mandatory - otherwise you get the "enter your Keychain password" dialog)

1. Every host app must be **code-signed with Apple Team ID `VFYA7T675R`**. The plugin hardcodes this Team ID; forks/3rd-party use would need to fork and change `ACCESS_GROUP` in `src/storage_macos.rs`.
2. Every host app must declare the shared access group in its entitlements. With Tauri, put this in `src-tauri/Entitlements.plist` (or the file referenced by `tauri.conf.json > bundle.macOS.entitlements`):
   ```xml
   <key>keychain-access-groups</key>
   <array>
     <string>VFYA7T675R.cafe.getapps.shared</string>
   </array>
   ```
   Use this literal string - the plugin hardcodes `VFYA7T675R.cafe.getapps.shared` as the access group on the read/write side.
3. Unsigned / ad-hoc-signed builds (the default `cargo tauri dev` output) **cannot** join an access group. You'll see the OS password dialog when a second app tries to read app 1's token. This is expected in development; once both apps ship signed with the same Team ID + entitlement, the dialog goes away.

After activating app A, install app B from the same publisher - it reads the same token, calls `/whoami`, and boots straight into the authenticated state. No browser, no second activation, no extra license slot used (the server unique-keys on `hardware_id`).

> **Upgrading from earlier plugin versions**: the macOS backend was switched from the legacy file keychain to DataProtectionKeychain with a shared access group. Existing tokens are not migrated - users will re-activate once on next launch.

## API

### `setupAuth(opts) -> Auth`

| Option | Default | What it does |
|---|---|---|
| `apiUrl` | `https://getapps.cafe` | Server base URL. Use `http://localhost:3000` for dev. |
| `appName` | (required) | Used in the locked overlay copy and as a fallback device name. |
| `graceMs` | `86400000` (24h) | How long after first boot the app stays usable without sign-in. |
| `pollIntervalMs` | `2500` | Activation poll cadence. |
| `pollTimeoutMs` | `600000` (10m) | Give up on the activation request after this. |
| `mountUi` | `true` | Set to `false` if you want to render your own UI and just consume `state`. |
| `onChange(state)` | - | Callback on every state change. Equivalent to `auth.subscribe(fn)` but inline at setup. |
| `upgradeUrl` | derived | Where the "Upgrade" button opens. Defaults to `${apiUrl}/account#/billing`. |
| `deviceName` | hostname or appName | Sent to the server on `init` so it shows up in `/account`. |
| `colors` | - | CSS-var overrides for the bundled UI. See the [theming section](#theming-the-ui). Any valid CSS color/length value works (`#rgb`, `rgb()`, `color-mix(...)`, `12px`, ...). |
| `infoShortcut` | `'Mod+Shift+J'` | Hidden shortcut that opens a read-only info modal (user / device / plan / grace). `'Mod'` = Cmd on macOS, Ctrl elsewhere. Set to `null` to disable, or pass a `(KeyboardEvent) => boolean` matcher. |
| `right` | `20` | Floating sign-in button offset from the right edge. Number = px, string = any CSS length (e.g. `'1rem'`, `'calc(20px + env(safe-area-inset-right))'`). |
| `bottom` | `20` | Floating sign-in button offset from the bottom edge. Same semantics as `right`. |

> No periodic `whoami` re-check: the plugin verifies the license once at boot, then trusts the cached snapshot for the rest of the session. Call `auth.refresh()` if you want an on-demand re-check (the info modal exposes this as "Re-check now").

### `Auth` instance

```js
const auth = setupAuth({ ... });

auth.state;                     // current snapshot
auth.subscribe(fn);             // returns an unsubscribe fn
await auth.startActivation();   // force start the flow (= clicking the floating button)
auth.cancelActivation();        // only effective if still in grace
await auth.signOut();           // clear shared token, fall back to grace
auth.openUpgradeUrl();          // open billing page
auth.openAccountUrl();          // open account page
await auth.refresh();           // force a whoami / grace re-check now
await auth.showInfo();          // open the hidden info modal (also: hideInfo / toggleInfo)
await auth.copyHardwareId();    // copy hardware id to clipboard
auth.destroy();                 // unmount UI, clear timers
```

### Open account info modal

Press **Cmd/Ctrl + Shift + J** to open a read-only modal with the current user, device, plan, grace window, and stored token (masked). The modal also exposes "Re-check now", "Copy hardware ID", "Open account page", and "Sign out" — useful for support, QA, or letting power users check their state without leaving the app.

The shortcut works in every phase (including `authenticated` when no other UI is visible). Disable with `infoShortcut: null`, or override with `infoShortcut: 'Mod+Shift+F12'` / a custom matcher function.

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

The lower-level functions are also re-exported (`getHardwareId`, `initActivation`, `pollActivation`, `whoami`, `getSharedToken`, `setSharedToken`, `removeSharedToken`, `getGraceState`, `openActivationUrl`) - use them directly if you don't want the bundled state machine either.

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
