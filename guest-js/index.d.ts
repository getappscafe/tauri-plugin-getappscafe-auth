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
  error?: string;
}

export interface SetupOptions {
  apiUrl?: string;
  appName: string;
  graceMs?: number;
  pollIntervalMs?: number;
  pollTimeoutMs?: number;
  whoamiInterval?: number;
  mountUi?: boolean;
  onChange?: (state: AuthState) => void;
  upgradeUrl?: string | null;
  deviceName?: string;
}

export interface Auth {
  readonly state: AuthState;
  subscribe(fn: (s: AuthState) => void): () => void;
  startActivation(): Promise<void>;
  cancelActivation(): void;
  signOut(): Promise<void>;
  openUpgradeUrl(): void;
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
export function getGraceState(graceMs?: number): Promise<{
  first_seen_at: number;
  expires_at: number;
  expired: boolean;
}>;
export function openActivationUrl(url: string): Promise<void>;
