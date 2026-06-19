// @getapps/tauri-plugin-auth - main entry.
//
// Drives the boot flow, owns the state machine, and (optionally) mounts the
// default floating-button/overlay UI. The host app can either let this take
// care of everything via setupAuth(...), or use the lower-level functions
// (getSharedToken, startActivation, ...) and render its own UI.

// Resolve `invoke` at runtime so this module loads without a bundler.
// - Vanilla-JS Tauri apps set `app.withGlobalTauri = true` and get
//   `window.__TAURI__.core.invoke` - no bare-specifier import needed.
// - Bundled apps (Vite/Webpack/...) fall through to the dynamic import,
//   which the bundler resolves statically.
const invoke = (typeof window !== 'undefined' && window.__TAURI__?.core?.invoke)
  ? window.__TAURI__.core.invoke
  : (await import('@tauri-apps/api/core')).invoke;

const PLUGIN = 'plugin:getappscafe-auth';

// ---------- Raw command bindings ------------------------------------------
export const getHardwareId    = () => invoke(`${PLUGIN}|get_hardware_id`);
export const getPlatformInfo  = () => invoke(`${PLUGIN}|get_platform_info`);
export const initActivation   = (args) => invoke(`${PLUGIN}|init_activation`, args);
export const pollActivation   = (args) => invoke(`${PLUGIN}|poll_activation`, args);
export const whoami           = (args) => invoke(`${PLUGIN}|whoami`, args);
export const getSharedToken   = () => invoke(`${PLUGIN}|shared_token_get`);
export const setSharedToken   = (token) => invoke(`${PLUGIN}|shared_token_set`, { token });
export const removeSharedToken = () => invoke(`${PLUGIN}|shared_token_remove`);
export const getWhoamiCache   = () => invoke(`${PLUGIN}|whoami_cache_get`);
export const setWhoamiCache   = (value) => invoke(`${PLUGIN}|whoami_cache_set`, { value });
export const removeWhoamiCache = () => invoke(`${PLUGIN}|whoami_cache_remove`);
export const getGraceState    = (graceMs) => invoke(`${PLUGIN}|get_grace_state`, { graceMs });
export const openActivationUrl = (url) => invoke(`${PLUGIN}|open_activation_url`, { url });

// ---------- Setup ---------------------------------------------------------

const DEFAULT_OPTS = {
  apiUrl: 'https://getapps.cafe',
  appName: 'App',
  graceMs: 24 * 60 * 60 * 1000,
  pollIntervalMs: 2500,
  pollTimeoutMs: 10 * 60 * 1000,
  mountUi: true,
  onChange: null,
  upgradeUrl: null, // falls back to license.upgrade_url from server
  colors: null,     // optional theme overrides - see README.
};

/**
 * Boot the auth flow. Returns an `Auth` instance with `.state`, `.subscribe`,
 * `.startActivation`, `.signOut`, `.destroy`.
 */
export function setupAuth(userOpts = {}) {
  const opts = { ...DEFAULT_OPTS, ...userOpts };
  const auth = new Auth(opts);
  auth.boot();
  return auth;
}

class Auth {
  constructor(opts) {
    this.opts = opts;
    this.state = { phase: 'loading', appName: opts.appName };
    this.subs = new Set();
    this.ui = null;
    this.activationCode = null;
    this.pollTimer = null;
    this.activationDeadline = 0;
    this.destroyed = false;

    if (opts.mountUi) {
      // Lazy-load UI to keep headless integrations small.
      import('./ui.js').then(({ AuthUI }) => {
        this.ui = new AuthUI({
          colors: opts.colors,
          onSignInClick: () => this.startActivation(),
          onCancelActivation: () => this.cancelActivation(),
          onUpgradeClick: () => this.openUpgradeUrl(),
        });
        this.ui.mount();
        this.ui.render(this.state);
      });
    }
  }

  // --- public API ---------------------------------------------------------

  subscribe(fn) {
    this.subs.add(fn);
    fn(this.state);
    return () => this.subs.delete(fn);
  }

