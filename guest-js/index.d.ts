// Hand-written types so consumers using TypeScript don't need to wire up tsc.

export type Phase =
  | 'loading'
  | 'authenticated'
  | 'grace'
  | 'locked'
  | 'activating'
  | 'license_expired';

export interface User {
  id: number;
  email: string;
  plan: string;
  license_expires_at?: number | null;
}

export interface Device {
  id: number;
  name: string;
  hardware_id: string;
  platform?: string | null;
}

export interface ActivationInfo {
  code: string;
  url: string;
  expiresAt: number;
}

export interface LicenseState {
  code: string;
  plan?: string;
  message: string;
  expiresAt?: number | null;
  upgradeUrl?: string | null;
}

export interface AuthState {
  phase: Phase;
  appName: string;
  user?: User;
  device?: Device;
  limit?: number;
  activation?: ActivationInfo | null;
  activatingFrom?: 'grace' | 'locked';
  graceExpiresAt?: number;
  license?: LicenseState | null;
  /** True when boot-time whoami failed (network/server unreachable) and the
   * session is being restored from the last successful whoami snapshot.
   * Cleared on the next launch where whoami succeeds. */
  offline?: boolean;
  /** Wall-clock time (ms) of the cached whoami snapshot the current state was
   * restored from. Only set when `offline === true`. */
  lastCheckedAt?: number;
  /** A friendly, non-alarming hint shown in muted text - used when the
   * connectivity problem is automatic-retry territory (boot whoami fail,
   * activation polling tick fail) so the user doesn't see raw
   * `TypeError: Failed to fetch` jargon. Cleared on the next success. */
  offlineNote?: string;
  error?: string;
}

/** CSS-var overrides for the default UI. Any omitted key falls back to the
 * macOS-native light defaults baked into `styles.js`. Values are passed
 * straight to `element.style.setProperty(...)`, so any valid CSS colour /
 * length string works (`#rgb`, `rgb()`, `color-mix(...)`, `12px`, etc.). */
export interface AuthColors {
  bg?: string;
  card?: string;
  ink?: string;
  inkSoft?: string;
  muted?: string;
  accent?: string;
  line?: string;
  lineStrong?: string;
  err?: string;
  radius?: string;
  radiusSm?: string;
}

export type ShortcutMatcher = (event: KeyboardEvent) => boolean;

export interface SetupOptions {
  apiUrl?: string;
  appName: string;
  graceMs?: number;
  pollIntervalMs?: number;
  pollTimeoutMs?: number;
  mountUi?: boolean;
  onChange?: (state: AuthState) => void;
  upgradeUrl?: string | null;
  deviceName?: string;
  colors?: AuthColors;
  /**
   * Hidden shortcut that opens a read-only info modal showing the current
   * user / device / plan / grace state. Defaults to 'Mod+Shift+J'
   * (Cmd on macOS, Ctrl elsewhere). Pass `null` to disable, or a custom
   * KeyboardEvent matcher.
   */
  infoShortcut?: string | ShortcutMatcher | null;
  /**
   * Floating sign-in button offset from the right edge of the viewport
   * (used in the `grace` phase). Number = pixels, string = any CSS length
   * (e.g. '1rem', 'calc(20px + env(safe-area-inset-right))'). Default 20.
   */
  right?: number | string;
  /**
   * Floating sign-in button offset from the bottom edge of the viewport.
   * Same value semantics as `right`. Default 20.
   */
  bottom?: number | string;
}

export interface Auth {
  readonly state: AuthState;
  subscribe(fn: (s: AuthState) => void): () => void;
  startActivation(): Promise<void>;
  cancelActivation(): void;
  signOut(): Promise<void>;
  openUpgradeUrl(): void;
  openAccountUrl(): void;
  /** Force an immediate whoami / grace re-check (bypasses the periodic timer). */
  refresh(): Promise<void>;
  /** Open the hidden info modal. Also triggered by `infoShortcut`. */
  showInfo(): Promise<void>;
  hideInfo(): void;
  toggleInfo(): Promise<void> | void;
  copyHardwareId(): Promise<boolean>;
  destroy(): void;
}

export function setupAuth(opts: SetupOptions): Auth;

// Raw command bindings
export function getHardwareId(): Promise<string>;
export function getPlatformInfo(): Promise<{ name: string; hostname: string | null }>;
export function initActivation(args: {
  apiUrl: string;
  name: string;
  hardwareId: string;
  platform?: string | null;
}): Promise<{ code: string; activation_url: string; expires_in: number }>;
export function pollActivation(args: {
  apiUrl: string;
  code: string;
  hardwareId: string;
}): Promise<{ status: string; device_id?: number; device_token?: string }>;
export function whoami(args: { apiUrl: string; token: string }): Promise<
  | { kind: 'ok'; device: Device; user: User; limit: number }
  | { kind: 'unauthorized' }
  | {
      kind: 'license_expired';
      code: string;
      plan?: string;
      license_expires_at?: number | null;
      upgrade_url?: string | null;
      message: string;
    }
>;
export function getSharedToken(): Promise<string | null>;
export function setSharedToken(token: string): Promise<void>;
export function removeSharedToken(): Promise<void>;
export function getWhoamiCache(): Promise<string | null>;
export function setWhoamiCache(value: string): Promise<void>;
export function removeWhoamiCache(): Promise<void>;
export function getGraceState(graceMs?: number): Promise<{
  first_seen_at: number;
  expires_at: number;
  expired: boolean;
}>;
export function openActivationUrl(url: string): Promise<void>;
