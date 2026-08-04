mod http;

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use http::HttpState;
use serde_json::Value;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{Manager, State, WebviewUrl, WebviewWindowBuilder};

struct AppState {
    http: Arc<HttpState>,
    always_on_top: AtomicBool,
}

#[tauri::command]
async fn login(
    state: State<'_, AppState>,
    base_url: String,
    password: String,
) -> Result<Value, String> {
    http::login(&state.http, &base_url, &password).await
}

#[tauri::command]
async fn logout(state: State<'_, AppState>) -> Result<(), String> {
    http::logout(&state.http).await
}

#[tauri::command]
async fn api_get(state: State<'_, AppState>, path: String) -> Result<Value, String> {
    http::api_get(&state.http, &path).await
}

#[tauri::command]
fn set_base_url(state: State<'_, AppState>, base_url: String) {
    state.http.set_base(&base_url);
}

#[tauri::command]
fn set_always_on_top(
    state: State<'_, AppState>,
    window: tauri::WebviewWindow,
    value: bool,
) -> Result<(), String> {
    window.set_always_on_top(value).map_err(|e| e.to_string())?;
    state.always_on_top.store(value, Ordering::Relaxed);
    Ok(())
}

/// Open the 9Router dashboard in a separate webview window so the user can
/// complete provider OAuth flows (Claude/Codex, Gemini, Cursor, Kiro, ...).
#[tauri::command]
fn open_oauth_window(app: tauri::AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    let base = state.http.base();
    let dash = format!("{base}/dashboard");
    let url = url::Url::parse(&dash).map_err(|e| e.to_string())?;

    if let Some(win) = app.get_webview_window("oauth") {
        let _ = win.set_focus();
        return Ok(());
    }
    WebviewWindowBuilder::new(&app, "oauth", WebviewUrl::External(url))
        .title("Conectar contas — 9Router")
        .inner_size(980.0, 720.0)
        .build()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .manage(AppState {
            http: HttpState::new(),
            always_on_top: AtomicBool::new(true),
        })
        .setup(|app| {
            let show = MenuItem::with_id(app, "show", "Mostrar/Ocultar", true, None::<&str>)?;
            let top = MenuItem::with_id(app, "top", "Fixar no topo", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Sair", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &top, &quit])?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(true)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(w) = app.get_webview_window("widget") {
                            if w.is_visible().unwrap_or(false) {
                                let _ = w.hide();
                            } else {
                                let _ = w.show();
                                let _ = w.set_focus();
                            }
                        }
                    }
                    "top" => {
                        let st = app.state::<AppState>();
                        let next = !st.always_on_top.load(Ordering::Relaxed);
                        if let Some(w) = app.get_webview_window("widget") {
                            let _ = w.set_always_on_top(next);
                        }
                        st.always_on_top.store(next, Ordering::Relaxed);
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .build(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            login,
            logout,
            api_get,
            set_base_url,
            set_always_on_top,
            open_oauth_window
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