  async startActivation() {
    if (this.destroyed) return;
    if (this.state.phase === 'activating') return;
    const previous = this.state.phase;
    this.setState({
      phase: 'activating',
      activatingFrom: previous === 'grace' ? 'grace' : 'locked',
      error: '',
      activation: null,
    });
    try {
      const [hardwareId, platform] = await Promise.all([
        getHardwareId(),
        getPlatformInfo(),
      ]);
      const init = await initActivation({
        apiUrl: this.opts.apiUrl,
        name: this.opts.deviceName || platform.hostname || this.opts.appName,
        hardwareId,
        platform: platform.name,
      });
      this.activationCode = init.code;
      this.activationDeadline = Date.now() + Math.min(init.expires_in * 1000, this.opts.pollTimeoutMs);
      this.setState({
        activation: {
          code: init.code,
          url: init.activation_url,
          expiresAt: this.activationDeadline,
        },
      });
      await openActivationUrl(init.activation_url).catch(() => {
        // If we can't auto-open (no browser, denied), surface to the user.
        this.setState({ error: 'Couldn’t open your browser. Use the button below to open the sign-in page.' });
      });
      this.startPolling(hardwareId);
    } catch (e) {
      const friendly = isNetworkError(e)
        ? "Couldn't reach getapps.cafe. Check your internet and try again."
        : errorMessage(e);
      this.setState({ error: friendly, phase: previous });
    }
  }

  cancelActivation() {
    if (this.state.phase !== 'activating') return;
    if (this.state.activatingFrom !== 'grace') return; // not dismissible
    this.stopPolling();
    this.activationCode = null;
    this.checkGraceAndRender();
  }

  async signOut() {
    this.stopPolling();
    await removeSharedToken().catch(() => {});
    await removeWhoamiCache().catch(() => {});
    await this.checkGraceAndRender();
  }

  openUpgradeUrl() {
    const url = this.opts.upgradeUrl
      || this.state.license?.upgradeUrl
      || `${this.opts.apiUrl.replace(/\/$/, '')}/account#/billing`;
    openActivationUrl(url).catch(() => {
      this.setState({ error: 'Couldn’t open the upgrade page.' });
    });
  }

  destroy() {
    this.destroyed = true;
    this.stopPolling();
    if (this.ui) this.ui.unmount();
    this.subs.clear();
  }

  // --- internals ----------------------------------------------------------

  async boot() {
    // Whoami runs exactly once per app launch. No periodic re-checks: if the
    // user goes offline mid-session, we keep whatever phase boot established
    // until the app restarts. This is the abuse-resistant contract - the
    // *previous* successful whoami is what authorizes the session, not the
    // mere presence of a token.
    let token = null;
    try { token = await getSharedToken(); } catch {}
    if (!token) {
      await this.checkGraceAndRender();
      return;
    }
    try {
      const r = await whoami({ apiUrl: this.opts.apiUrl, token });
      await this.applyWhoami(r);
    } catch (e) {
      // Network/server unreachable. Restore the last successful whoami
      // snapshot from the shared keychain - do NOT auto-elevate to
      // authenticated just because a token exists.
      const restored = await this.restoreFromCache();
      if (!restored) {
        await this.checkGraceAndRender();
        if (isNetworkError(e)) {
          // No cache + offline: nothing to retry until next launch, so we
          // just inform - no scary red error.
          this.setState({ offlineNote: 'You appear to be offline.' });
        } else {
          this.setState({ error: errorMessage(e) });
        }
      }
    }
  }

  async checkGraceAndRender() {
    try {
      const g = await getGraceState(this.opts.graceMs);
      if (g.expired) {
        this.setState({ phase: 'locked', graceExpiresAt: g.expires_at });
      } else {
        this.setState({ phase: 'grace', graceExpiresAt: g.expires_at });
      }
    } catch (e) {
      // If keyring is broken, fail-open into grace mode rather than locking
      // the user out - the host app stays usable.
      this.setState({ phase: 'grace', error: errorMessage(e) });
    }
  }

  async applyWhoami(r) {
    if (r.kind === 'ok') {
      const snapshot = {
        phase: 'authenticated',
        user: r.user,
        device: r.device,
        limit: r.limit,
        license: null,
        checkedAt: Date.now(),
      };
      await setWhoamiCache(JSON.stringify(snapshot)).catch(() => {});
      this.setState({ ...snapshot, offline: false, error: '', offlineNote: '' });
      return;
    }
    if (r.kind === 'unauthorized') {
      // Server invalidated the token (device removed, etc.) - clear
      // everything and fall back to grace logic.
      await removeSharedToken().catch(() => {});
      await removeWhoamiCache().catch(() => {});
      await this.checkGraceAndRender();
      return;
    }
    if (r.kind === 'license_expired') {
      const snapshot = {
        phase: 'license_expired',
        license: {
          code: r.code,
          plan: r.plan,
          message: r.message,
          expiresAt: r.license_expires_at,
          upgradeUrl: r.upgrade_url,
        },
        checkedAt: Date.now(),
      };
      await setWhoamiCache(JSON.stringify(snapshot)).catch(() => {});
      this.setState({ ...snapshot, offline: false, offlineNote: '' });
    }
  }

