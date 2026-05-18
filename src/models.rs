use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct InitResponse {
    pub code: String,
    pub activation_url: String,
    pub expires_in: u64,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct PollResponse {
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub device_id: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub device_token: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DeviceInfo {
    pub id: i64,
    pub name: String,
    pub hardware_id: String,
    pub platform: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UserInfo {
    pub id: i64,
    pub email: String,
    pub plan: String,
    #[serde(default)]
    pub license_expires_at: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WhoamiResponse {
    pub device: DeviceInfo,
    pub user: UserInfo,
    pub limit: i64,
}

#[derive(Debug, Serialize)]
pub struct GraceState {
    pub first_seen_at: i64,
    pub expires_at: i64,
    pub expired: bool,
}

#[derive(Debug, Serialize)]
pub struct PlatformInfo {
    pub name: String,
    pub hostname: Option<String>,
}
