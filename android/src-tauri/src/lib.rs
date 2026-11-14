// EDGE Note for Android: a native shell around the hosted web app.
// The webview loads the live site, so web updates appear automatically.
// Native extras (home-screen widget) live in the generated Android project.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while starting EDGE Note");
}