  async restoreFromCache() {
    let raw = null;
    try { raw = await getWhoamiCache(); } catch {}
    if (!raw) return false;
    let snap;
    try { snap = JSON.parse(raw); } catch { return false; }
    if (snap.phase === 'authenticated') {
      this.setState({
        phase: 'authenticated',
        user: snap.user,
        device: snap.device,
        limit: snap.limit,
        license: null,
        offline: true,
        lastCheckedAt: snap.checkedAt,
        error: '',
      });
      return true;
    }
    if (snap.phase === 'license_expired') {
      this.setState({
        phase: 'license_expired',
        license: snap.license,
        offline: true,
        lastCheckedAt: snap.checkedAt,
        error: '',
      });
      return true;
    }
    return false;
  }

  startPolling(hardwareId) {
    this.stopPolling();
    const code = this.activationCode;
    const tick = async () => {
      if (this.destroyed) return;
      if (Date.now() > this.activationDeadline) {
        this.setState({ error: 'Sign-in expired - please try again.' });
        this.stopPolling();
        this.checkGraceAndRender();
        return;
      }
      try {
        const r = await pollActivation({ apiUrl: this.opts.apiUrl, code, hardwareId });
        if (r.status === 'completed' && r.device_token) {
          this.stopPolling();
          await setSharedToken(r.device_token).catch(() => {});
          try {
            const w = await whoami({ apiUrl: this.opts.apiUrl, token: r.device_token });
            await this.applyWhoami(w);
          } catch {
            // Just activated, but whoami right after couldn't reach the
            // server. Treat as offline-authenticated *only* for this one
            // tick: we know the server just issued the token (poll returned
            // `completed`), so we trust it for the rest of this session and
            // write a minimal cache so the next launch can restore it.
            // No `error` set: this race is invisible to the user, and the
            // raw exception would leak the API URL via reqwest's Display.
            const snapshot = {
              phase: 'authenticated',
              checkedAt: Date.now(),
            };
            await setWhoamiCache(JSON.stringify(snapshot)).catch(() => {});
            this.setState({
              phase: 'authenticated',
              offline: true,
            });
          }
          return;
        }
        if (r.status === 'expired' || r.status === 'cancelled') {
          this.stopPolling();
          this.setState({ error: `Sign-in ${r.status} - please try again.` });
          this.checkGraceAndRender();
          return;
        }
        // pending → keep polling silently. Clear any leftover offline note
        // from a previous failed tick now that the server is responding.
        if (this.state.offlineNote) this.setState({ offlineNote: '' });
      } catch (e) {
        // Transient network errors are OK during polling - the loop keeps
        // trying. Demote to a muted note instead of a red error so the user
        // doesn't see "TypeError: Failed to fetch" flashing every 2.5s.
        const msg = isNetworkError(e)
          ? "You appear to be offline. We'll keep trying..."
          : errorMessage(e);
        if (isNetworkError(e)) {
          this.setState({ offlineNote: msg });
        } else {
          this.setState({ error: msg });
        }
      }
    };
    this.pollTimer = setInterval(tick, this.opts.pollIntervalMs);
    tick();
  }

  stopPolling() {
    if (this.pollTimer) { clearInterval(this.pollTimer); this.pollTimer = null; }
  }

  setState(patch) {
    this.state = { ...this.state, ...patch };
    if (this.ui) this.ui.render(this.state);
    this.subs.forEach((fn) => { try { fn(this.state); } catch {} });
    if (this.opts.onChange) { try { this.opts.onChange(this.state); } catch {} }
  }
}

function errorMessage(e) {
  if (!e) return '';
  if (typeof e === 'string') return e;
  return e.message || String(e);
}

// Heuristic: did this exception come from "couldn't talk to the server"?
// Used to swap raw fetch/reqwest jargon for friendlier copy and to demote the
// red error block to a muted "you're offline" note when retry is automatic.
function isNetworkError(e) {
  const msg = String(e?.message || e || '').toLowerCase();
  return msg.includes('fetch')
    || msg.includes('network')
    || msg.includes('connection')
    || msg.includes('connect')
    || msg.includes('reqwest')
    || msg.includes('timeout')
    || msg.includes('offline')
    || msg.includes('dns');
}
