// Stylesheet injected once into the host app. Follows the cafe.getapps.*
// macOS-native light design system (see Team-tauri-template/DESIGN.md).
// CSS variables are namespaced (`--gac-*`) so the plugin never collides with
// the host app's tokens; consumers can still override any of them.
export const STYLE_ID = 'getappscafe-auth-styles';

export const CSS = `
.gac-host {
  --gac-z: 2147483600;

  /* macOS-native light palette */
  --gac-bg:        #f5f5f7;
  --gac-ink:       #1d1d1f;
  --gac-ink-soft:  #3a3a3c;
  --gac-muted:     #6e6e73;
  --gac-accent:    #007aff;
  --gac-card:      #ffffff;
  --gac-line:      rgba(0, 0, 0, 0.07);
  --gac-line-strong: rgba(0, 0, 0, 0.10);
  --gac-err:       #ff3b30;

  --gac-radius:    10px;
  --gac-radius-sm: 6px;
  --gac-shadow:    0 1px 2px rgba(0, 0, 0, 0.04), 0 8px 28px rgba(0, 0, 0, 0.10);

  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, sans-serif;
  color: var(--gac-ink);
  -webkit-font-smoothing: antialiased;
}

/* ----- floating action button (grace mode) -----
   White card with accent icon: feels closer to a macOS toolbar button than a
   coloured Material-style FAB. */
.gac-fab {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--gac-card);
  color: var(--gac-accent);
  border: 1px solid var(--gac-line-strong);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--gac-shadow);
  z-index: var(--gac-z);
  transition: background 0.12s, border-color 0.12s, transform 0.12s;
}
.gac-fab:hover  { background: var(--gac-bg); border-color: color-mix(in srgb, var(--gac-accent) 35%, var(--gac-line-strong)); }
.gac-fab:active { transform: scale(0.97); }
.gac-fab svg {
  width: 18px; height: 18px;
  fill: none; stroke: currentColor;
  stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round;
}

/* ----- overlay (locked / activating / license_expired) ----- */
.gac-overlay {
  position: fixed;
  inset: 0;
  background: rgba(245, 245, 247, 0.55);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  z-index: var(--gac-z);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

/* ----- card (NSAlert-style) ----- */
.gac-card {
  background: var(--gac-card);
  border: 1px solid var(--gac-line);
  border-radius: var(--gac-radius);
  box-shadow: var(--gac-shadow);
  padding: 22px 22px 18px;
  width: 100%;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.gac-card h2 {
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.01em;
  margin: 0;
  color: var(--gac-ink);
  display: flex;
  align-items: center;
  gap: 8px;
}

.gac-card p {
  color: var(--gac-ink-soft);
  font-size: 13px;
  line-height: 1.5;
  margin: 0;
}

.gac-card .gac-code {
  font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
  background: var(--gac-bg);
  border: 1px solid var(--gac-line);
  padding: 8px 12px;
  border-radius: var(--gac-radius-sm);
  letter-spacing: 0.06em;
  font-size: 12px;
  color: var(--gac-ink);
  align-self: flex-start;
  user-select: text;
  -webkit-user-select: text;
}

.gac-note {
  font-size: 12px;
  color: var(--gac-muted);
  margin: 0;
}

.gac-error {
  color: var(--gac-err);
  font-size: 12px;
  margin: 0;
  min-height: 14px;
}
.gac-error:empty { display: none; }

/* ----- actions (NSAlert: right-aligned, primary on the right) ----- */
.gac-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}

/* ----- buttons ----- */
.gac-btn {
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  padding: 5px 14px;
  min-height: 26px;
  border: 1px solid var(--gac-line-strong);
  border-radius: var(--gac-radius-sm);
  background: var(--gac-card);
  color: var(--gac-ink);
  cursor: pointer;
  white-space: nowrap;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background 0.12s, border-color 0.12s, color 0.12s;
}
.gac-btn:hover:not(:disabled) { background: var(--gac-bg); }
.gac-btn:disabled { opacity: 0.45; cursor: not-allowed; }

.gac-btn.gac-btn-primary {
  background: var(--gac-accent);
  border-color: var(--gac-accent);
  color: #ffffff;
}
.gac-btn.gac-btn-primary:hover:not(:disabled) { filter: brightness(0.94); }

.gac-btn.gac-btn-ghost {
  border-color: transparent;
  background: transparent;
  color: var(--gac-muted);
}
.gac-btn.gac-btn-ghost:hover:not(:disabled) { color: var(--gac-ink); background: var(--gac-bg); }

/* ----- spinner ----- */
.gac-spinner {
  width: 13px;
  height: 13px;
  border: 1.5px solid var(--gac-line-strong);
  border-top-color: var(--gac-accent);
  border-radius: 50%;
  display: inline-block;
  animation: gac-spin 0.7s linear infinite;
  flex-shrink: 0;
}
@keyframes gac-spin { to { transform: rotate(360deg); } }
`;

export function injectStyles(doc = document) {
  if (doc.getElementById(STYLE_ID)) return;
  const el = doc.createElement('style');
  el.id = STYLE_ID;
  el.textContent = CSS;
  doc.head.appendChild(el);
}
