use std::sync::Arc;
use std::sync::Mutex;

use reqwest::Client;
use serde_json::Value;

/// Shared HTTP client with a persistent cookie jar (holds 9Router auth_token JWT).
pub struct HttpState {
    pub client: Client,
    pub base_url: Mutex<String>,
}

impl HttpState {
    pub fn new() -> Arc<Self> {
        let client = Client::builder()
            .cookie_store(true)
            .gzip(true)
            .build()
            .expect("failed to build reqwest client");
        Arc::new(Self {
            client,
            base_url: Mutex::new(String::from("https://maxrouter-prod.up.railway.app")),
        })
    }

    pub fn base(&self) -> String {
        self.base_url.lock().unwrap().clone()
    }

    pub fn set_base(&self, url: &str) {
        let mut cleaned = url.trim().trim_end_matches('/').to_string();
        // The widget calls dashboard routes (/api/*), not the LLM API (/v1).
        // Strip a trailing /v1 so pasting the OpenAI-compatible endpoint still works.
        if cleaned.ends_with("/v1") {
            cleaned.truncate(cleaned.len() - 3);
            cleaned = cleaned.trim_end_matches('/').to_string();
        }
        *self.base_url.lock().unwrap() = cleaned;
    }
}

fn join(base: &str, path: &str) -> String {
    if path.starts_with("http://") || path.starts_with("https://") {
        return path.to_string();
    }
    let p = if path.starts_with('/') { path.to_string() } else { format!("/{path}") };
    format!("{base}{p}")
}

/// POST /api/auth/login with the given password. Cookie is stored in the jar on success.
pub async fn login(state: &HttpState, base_url: &str, password: &str) -> Result<Value, String> {
    state.set_base(base_url);
    let url = join(&state.base(), "/api/auth/login");
    let resp = state
        .client
        .post(&url)
        .json(&serde_json::json!({ "password": password }))
        .send()
        .await
        .map_err(|e| format!("request failed: {e}"))?;

    let status = resp.status();
    let body: Value = resp.json().await.unwrap_or(Value::Null);
    if status.is_success() {
        Ok(body)
    } else {
        let msg = body
            .get("error")
            .and_then(|v| v.as_str())
            .unwrap_or("login failed")
            .to_string();
        Err(format!("{} ({})", msg, status.as_u16()))
    }
}

pub async fn logout(state: &HttpState) -> Result<(), String> {
    let url = join(&state.base(), "/api/auth/logout");
    let _ = state.client.post(&url).send().await;
    Ok(())
}

/// Generic authenticated GET proxy. Returns parsed JSON (cookie sent automatically).
pub async fn api_get(state: &HttpState, path: &str) -> Result<Value, String> {
    let url = join(&state.base(), path);
    let resp = state
        .client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("request failed: {e}"))?;

    let status = resp.status();
    let text = resp.text().await.map_err(|e| format!("read failed: {e}"))?;
    if !status.is_success() {
        return Err(format!("HTTP {}: {}", status.as_u16(), text));
    }
    serde_json::from_str(&text).map_err(|e| format!("bad json: {e}"))
}
