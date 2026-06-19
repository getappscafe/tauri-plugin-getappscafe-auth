// JS-facing commands. The plugin is intentionally stateless on the Rust side -
// every call passes `api_url` so apps can switch dev/prod without rebuilding
// or storing config in the plugin.

use std::time::{SystemTime, UNIX_EPOCH};
use tauri::command;

use crate::error::{Error, Result};
use crate::http::{self, WhoamiResult};
use crate::models::{GraceState, InitResponse, PlatformInfo, PollResponse};
use crate::storage;

const DEFAULT_GRACE_MS: i64 = 24 * 60 * 60 * 1000;

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

#[command]
pub fn get_hardware_id() -> Result<String> {
    machine_uid::get().map_err(|e| Error::MachineId(e.to_string()))
}

#[command]
pub fn get_platform_info() -> PlatformInfo {
    let name = std::env::consts::OS.to_string();
    // Title-case common values so the server gets readable strings.
    let pretty = match name.as_str() {
        "macos" => "macOS".to_string(),
        "windows" => "Windows".to_string(),
        "linux" => "Linux".to_string(),
        other => other.to_string(),
    };
    PlatformInfo {
        name: pretty,
        hostname: hostname::get()
            .ok()
            .and_then(|s| s.into_string().ok()),
    }
}

#[command]
pub async fn init_activation(
    api_url: String,
    name: String,
    hardware_id: String,
    platform: Option<String>,
) -> Result<InitResponse> {
    http::init_activation(&api_url, &name, &hardware_id, platform.as_deref()).await
}

#[command]
pub async fn poll_activation(
    api_url: String,
    code: String,
    hardware_id: String,
) -> Result<PollResponse> {
    http::poll_activation(&api_url, &code, &hardware_id).await
}

#[command]
pub async fn whoami(api_url: String, token: String) -> Result<WhoamiResult> {
    http::whoami(&api_url, &token).await
}

#[command]
pub fn shared_token_get() -> Result<Option<String>> {
    storage::token_get()
}

#[command]
pub fn shared_token_set(token: String) -> Result<()> {
    storage::token_set(&token)
}

#[command]
pub fn shared_token_remove() -> Result<()> {
    storage::token_remove()
}

#[command]
pub fn whoami_cache_get() -> Result<Option<String>> {
    storage::whoami_cache_get()
}

#[command]
pub fn whoami_cache_set(value: String) -> Result<()> {
    storage::whoami_cache_set(&value)
}

#[command]
pub fn whoami_cache_remove() -> Result<()> {
    storage::whoami_cache_remove()
}

#[command]
pub fn get_grace_state(grace_ms: Option<i64>) -> Result<GraceState> {
    let grace = grace_ms.unwrap_or(DEFAULT_GRACE_MS).max(0);
    let now = now_ms();
    let first = match storage::first_seen_get()? {
        Some(v) => v,
        None => {
            // First boot ever on this machine - record the moment so the
            // grace window starts now, not on next launch.
            storage::first_seen_set(now)?;
            now
        }
    };
    let expires_at = first.saturating_add(grace);
    Ok(GraceState {
        first_seen_at: first,
        expires_at,
        expired: now >= expires_at,
    })
}

// Open the activation URL in the user's default browser. We intentionally
// don't depend on tauri-plugin-shell here - keeps the dependency tree small
// and avoids extra capabilities for the host app to allow.
#[command]
pub fn open_activation_url(url: String) -> Result<()> {
    open::that(&url).map_err(Error::from)
}
