// macOS-only keychain backend. We bypass the `keyring` crate here because it
// stores items in the legacy file-based Login keychain, which doesn't honour
// `kSecAttrAccessGroup`. Two apps reading each other's item then trigger the
// "enter your Keychain password" dialog on every launch.
//
// Using the DataProtectionKeychain + a fixed access group is what lets apps
// from the same Apple Team share the item silently. Apps must:
//   1. Be signed with Team ID VFYA7T675R, and
//   2. Declare `<key>keychain-access-groups</key>` containing
//      `VFYA7T675R.cafe.getapps.shared` in their entitlements (hardcoded,
//      not `$(AppIdentifierPrefix)…`, so it matches `ACCESS_GROUP` below).

use core_foundation::data::CFData;
use security_framework::base::Error as SfError;
use security_framework::item::{
    update_item, ItemAddOptions, ItemAddValue, ItemClass, ItemSearchOptions,
    ItemUpdateOptions, ItemUpdateValue, Limit, Location, SearchResult,
};
use security_framework_sys::base::{errSecDuplicateItem, errSecItemNotFound};

use crate::error::{Error, Result};

const SERVICE: &str = "cafe.getapps.device";
const ACCOUNT_TOKEN: &str = "device_token";
const ACCOUNT_FIRST_SEEN: &str = "first_seen_at_ms";
const ACCOUNT_WHOAMI_CACHE: &str = "whoami_cache";
const ACCESS_GROUP: &str = "VFYA7T675R.cafe.getapps.shared";

fn map_err(e: SfError) -> Error {
    Error::Other(format!("keychain ({}): {}", e.code(), e))
}

fn build_search(account: &str) -> ItemSearchOptions {
    let mut s = ItemSearchOptions::new();
    s.class(ItemClass::generic_password())
        .ignore_legacy_keychains()
        .service(SERVICE)
        .account(account)
        .access_group(ACCESS_GROUP);
    s
}

fn account_get(account: &str) -> Result<Option<String>> {
    let mut search = build_search(account);
    search.load_data(true).limit(Limit::Max(1));
    match search.search() {
        Ok(results) => {
            for r in results {
                if let SearchResult::Data(bytes) = r {
                    return String::from_utf8(bytes)
                        .map(Some)
                        .map_err(|e| Error::Other(format!("keychain utf8: {e}")));
                }
            }
            Ok(None)
        }
        Err(e) if e.code() == errSecItemNotFound => Ok(None),
        Err(e) => Err(map_err(e)),
    }
}

fn account_set(account: &str, value: &str) -> Result<()> {
    let mut add = ItemAddOptions::new(ItemAddValue::Data {
        class: ItemClass::generic_password(),
        data: CFData::from_buffer(value.as_bytes()),
    });
    add.set_service(SERVICE)
        .set_account_name(account)
        .set_access_group(ACCESS_GROUP)
        .set_location(Location::DataProtectionKeychain);

    match add.add() {
        Ok(()) => Ok(()),
        Err(e) if e.code() == errSecDuplicateItem => {
            // Same service+account+access_group already present - update its data.
            let mut update = ItemUpdateOptions::new();
            update.set_value(ItemUpdateValue::Data(CFData::from_buffer(value.as_bytes())));
            update_item(&build_search(account), &update).map_err(map_err)
        }
        Err(e) => Err(map_err(e)),
    }
}

fn account_remove(account: &str) -> Result<()> {
    match build_search(account).delete() {
        Ok(()) => Ok(()),
        Err(e) if e.code() == errSecItemNotFound => Ok(()),
        Err(e) => Err(map_err(e)),
    }
}

pub fn token_get() -> Result<Option<String>> {
    account_get(ACCOUNT_TOKEN)
}

pub fn token_set(value: &str) -> Result<()> {
    account_set(ACCOUNT_TOKEN, value)
}

pub fn token_remove() -> Result<()> {
    account_remove(ACCOUNT_TOKEN)
}

pub fn first_seen_get() -> Result<Option<i64>> {
    match account_get(ACCOUNT_FIRST_SEEN)? {
        Some(s) => s
            .parse::<i64>()
            .map(Some)
            .map_err(|e| Error::Other(format!("first_seen parse: {e}"))),
        None => Ok(None),
    }
}

pub fn first_seen_set(ms: i64) -> Result<()> {
    account_set(ACCOUNT_FIRST_SEEN, &ms.to_string())
}

pub fn whoami_cache_get() -> Result<Option<String>> {
    account_get(ACCOUNT_WHOAMI_CACHE)
}

pub fn whoami_cache_set(value: &str) -> Result<()> {
    account_set(ACCOUNT_WHOAMI_CACHE, value)
}

pub fn whoami_cache_remove() -> Result<()> {
    account_remove(ACCOUNT_WHOAMI_CACHE)
}
