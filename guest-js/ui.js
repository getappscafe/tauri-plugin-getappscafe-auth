// Renders the plugin's floating button + full-screen overlay based on the
// state machine in index.js. Pure DOM - works with any host framework.

import { injectStyles } from './styles.js';

const USER_ICON_SVG = `
<svg viewBox="0 0 24 24" aria-hidden="true">
  <circle cx="12" cy="8" r="4"/>
  <path d="M4 20a8 8 0 0 1 16 0"/>
</svg>`;

// camelCase → CSS var name. Anything not listed here is ignored, so
// unknown keys can't punch holes in the stylesheet.
const COLOR_VARS = {
  bg:         '--gac-bg',
  card:       '--gac-card',
  ink:        '--gac-ink',
  inkSoft:    '--gac-ink-soft',
  muted:      '--gac-muted',
  accent:     '--gac-accent',
  line:       '--gac-line',
  lineStrong: '--gac-line-strong',
  err:        '--gac-err',
  radius:     '--gac-radius',
  radiusSm:   '--gac-radius-sm',
};

export class AuthUI {
  /**
   * @param {object} opts
   * @param {object} [opts.colors] CSS-var overrides - see README.
   * @param {string} [opts.apiUrl]
   * @param {number|string} [opts.fabRight]
   * @param {number|string} [opts.fabBottom]
   * @param {() => void} opts.onSignInClick
   * @param {() => void} opts.onReopenActivationUrl
   * @param {() => void} opts.onCancelActivation
   * @param {() => void} opts.onUpgradeClick
   * @param {() => void} [opts.onInfoClose]
   * @param {() => void} [opts.onInfoRecheck]
   * @param {() => void} [opts.onInfoSignOut]
   * @param {() => void} [opts.onInfoOpenAccount]
   */
  constructor(opts) {
    this.opts = opts;
    this.host = null;        // phase-driven UI (fab / overlay)
    this.infoHost = null;    // info modal — independent layer so it overlays any phase
    this.lastState = null;
    this._infoKeyHandler = null;
  }

  mount() {
    if (this.host) return;
    injectStyles();
    this.host = document.createElement('div');
    this.host.className = 'gac-host';
    this.host.setAttribute('data-getappscafe-auth', '');
    if (this.opts.colors) this.applyColors(this.opts.colors);
    document.body.appendChild(this.host);

    this.infoHost = document.createElement('div');
    this.infoHost.className = 'gac-host';
    this.infoHost.setAttribute('data-getappscafe-auth-info', '');
    document.body.appendChild(this.infoHost);
  }

  applyColors(colors) {
    for (const [key, value] of Object.entries(colors)) {
      const cssVar = COLOR_VARS[key];
      if (cssVar && value != null) this.host.style.setProperty(cssVar, String(value));
    }
  }

  unmount() {
    if (this._infoKeyHandler) {
      document.removeEventListener('keydown', this._infoKeyHandler, true);
      this._infoKeyHandler = null;
    }
    if (this.host && this.host.parentNode) this.host.parentNode.removeChild(this.host);
    if (this.infoHost && this.infoHost.parentNode) this.infoHost.parentNode.removeChild(this.infoHost);
    this.host = null;
    this.infoHost = null;
  }

