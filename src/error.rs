use serde::{Serialize, Serializer};

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("network error: {0}")]
    Http(#[from] reqwest::Error),
    #[error("server returned HTTP {status}: {body}")]
    BadStatus { status: u16, body: String },
    #[cfg(not(target_os = "macos"))]
    #[error("keyring error: {0}")]
    Keyring(#[from] keyring::Error),
    #[error("machine-id error: {0}")]
    MachineId(String),
    #[error("invalid response: {0}")]
    InvalidResponse(String),
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("{0}")]
    Other(String),
}

// Tauri sends results to JS as JSON; serialize the error as a plain string so
// the JS side can `catch (e) { e.message }` without juggling enum tags.
impl Serialize for Error {
    fn serialize<S: Serializer>(&self, s: S) -> std::result::Result<S::Ok, S::Error> {
        s.serialize_str(&self.to_string())
    }
}

pub type Result<T> = std::result::Result<T, Error>;
