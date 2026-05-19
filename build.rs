const COMMANDS: &[&str] = &[
    "get_hardware_id",
    "get_platform_info",
    "init_activation",
    "poll_activation",
    "whoami",
    "shared_token_get",
    "shared_token_set",
    "shared_token_remove",
    "get_grace_state",
    "open_activation_url",
];

fn main() {
    tauri_plugin::Builder::new(COMMANDS).build();
}