  render(state) {
    if (!this.host) this.mount();
    this.lastState = state;
    const phase = state.phase;

    if (phase === 'authenticated' || phase === 'loading') {
      this.host.innerHTML = '';
      return;
    }
    if (phase === 'grace') {
      this.host.innerHTML = `
        <button class="gac-fab" type="button" aria-label="Sign in">
          ${USER_ICON_SVG}
        </button>
      `;
      const fab = this.host.querySelector('.gac-fab');
      const right = cssLength(this.opts.fabRight);
      const bottom = cssLength(this.opts.fabBottom);
      if (right != null) fab.style.right = right;
      if (bottom != null) fab.style.bottom = bottom;
      fab.onclick = () => this.opts.onSignInClick();
      return;
    }
    if (phase === 'locked') {
      const offlineNote = state.offlineNote
        ? `<p class="gac-note">${escapeHtml(state.offlineNote)}</p>`
        : '';
      this.host.innerHTML = `
        <div class="gac-overlay" role="dialog" aria-modal="true">
          <div class="gac-card">
            <h2>Sign in to continue</h2>
            <p>Your trial period has ended. Sign in with your getapps.cafe account to continue using <b>${escapeHtml(state.appName)}</b>.</p>
            ${offlineNote}
            <div class="gac-error" id="gac-err">${escapeHtml(state.error || '')}</div>
            <div class="gac-actions">
              <button class="gac-btn gac-btn-primary" type="button" id="gac-signin">Sign in</button>
            </div>
          </div>
        </div>
      `;
      this.host.querySelector('#gac-signin').onclick = () => this.opts.onSignInClick();
      return;
    }
    if (phase === 'activating') {
      const { activation } = state;
      const url = activation?.url || '';
      const code = activation?.code || '';
      const dismissible = state.activatingFrom === 'grace';
      const offlineNote = state.offlineNote
        ? `<p class="gac-note">${escapeHtml(state.offlineNote)}</p>`
        : '';
      this.host.innerHTML = `
        <div class="gac-overlay" role="dialog" aria-modal="true">
          <div class="gac-card">
            <h2><span class="gac-spinner" aria-hidden="true"></span>Waiting for sign-in</h2>
            <p>Finish signing in on the page that opened in your browser. This window will close on its own.</p>
            ${code ? `<p class="gac-note">If asked, confirm this code:</p><div class="gac-code">${escapeHtml(code)}</div>` : ''}
            ${!dismissible ? '<p class="gac-note">Sign-in is required to use the app.</p>' : ''}
            ${offlineNote}
            <div class="gac-error" id="gac-err">${escapeHtml(state.error || '')}</div>
            <div class="gac-actions">
              ${dismissible ? '<button class="gac-btn gac-btn-ghost" type="button" id="gac-cancel">Cancel</button>' : ''}
              ${url ? '<button class="gac-btn" type="button" id="gac-reopen">Re-open sign-in page</button>' : ''}
            </div>
          </div>
        </div>
      `;
      if (dismissible) {
        const cancelEl = this.host.querySelector('#gac-cancel');
        if (cancelEl) cancelEl.onclick = () => this.opts.onCancelActivation();
      }
      const reopenEl = this.host.querySelector('#gac-reopen');
      if (reopenEl) reopenEl.onclick = () => this.opts.onReopenActivationUrl?.();
      return;
    }
    if (phase === 'license_expired') {
      const isTrial = state.license?.code === 'trial_expired';
      const offlineHint = state.offline && state.lastCheckedAt
        ? `<p class="gac-note">Last verified ${formatAgo(state.lastCheckedAt)} - you appear to be offline.</p>`
        : '';
      const checkedHint = !state.offline && state.lastCheckedAt
        ? `<p class="gac-note">Last checked ${formatAgo(state.lastCheckedAt)}. License is still showing as ${isTrial ? 'trial-ended' : 'lapsed'}.</p>`
        : '';
      const checking = !!state.checking;
      this.host.innerHTML = `
        <div class="gac-overlay" role="dialog" aria-modal="true">
          <div class="gac-card">
            <h2>${isTrial ? 'Trial ended' : 'Subscription lapsed'}</h2>
            <p>${escapeHtml(state.license?.message || 'Renew your getapps.cafe subscription to keep using the app.')}</p>
            <p class="gac-note">Already subscribed? Click <b>Check again</b> after completing your purchase.</p>
            ${offlineHint}
            ${checkedHint}
            <div class="gac-error" id="gac-err">${escapeHtml(state.error || '')}</div>
            <div class="gac-actions">
              <button class="gac-btn" type="button" id="gac-recheck"${checking ? ' disabled' : ''}>
                ${checking ? '<span class="gac-spinner" aria-hidden="true"></span>Checking…' : 'Check again'}
              </button>
              <button class="gac-btn gac-btn-primary" type="button" id="gac-upgrade">${isTrial ? 'Upgrade' : 'Renew'}</button>
            </div>
          </div>
        </div>
      `;
      this.host.querySelector('#gac-upgrade').onclick = () => this.opts.onUpgradeClick();
      const recheckEl = this.host.querySelector('#gac-recheck');
      if (recheckEl && !checking) recheckEl.onclick = () => this.opts.onInfoRecheck?.();
      return;
    }
  }

