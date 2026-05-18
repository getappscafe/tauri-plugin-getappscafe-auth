// Cross-platform shared credential store keyed by a fixed service name so
// every app on the machine that uses this plugin reads/writes the same slot.
//
// macOS: Keychain. Apps that want to share **must** be signed with the same
//        Apple Team ID and declare a common `keychain-access-groups` entry.
// Windows: Credential Manager (per user). Same service+account = same entry.
// Linux: libsecret schema. Same service+account = same entry.
//
// IMPORTANT: keyring entries persist after uninstall on macOS/Windows. That's
// usually what you want — the user shouldn't lose their license by removing
// one app. Use `remove()` only on a deliberate sign-out / 401.

use keyring::Entry;
use crate::error::{Error, Result};

const SERVICE: &str = "cafe.getapps.device";
const ACCOUNT_TOKEN: &str = "device_token";
const ACCOUNT_FIRST_SEEN: &str = "first_seen_at_ms";

fn entry(account: &str) -> Result<Entry> {
    Entry::new(SERVICE, account).map_err(Error::from)
}

pub fn token_get() -> Result<Option<String>> {
    match entry(ACCOUNT_TOKEN)?.get_password() {
        Ok(s) => Ok(Some(s)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.into()),
    }
}

pub fn token_set(value: &str) -> Result<()> {
    entry(ACCOUNT_TOKEN)?.set_password(value)?;
    Ok(())
}

pub fn token_remove() -> Result<()> {
    match entry(ACCOUNT_TOKEN)?.delete_credential() {
        Ok(_) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.into()),
    }
}

pub fn first_seen_get() -> Result<Option<i64>> {
    match entry(ACCOUNT_FIRST_SEEN)?.get_password() {
        Ok(s) => s.parse::<i64>()
            .map(Some)
            .map_err(|e| Error::Other(format!("first_seen parse: {e}"))),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.into()),
    }
}

pub fn first_seen_set(ms: i64) -> Result<()> {
    entry(ACCOUNT_FIRST_SEEN)?.set_password(&ms.to_string())?;
    Ok(())
}
