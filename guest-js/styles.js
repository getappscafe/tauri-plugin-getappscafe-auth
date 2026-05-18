// Stylesheet injected once into the host app. CSS variables let consumers
// theme the plugin without forking — see README for the full var list.
export const STYLE_ID = 'getappscafe-auth-styles';

export const CSS = `
.gac-host {
  --gac-z: 2147483600;
  --gac-bg: rgba(15, 11, 7, 0.72);
  --gac-card: #faf6ef;
  --gac-ink: #2b1810;
  --gac-ink-soft: #4a3528;
  --gac-muted: #8b7355;
  --gac-accent: #c84b1c;
  --gac-line: rgba(43, 24, 16, 0.12);
  --gac-radius: 14px;
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
  color: var(--gac-ink);
}

.gac-fab {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: var(--gac-accent);
  color: #faf6ef;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 6px 18px rgba(200, 75, 28, 0.35);
  z-index: var(--gac-z);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.gac-fab:hover { transform: translateY(-2px); box-shadow: 0 8px 22px rgba(200,75,28,0.45); }
.gac-fab:active { transform: translateY(0); }
.gac-fab svg { width: 26px; height: 26px; stroke: currentColor; fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }

.gac-overlay {
  position: fixed;
  inset: 0;
  background: var(--gac-bg);
  z-index: var(--gac-z);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}

.gac-card {
  background: var(--gac-card);
  border-radius: var(--gac-radius);
  padding: 32px 28px;
  width: 100%;
  max-width: 420px;
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.4);
  text-align: center;
}

.gac-card h2 {
  font-family: "Fraunces", Georgia, serif;
  font-size: 24px;
  font-weight: 600;
  margin: 0 0 8px;
}

.gac-card p {
  color: var(--gac-ink-soft);
  font-size: 14px;
  line-height: 1.55;
  margin: 0 0 18px;
}

.gac-card .gac-code {
  font-family: "JetBrains Mono", ui-monospace, monospace;
  background: rgba(43, 24, 16, 0.06);
  padding: 10px 14px;
  border-radius: 8px;
  letter-spacing: 0.1em;
  font-size: 13px;
  margin-bottom: 14px;
  word-break: break-all;
  display: inline-block;
}

.gac-btn {
  display: inline-block;
  background: var(--gac-accent);
  color: #faf6ef;
  border: none;
  border-radius: 10px;
  padding: 12px 22px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  text-decoration: none;
  font-family: inherit;
  transition: background 0.15s ease;
}
.gac-btn:hover { background: #d65d2e; }
.gac-btn:disabled { opacity: 0.55; cursor: default; }

.gac-btn.gac-btn-ghost {
  background: transparent;
  color: var(--gac-muted);
  padding: 8px 14px;
  font-size: 13px;
}
.gac-btn.gac-btn-ghost:hover { color: var(--gac-ink); background: transparent; }

.gac-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: center;
}

.gac-error {
  color: var(--gac-accent);
  font-size: 13px;
  margin-top: 10px;
  min-height: 18px;
}

.gac-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid var(--gac-line);
  border-top-color: var(--gac-accent);
  border-radius: 50%;
  display: inline-block;
  margin-right: 8px;
  vertical-align: -3px;
  animation: gac-spin 0.8s linear infinite;
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