  /**
   * Render (or hide) the hidden info modal. Pass `state = null` to close.
   * @param {object|null} state
   * @param {object|null} infoData { hardwareId, platform, token }
   */
  renderInfo(state, infoData) {
    if (!this.infoHost) this.mount();
    if (!state) {
      this.infoHost.innerHTML = '';
      if (this._infoKeyHandler) {
        document.removeEventListener('keydown', this._infoKeyHandler, true);
        this._infoKeyHandler = null;
      }
      return;
    }
    const user = state.user;
    const device = state.device;
    const license = state.license;
    const platformName = infoData?.platform?.name || device?.platform || '—';
    const hostname = infoData?.platform?.hostname || '—';
    const hardwareId = infoData?.hardwareId || device?.hardware_id || '—';
    const tokenLine = infoData?.token
      ? `${infoData.token.slice(0, 6)}…${infoData.token.slice(-4)} (${infoData.token.length} chars)`
      : '— (not signed in)';
    const phaseBadge = state.phase || '—';
    const apiUrl = this.opts.apiUrl || '—';
    const graceRemaining = state.graceExpiresAt
      ? humanRemaining(state.graceExpiresAt - Date.now())
      : '—';
    const licenseExpiresAt = user?.license_expires_at || license?.expiresAt;

    this.infoHost.innerHTML = `
      <div class="gac-overlay gac-info-overlay" role="dialog" aria-modal="true">
        <div class="gac-card gac-info-card">
          <button type="button" class="gac-info-close" aria-label="Close" id="gac-info-x">×</button>
          <h2>Account info</h2>
          <div class="gac-info-grid">
            ${row('Phase', `<span class="gac-info-badge gac-info-phase-${escapeAttr(phaseBadge)}">${escapeHtml(phaseBadge)}</span>`)}
            ${row('App', escapeHtml(state.appName || '—'))}
            ${row('API', escapeHtml(apiUrl))}
            ${section('User')}
            ${row('Email', escapeHtml(user?.email || '— (not signed in)'))}
            ${row('Plan', escapeHtml(user?.plan || license?.plan || '—'))}
            ${row('User ID', user?.id != null ? String(user.id) : '—')}
            ${row('License expires', formatTime(licenseExpiresAt))}
            ${row('Devices on plan', state.limit != null ? String(state.limit) : '—')}
            ${section('Device')}
            ${row('Name', escapeHtml(device?.name || hostname))}
            ${row('Hardware ID', `<code class="gac-info-mono">${escapeHtml(hardwareId)}</code>`)}
            ${row('Platform', escapeHtml(platformName))}
            ${row('Device ID', device?.id != null ? String(device.id) : '—')}
            ${state.phase !== 'authenticated' ? `
              ${section('Trial')}
              ${row('Time remaining', escapeHtml(graceRemaining))}
              ${row('Trial expires', formatTime(state.graceExpiresAt))}
            ` : ''}
            ${section('Token')}
            ${row('Stored', escapeHtml(tokenLine))}
            ${license?.message ? section('License message') + `<div class="gac-info-msg">${escapeHtml(license.message)}</div>` : ''}
            ${state.error ? section('Error') + `<div class="gac-error" style="text-align:left;margin:0">${escapeHtml(state.error)}</div>` : ''}
          </div>
          <div class="gac-actions gac-info-actions">
            <button class="gac-btn" type="button" id="gac-info-recheck">Re-check now</button>
            <button class="gac-btn gac-btn-ghost" type="button" id="gac-info-account">Open account page</button>
            <button class="gac-btn gac-btn-ghost" type="button" id="gac-info-signout">Sign out</button>
          </div>
        </div>
      </div>
    `;

    const root = this.infoHost;
    const bind = (id, fn) => {
      const el = root.querySelector(`#${id}`);
      if (el && fn) el.onclick = () => fn();
    };
    bind('gac-info-x', this.opts.onInfoClose);
    bind('gac-info-recheck', this.opts.onInfoRecheck);
    bind('gac-info-account', this.opts.onInfoOpenAccount);
    bind('gac-info-signout', this.opts.onInfoSignOut);

    // Backdrop click closes.
    const overlay = root.querySelector('.gac-info-overlay');
    if (overlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) this.opts.onInfoClose?.();
      });
    }
    // Escape closes — install once.
    if (!this._infoKeyHandler) {
      this._infoKeyHandler = (e) => {
        if (e.key === 'Escape' && this.infoHost && this.infoHost.childElementCount > 0) {
          e.preventDefault();
          this.opts.onInfoClose?.();
        }
      };
      document.addEventListener('keydown', this._infoKeyHandler, true);
    }
  }
}

function row(label, valueHtml) {
  return `<div class="gac-info-row"><span class="gac-info-label">${escapeHtml(label)}</span><span class="gac-info-value">${valueHtml}</span></div>`;
}
function section(label) {
  return `<div class="gac-info-section">${escapeHtml(label)}</div>`;
}
function formatTime(ms) {
  if (!ms) return '—';
  try { return new Date(ms).toLocaleString(); } catch { return String(ms); }
}
function humanRemaining(ms) {
  if (ms == null) return '—';
  const sign = ms < 0 ? '-' : '';
  const abs = Math.abs(ms);
  const days = Math.floor(abs / 86400000);
  const hours = Math.floor((abs % 86400000) / 3600000);
  const mins = Math.floor((abs % 3600000) / 60000);
  if (days >= 1) return `${sign}${days}d ${hours}h`;
  if (hours >= 1) return `${sign}${hours}h ${mins}m`;
  return `${sign}${mins}m`;
}

function cssLength(v) {
  if (v == null) return null;
  if (typeof v === 'number') return `${v}px`;
  if (typeof v === 'string' && v.trim()) return v;
  return null;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}
function escapeAttr(s) { return escapeHtml(s); }

function formatAgo(ts) {
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'just now';
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
