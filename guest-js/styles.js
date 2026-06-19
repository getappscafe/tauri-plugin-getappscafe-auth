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

/* ----- floating action button (grace mode) ----- */
.gac-fab {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--gac-accent);
  color: #fff;
  border: 1px solid var(--gac-accent);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--gac-shadow);
  z-index: var(--gac-z);
  transition: background 0.12s, border-color 0.12s, transform 0.12s;
}
.gac-fab:hover  { background: color-mix(in srgb, var(--gac-accent) 88%, #000); border-color: color-mix(in srgb, var(--gac-accent) 88%, #000); }
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

.gac-info-overlay { z-index: calc(var(--gac-z) + 10); }
.gac-info-card {
  max-width: 520px;
  text-align: left;
  position: relative;
  padding: 26px 26px 22px;
}
.gac-info-card h2 { text-align: center; margin-bottom: 14px; }
.gac-info-close {
  position: absolute;
  top: 10px; right: 14px;
  background: transparent;
  border: none;
  color: var(--gac-muted);
  font-size: 26px;
  line-height: 1;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
}
.gac-info-close:hover { color: var(--gac-ink); background: rgba(43,24,16,0.06); }
.gac-info-grid {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 18px;
  max-height: 60vh;
  overflow-y: auto;
  padding-right: 6px;
  scrollbar-width: thin;
  scrollbar-color: rgba(43, 24, 16, 0.25) transparent;
}
.gac-info-grid::-webkit-scrollbar { width: 8px; }
.gac-info-grid::-webkit-scrollbar-track { background: transparent; }
.gac-info-grid::-webkit-scrollbar-thumb {
  background: rgba(43, 24, 16, 0.18);
  border-radius: 999px;
  border: 2px solid transparent;
  background-clip: padding-box;
}
.gac-info-grid::-webkit-scrollbar-thumb:hover { background: rgba(43, 24, 16, 0.32); background-clip: padding-box; }
.gac-info-section {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--gac-muted);
  margin: 10px 0 4px;
  border-bottom: 1px solid var(--gac-line);
  padding-bottom: 4px;
}
.gac-info-row {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  font-size: 13px;
  line-height: 1.4;
  padding: 3px 0;
}
.gac-info-label { color: var(--gac-muted); flex-shrink: 0; }
.gac-info-value {
  text-align: right;
  color: var(--gac-ink);
  word-break: break-all;
  min-width: 0;
}
.gac-info-mono {
  font-family: "JetBrains Mono", ui-monospace, monospace;
  font-size: 12px;
  background: rgba(43, 24, 16, 0.06);
  padding: 2px 6px;
  border-radius: 4px;
}
.gac-info-msg {
  font-size: 13px;
  color: var(--gac-ink-soft);
  background: rgba(43, 24, 16, 0.05);
  padding: 8px 10px;
  border-radius: 6px;
}
.gac-info-badge {
  font-family: "JetBrains Mono", ui-monospace, monospace;
  font-size: 11px;
  text-transform: uppercase;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(43, 24, 16, 0.08);
  color: var(--gac-ink);
}
.gac-info-phase-authenticated { background: rgba(45, 130, 60, 0.18); color: #2d6b3a; }
.gac-info-phase-grace { background: rgba(200, 75, 28, 0.15); color: var(--gac-accent); }
.gac-info-phase-locked { background: rgba(180, 30, 30, 0.18); color: #a01f1f; }
.gac-info-phase-license_expired { background: rgba(180, 30, 30, 0.18); color: #a01f1f; }
.gac-info-actions {
  flex-direction: row;
  flex-wrap: wrap;
  justify-content: center;
}
`;

export function injectStyles(doc = document) {
  if (doc.getElementById(STYLE_ID)) return;
  const el = doc.createElement('style');
  el.id = STYLE_ID;
  el.textContent = CSS;
  doc.head.appendChild(el);
}
