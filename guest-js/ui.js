// Renders the plugin's floating button + full-screen overlay based on the
// state machine in index.js. Pure DOM — works with any host framework.

import { injectStyles } from './styles.js';

const USER_ICON_SVG = `
<svg viewBox="0 0 24 24" aria-hidden="true">
  <circle cx="12" cy="8" r="4"/>
  <path d="M4 20a8 8 0 0 1 16 0"/>
</svg>`;

export class AuthUI {
  /**
   * @param {object} opts
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
    document.body.appendChild(this.host);
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
      const left = formatGraceRemaining(state.graceExpiresAt);
      this.host.innerHTML = `
        <div class="gac-overlay" role="dialog" aria-modal="true">
          <div class="gac-card">
            <h2>Sign in to continue</h2>
            <p>Your free trial of <b>${escapeHtml(state.appName)}</b> has ended${left ? ` (${left})` : ''}. Sign in with your getapps.cafe account to keep using the app.</p>
            <div class="gac-actions">
              <button class="gac-btn" type="button" id="gac-signin">Open sign-in</button>
            </div>
            <div class="gac-error" id="gac-err">${escapeHtml(state.error || '')}</div>
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
      this.host.innerHTML = `
        <div class="gac-overlay" role="dialog" aria-modal="true">
          <div class="gac-card">
            <h2><span class="gac-spinner"></span>Waiting for sign-in</h2>
            <p>We opened your browser at the activation page. Finish signing in there and this window will close on its own.</p>
            ${url ? `<a class="gac-btn" href="${escapeAttr(url)}" target="_blank" rel="noopener">Re-open activation page</a>` : ''}
            ${code ? `<div style="margin-top:14px"><div class="gac-code">${escapeHtml(code)}</div></div>` : ''}
            <div class="gac-actions" style="margin-top:14px">
              ${dismissible
                ? '<button class="gac-btn gac-btn-ghost" type="button" id="gac-cancel">Cancel — keep using free day</button>'
                : '<span class="gac-btn gac-btn-ghost" style="cursor:default">Sign-in is required to use the app</span>'}
            </div>
            <div class="gac-error" id="gac-err">${escapeHtml(state.error || '')}</div>
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
      this.host.innerHTML = `
        <div class="gac-overlay" role="dialog" aria-modal="true">
          <div class="gac-card">
            <h2>${isTrial ? 'Trial ended' : 'Subscription lapsed'}</h2>
            <p>${escapeHtml(state.license?.message || 'Renew your getapps.cafe subscription to keep using the app.')}</p>
            <div class="gac-actions">
              <button class="gac-btn" type="button" id="gac-upgrade">${isTrial ? 'Upgrade' : 'Renew'}</button>
            </div>
            <div class="gac-error" id="gac-err">${escapeHtml(state.error || '')}</div>
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

function formatGraceRemaining(expiresAt) {
  if (!expiresAt) return '';
  const ms = expiresAt - Date.now();
  if (ms > 0) return '';
  const overdue = Math.floor(-ms / 3600000);
  if (overdue < 1) return 'just expired';
  if (overdue < 24) return `expired ${overdue}h ago`;
  return `expired ${Math.floor(overdue / 24)}d ago`;
}
