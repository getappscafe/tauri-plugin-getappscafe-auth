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
  // Hidden shortcut that opens a read-only info modal (user/device/plan/grace).
  // Pass a string like 'Mod+Shift+Alt+A' ('Mod' = Cmd on macOS, Ctrl elsewhere),
  // a custom (KeyboardEvent) => boolean matcher, or null to disable.
  infoShortcut: 'Mod+Shift+J',
  // Floating sign-in button position (only used in `grace` phase). Number =
  // px, string = any CSS length (e.g. '1rem', '2vw', 'calc(20px + env(safe-area-inset-bottom))').
  right: 20,
  bottom: 20,
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
    this.infoOpen = false;
    this.infoData = null;
    this._keyHandler = null;

    if (opts.mountUi) {
      // Lazy-load UI to keep headless integrations small.
      import('./ui.js').then(({ AuthUI }) => {
        this.ui = new AuthUI({
          apiUrl: opts.apiUrl,
          fabRight: opts.right,
          fabBottom: opts.bottom,
          onSignInClick: () => this.startActivation(),
          onCancelActivation: () => this.cancelActivation(),
          onUpgradeClick: () => this.openUpgradeUrl(),
          onInfoClose: () => this.hideInfo(),
          onInfoRecheck: () => this.refresh(),
          onInfoSignOut: () => this.signOut(),
          onInfoOpenAccount: () => this.openAccountUrl(),
        });
        this.ui.mount();
        this.ui.render(this.state);
        if (this.infoOpen) this.ui.renderInfo(this.state, this.infoData);
      });
    }

    this._installShortcut();
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

  openAccountUrl() {
    const url = `${this.opts.apiUrl.replace(/\/$/, '')}/account`;
    openActivationUrl(url).catch(() => {
      this.setState({ error: 'Could not open the account page.' });
    });
  }

  async copyHardwareId() {
    const id = this.infoData?.hardwareId
      || await getHardwareId().catch(() => null);
    if (!id) return false;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(id);
      } else {
        const ta = document.createElement('textarea');
        ta.value = id; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      return true;
    } catch {
      return false;
    }
  }

  // Force a fresh license check now (bypasses the periodic whoami timer).
  async refresh() {
    const token = await getSharedToken().catch(() => null);
    if (token) {
      await this.checkWhoami(token);
    } else {
      await this.checkGraceAndRender();
    }
    if (this.infoOpen) await this._loadInfoData();
  }

  // --- info modal ---------------------------------------------------------

  async showInfo() {
    if (this.destroyed) return;
    this.infoOpen = true;
    await this._loadInfoData();
    if (this.ui) this.ui.renderInfo(this.state, this.infoData);
  }

  hideInfo() {
    this.infoOpen = false;
    if (this.ui) this.ui.renderInfo(null, null);
  }

  toggleInfo() {
    return this.infoOpen ? this.hideInfo() : this.showInfo();
  }

  async _loadInfoData() {
    const [hardwareId, platform, token] = await Promise.all([
      getHardwareId().catch(() => null),
      getPlatformInfo().catch(() => null),
      getSharedToken().catch(() => null),
    ]);
    this.infoData = {
      hardwareId,
      platform,
      token, // masked for display in UI
      loadedAt: Date.now(),
    };
  }

  destroy() {
    this.destroyed = true;
    this.stopPolling();
    this.stopWhoamiTimer();
    this._uninstallShortcut();
    if (this.ui) this.ui.unmount();
    this.subs.clear();
  }

  // --- shortcut -----------------------------------------------------------

  _installShortcut() {
    const matcher = makeShortcutMatcher(this.opts.infoShortcut);
    if (!matcher || typeof window === 'undefined') return;
    this._keyHandler = (e) => {
      try {
        if (matcher(e)) {
          e.preventDefault();
          e.stopPropagation();
          this.toggleInfo();
        }
      } catch {}
    };
    // Capture phase so input fields / app handlers can't swallow it first.
    window.addEventListener('keydown', this._keyHandler, true);
  }

  _uninstallShortcut() {
    if (this._keyHandler && typeof window !== 'undefined') {
      window.removeEventListener('keydown', this._keyHandler, true);
    }
    this._keyHandler = null;
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
    if (this.ui) {
      this.ui.render(this.state);
      if (this.infoOpen) this.ui.renderInfo(this.state, this.infoData);
    }
    this.subs.forEach((fn) => { try { fn(this.state); } catch {} });
    if (this.opts.onChange) { try { this.opts.onChange(this.state); } catch {} }
  }
}

function errorMessage(e) {
  if (!e) return '';
  if (typeof e === 'string') return e;
  return e.message || String(e);
}

// Parse a shortcut spec like 'Mod+Shift+Alt+A' into a KeyboardEvent matcher.
// 'Mod' resolves to Cmd on macOS, Ctrl elsewhere — single token for portability.
function makeShortcutMatcher(spec) {
  if (!spec) return null;
  if (typeof spec === 'function') return spec;
  if (typeof spec !== 'string') return null;
  const MOD_TOKENS = ['ctrl', 'control', 'cmd', 'command', 'meta', 'mod', 'shift', 'alt', 'option'];
  const parts = spec.split('+').map((p) => p.trim().toLowerCase()).filter(Boolean);
  const need = {
    ctrl: parts.includes('ctrl') || parts.includes('control'),
    meta: parts.includes('cmd') || parts.includes('command') || parts.includes('meta'),
    mod: parts.includes('mod'),
    shift: parts.includes('shift'),
    alt: parts.includes('alt') || parts.includes('option'),
  };
  const key = parts.find((p) => !MOD_TOKENS.includes(p));
  const isMac = typeof navigator !== 'undefined'
    && /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent || '');
  return (e) => {
    if (!!need.shift !== !!e.shiftKey) return false;
    if (!!need.alt !== !!e.altKey) return false;
    if (need.mod) {
      if (isMac ? !e.metaKey : !e.ctrlKey) return false;
    } else {
      if (!!need.ctrl !== !!e.ctrlKey) return false;
      if (!!need.meta !== !!e.metaKey) return false;
    }
    if (key) {
      // Use e.code for letters/digits so Alt-as-modifier on macOS (which
      // remaps e.key to glyphs like 'å') doesn't break matching.
      if (/^[a-z]$/.test(key)) {
        if (e.code !== `Key${key.toUpperCase()}`) return false;
      } else if (/^[0-9]$/.test(key)) {
        if (e.code !== `Digit${key}` && e.code !== `Numpad${key}`) return false;
      } else {
        if ((e.key || '').toLowerCase() !== key) return false;
      }
    }
    return true;
  };
}
