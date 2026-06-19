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
   * @param {() => void} opts.onSignInClick
   * @param {() => void} opts.onCancelActivation
   * @param {() => void} opts.onUpgradeClick
   */
  constructor(opts) {
    this.opts = opts;
    this.host = null;
    this.lastState = null;
  }

  mount() {
    if (this.host) return;
    injectStyles();
    this.host = document.createElement('div');
    this.host.className = 'gac-host';
    this.host.setAttribute('data-getappscafe-auth', '');
    if (this.opts.colors) this.applyColors(this.opts.colors);
    document.body.appendChild(this.host);
  }

  applyColors(colors) {
    for (const [key, value] of Object.entries(colors)) {
      const cssVar = COLOR_VARS[key];
      if (cssVar && value != null) this.host.style.setProperty(cssVar, String(value));
    }
  }

  unmount() {
    if (this.host && this.host.parentNode) this.host.parentNode.removeChild(this.host);
    this.host = null;
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
      this.host.querySelector('.gac-fab').onclick = () => this.opts.onSignInClick();
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
              ${url ? `<a class="gac-btn" href="${escapeAttr(url)}" target="_blank" rel="noopener">Re-open sign-in page</a>` : ''}
            </div>
          </div>
        </div>
      `;
      if (dismissible) {
        const cancelEl = this.host.querySelector('#gac-cancel');
        if (cancelEl) cancelEl.onclick = () => this.opts.onCancelActivation();
      }
      return;
    }
    if (phase === 'license_expired') {
      const isTrial = state.license?.code === 'trial_expired';
      const offlineHint = state.offline && state.lastCheckedAt
        ? `<p class="gac-note">Last verified ${formatAgo(state.lastCheckedAt)} - you appear to be offline.</p>`
        : '';
      this.host.innerHTML = `
        <div class="gac-overlay" role="dialog" aria-modal="true">
          <div class="gac-card">
            <h2>${isTrial ? 'Trial ended' : 'Subscription lapsed'}</h2>
            <p>${escapeHtml(state.license?.message || 'Renew your getapps.cafe subscription to keep using the app.')}</p>
            ${offlineHint}
            <div class="gac-error" id="gac-err">${escapeHtml(state.error || '')}</div>
            <div class="gac-actions">
              <button class="gac-btn gac-btn-primary" type="button" id="gac-upgrade">${isTrial ? 'Upgrade' : 'Renew'}</button>
            </div>
          </div>
        </div>
      `;
      this.host.querySelector('#gac-upgrade').onclick = () => this.opts.onUpgradeClick();
      return;
    }
  }
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
