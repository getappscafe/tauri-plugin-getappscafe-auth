# Example integration

Minimal `setupAuth` call in a Tauri app frontend:

```js
// src/main.js (or main.ts, App.vue, App.svelte, ...)
import { setupAuth } from '@getapps/tauri-plugin-auth';

const auth = setupAuth({
  apiUrl: import.meta.env.DEV ? 'http://localhost:3000' : 'https://getapps.cafe',
  appName: 'ClipShelf',
});

// optional: react to phase changes
auth.subscribe((s) => {
  if (s.phase === 'authenticated') {
    console.log('signed in as', s.user.email);
  }
});
```

And in Rust:

```rust
// src-tauri/src/lib.rs
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_getappscafe_auth::init())
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
```

For shared keychain on macOS (so a 2nd app from the same publisher boots straight into authenticated state), add to `src-tauri/Info.plist`:

```xml
<key>keychain-access-groups</key>
<array>
  <string>$(AppIdentifierPrefix)cafe.getapps.shared</string>
</array>
```

## Headless (no built-in UI)

If you want to render the activation prompt yourself:

```js
const auth = setupAuth({
  apiUrl: 'https://getapps.cafe',
  appName: 'ClipShelf',
  mountUi: false,
  onChange(state) {
    // state.phase: 'loading'|'authenticated'|'grace'|'locked'|'activating'|'license_expired'
    myCustomRenderer(state);
  },
});

document.querySelector('#sign-in').onclick = () => auth.startActivation();
document.querySelector('#sign-out').onclick = () => auth.signOut();
```
