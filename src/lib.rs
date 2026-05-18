//! `tauri-plugin-getappscafe-auth`
//!
//! Drops the getapps.cafe device-activation flow (init / poll / whoami) into
//! any Tauri 2 app, including a shared OS keychain entry so multiple apps on
//! the same machine reuse one license slot.
//!
//! See README.md for the full integration guide.

use tauri::{
    plugin::{Builder as PluginBuilder, TauriPlugin},
    Runtime,
};

mod commands;
mod error;
mod http;
mod models;
mod storage;

pub use error::{Error, Result};

const PLUGIN_NAME: &str = "getappscafe-auth";

/// Default plugin init. No configuration needed — JS side passes API URL etc.
/// per call.
pub fn init<R: Runtime>() -> TauriPlugin<R> {
    PluginBuilder::new(PLUGIN_NAME)
        .invoke_handler(tauri::generate_handler![
            commands::get_hardware_id,
            commands::get_platform_info,
            commands::init_activation,
            commands::poll_activation,
            commands::whoami,
            commands::shared_token_get,
            commands::shared_token_set,
            commands::shared_token_remove,
            commands::get_grace_state,
            commands::open_activation_url,
        ])
        .build()
}
