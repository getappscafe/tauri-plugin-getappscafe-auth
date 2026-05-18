// Thin async HTTP client over `reqwest`. Talks to a getapps.cafe server.
// All bodies use JSON. Auth is via `Authorization: Bearer <device_token>`
// on whoami; init/poll are unauthenticated.

use reqwest::Client;
use std::time::Duration;
use crate::error::{Error, Result};
use crate::models::{InitResponse, PollResponse, WhoamiResponse};

fn client() -> Result<Client> {
    Client::builder()
        .timeout(Duration::from_secs(15))
        .user_agent(concat!(
            "tauri-plugin-getappscafe-auth/",
            env!("CARGO_PKG_VERSION"),
        ))
        .build()
        .map_err(Error::from)
}

fn join(base: &str, path: &str) -> String {
    let trimmed = base.trim_end_matches('/');
    format!("{trimmed}{path}")
}

pub async fn init_activation(
    api_url: &str,
    name: &str,
    hardware_id: &str,
    platform: Option<&str>,
) -> Result<InitResponse> {
    let body = serde_json::json!({
        "name": name,
        "hardware_id": hardware_id,
        "platform": platform,
    });
    let res = client()?
        .post(join(api_url, "/api/devices/init"))
        .json(&body)
        .send()
        .await?;
    parse_json(res).await
}

pub async fn poll_activation(
    api_url: &str,
    code: &str,
    hardware_id: &str,
) -> Result<PollResponse> {
    let url = join(api_url, "/api/devices/poll");
    let res = client()?
        .get(url)
        .query(&[("code", code), ("hardware_id", hardware_id)])
        .send()
        .await?;
    parse_json(res).await
}

#[derive(Debug, serde::Serialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum WhoamiResult {
    Ok(WhoamiResponse),
    Unauthorized,
    LicenseExpired {
        code: String,
        plan: Option<String>,
        license_expires_at: Option<i64>,
        upgrade_url: Option<String>,
        message: String,
    },
}

pub async fn whoami(api_url: &str, token: &str) -> Result<WhoamiResult> {
    let res = client()?
        .get(join(api_url, "/api/devices/whoami"))
        .bearer_auth(token)
        .send()
        .await?;
    let status = res.status();
    if status.is_success() {
        return Ok(WhoamiResult::Ok(res.json().await?));
    }
    if status.as_u16() == 401 {
        return Ok(WhoamiResult::Unauthorized);
    }
    if status.as_u16() == 402 {
        let body: serde_json::Value = res.json().await.unwrap_or_default();
        return Ok(WhoamiResult::LicenseExpired {
            code: body
                .get("code")
                .and_then(|v| v.as_str())
                .unwrap_or("license_expired")
                .into(),
            plan: body
                .get("plan")
                .and_then(|v| v.as_str())
                .map(String::from),
            license_expires_at: body.get("license_expires_at").and_then(|v| v.as_i64()),
            upgrade_url: body
                .get("upgrade_url")
                .and_then(|v| v.as_str())
                .map(String::from),
            message: body
                .get("error")
                .and_then(|v| v.as_str())
                .unwrap_or("License required.")
                .into(),
        });
    }
    let body = res.text().await.unwrap_or_default();
    Err(Error::BadStatus { status: status.as_u16(), body })
}

async fn parse_json<T: for<'de> serde::Deserialize<'de>>(res: reqwest::Response) -> Result<T> {
    let status = res.status();
    if !status.is_success() {
        let body = res.text().await.unwrap_or_default();
        return Err(Error::BadStatus { status: status.as_u16(), body });
    }
    res.json::<T>().await.map_err(Error::from)
}
