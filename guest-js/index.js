// @getapps/tauri-plugin-auth — main entry.
//
// Drives the boot flow, owns the state machine, and (optionally) mounts the
// default floating-button/overlay UI. The host app can either let this take
// care of everything via setupAuth(...), or use the lower-level functions
// (getSharedToken, startActivation, ...) and render its own UI.

// Resolve `invoke` at runtime so this module loads without a bundler.
// - Vanilla-JS Tauri apps set `app.withGlobalTauri = true` and get
//   `window.__TAURI__.core.invoke` — no bare-specifier import needed.
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
export const getGraceState    = (graceMs) => invoke(`${PLUGIN}|get_grace_state`, { graceMs });
export const openActivationUrl = (url) => invoke(`${PLUGIN}|open_activation_url`, { url });

// ---------- Setup ---------------------------------------------------------

const DEFAULT_OPTS = {
  apiUrl: 'https://getapps.cafe',
  appName: 'App',
  graceMs: 24 * 60 * 60 * 1000,
  pollIntervalMs: 2500,
  pollTimeoutMs: 10 * 60 * 1000,
  whoamiInterval: 30 * 60 * 1000, // re-check license every 30 minutes
  mountUi: true,
  onChange: null,
  upgradeUrl: null, // falls back to license.upgrade_url from server
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
    this.whoamiTimer = null;
    this.destroyed = false;

    if (opts.mountUi) {
      // Lazy-load UI to keep headless integrations small.
      import('./ui.js').then(({ AuthUI }) => {
        this.ui = new AuthUI({
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
        this.setState({ error: 'Could not open the browser automatically. Click "Re-open activation page" below.' });
      });
      this.startPolling(hardwareId);
    } catch (e) {
      this.setState({ error: errorMessage(e), phase: previous });
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
    this.stopWhoamiTimer();
    await removeSharedToken().catch(() => {});
    await this.checkGraceAndRender();
  }

  openUpgradeUrl() {
    const url = this.opts.upgradeUrl
      || this.state.license?.upgradeUrl
      || `${this.opts.apiUrl.replace(/\/$/, '')}/account#/billing`;
    openActivationUrl(url).catch(() => {
      this.setState({ error: 'Could not open the upgrade page.' });
    });
  }

  destroy() {
    this.destroyed = true;
    this.stopPolling();
    this.stopWhoamiTimer();
    if (this.ui) this.ui.unmount();
    this.subs.clear();
  }

  // --- internals ----------------------------------------------------------

  async boot() {
    // 1. Try the shared token first.
    let token = null;
    try { token = await getSharedToken(); } catch {}
    if (token) {
      await this.checkWhoami(token);
      if (!this.destroyed) this.startWhoamiTimer();
      return;
    }
    // 2. No token → fall through to grace logic.
    await this.checkGraceAndRender();
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
      // the user out — the host app stays usable.
      this.setState({ phase: 'grace', error: errorMessage(e) });
    }
  }

  async checkWhoami(token) {
    try {
      const r = await whoami({ apiUrl: this.opts.apiUrl, token });
      if (r.kind === 'ok') {
        this.setState({
          phase: 'authenticated',
          user: r.user,
          device: r.device,
          limit: r.limit,
          license: null,
          error: '',
        });
        return;
      }
      if (r.kind === 'unauthorized') {
        // Server invalidated the token (device removed, etc.) — clear and re-grace.
        await removeSharedToken().catch(() => {});
        await this.checkGraceAndRender();
        return;
      }
      if (r.kind === 'license_expired') {
        this.setState({
          phase: 'license_expired',
          license: {
            code: r.code,
            plan: r.plan,
            message: r.message,
            expiresAt: r.license_expires_at,
            upgradeUrl: r.upgrade_url,
          },
        });
        return;
      }
    } catch (e) {
      // Network failure: don't lock the user out. Stay authenticated if we
      // were before, otherwise fall back to grace.
      if (this.state.phase !== 'authenticated') {
        await this.checkGraceAndRender();
      }
      this.setState({ error: errorMessage(e) });
    }
  }

  startPolling(hardwareId) {
    this.stopPolling();
    const code = this.activationCode;
    const tick = async () => {
      if (this.destroyed) return;
      if (Date.now() > this.activationDeadline) {
        this.setState({ error: 'Activation expired — please try again.' });
        this.stopPolling();
        this.checkGraceAndRender();
        return;
      }
      try {
        const r = await pollActivation({ apiUrl: this.opts.apiUrl, code, hardwareId });
        if (r.status === 'completed' && r.device_token) {
          this.stopPolling();
          await setSharedToken(r.device_token).catch(() => {});
          await this.checkWhoami(r.device_token);
          this.startWhoamiTimer();
          return;
        }
        if (r.status === 'expired' || r.status === 'cancelled') {
          this.stopPolling();
          this.setState({ error: `Activation ${r.status} — please try again.` });
          this.checkGraceAndRender();
          return;
        }
        // pending → keep polling silently
      } catch (e) {
        // Transient network errors are OK during polling — keep trying.
        this.setState({ error: errorMessage(e) });
      }
    };
    this.pollTimer = setInterval(tick, this.opts.pollIntervalMs);
    tick();
  }

  stopPolling() {
    if (this.pollTimer) { clearInterval(this.pollTimer); this.pollTimer = null; }
  }

  startWhoamiTimer() {
    this.stopWhoamiTimer();
    this.whoamiTimer = setInterval(async () => {
      const token = await getSharedToken().catch(() => null);
      if (token) await this.checkWhoami(token);
    }, this.opts.whoamiInterval);
  }

  stopWhoamiTimer() {
    if (this.whoamiTimer) { clearInterval(this.whoamiTimer); this.whoamiTimer = null; }
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
