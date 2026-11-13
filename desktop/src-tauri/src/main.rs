// EDGE Note for Mac: a thin native shell around the hosted web app.
// The window loads the live site, so web updates appear automatically.
// Native extras: a global quick-capture hotkey that opens a small floating
// capture bubble (the site's /capture.html) instead of the whole app, a
// menu-bar icon, and hide-on-close so the hotkey keeps working.

use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::TrayIconBuilder,
    AppHandle, Manager, RunEvent, WebviewUrl, WebviewWindow, WebviewWindowBuilder, WindowEvent,
};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

// Runs inside the web app: go to Today (if not there) and focus the capture box.
const FOCUS_CAPTURE_JS: &str = r#"
(function () {
  function focusCapture() {
    var input = document.querySelector('[data-today-capture-input]');
    if (input) { input.focus(); input.select(); return true; }
    return false;
  }
  var home = document.querySelector('[data-home-view]');
  var homeLink = document.querySelector('.sidebar [data-view-filter="home"]');
  if (home && home.hidden && homeLink) {
    homeLink.click();
    setTimeout(focusCapture, 250);
  } else if (!focusCapture()) {
    setTimeout(focusCapture, 400);
  }
})();
"#;

fn show_main(app: &AppHandle) -> Option<WebviewWindow> {
    let window = app.get_webview_window("main")?;
    let _ = window.show();
    let _ = window.unminimize();
    let _ = window.set_focus();
    Some(window)
}

const SITE: &str = "https://lightpink-pheasant-889269.hostingersite.com";

// The bubble is the site's capture page in a small frameless, floating window.
// It talks to the same session as the main window (they share cookies), so it
// needs no sign-in of its own. The page asks the shell to hide it, or to open
// the main window, by navigating to /__capture/done or /__capture/open; those
// navigations are caught here and never load.
fn build_capture_window(app: &AppHandle) -> tauri::Result<WebviewWindow> {
    let handle = app.clone();
    let url = format!("{SITE}/capture.html?bubble=1").parse().expect("valid capture url");
    WebviewWindowBuilder::new(app, "capture", WebviewUrl::External(url))
        .title("Quick capture")
        .inner_size(660.0, 160.0)
        .resizable(false)
        .decorations(false)
        .transparent(true)
        .shadow(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .visible(false)
        .center()
        .on_navigation(move |target| {
            let path = target.path();
            if !path.starts_with("/__capture/") {
                return true;
            }
            if let Some(bubble) = handle.get_webview_window("capture") {
                let _ = bubble.hide();
            }
            if path == "/__capture/open" {
                show_main(&handle);
            }
            false
        })
        .build()
}

fn quick_capture(app: &AppHandle) {
    let bubble = app
        .get_webview_window("capture")
        .or_else(|| build_capture_window(app).ok());
    match bubble {
        Some(window) => {
            let _ = window.center();
            let _ = window.show();
            let _ = window.set_focus();
            let _ = window.eval("window.__edgeCaptureReady && window.__edgeCaptureReady();");
        }
        // If the bubble cannot be built, fall back to the main window's capture box.
        None => {
            if let Some(window) = show_main(app) {
                let _ = window.eval(FOCUS_CAPTURE_JS);
            }
        }
    }
}

fn main() {
    // Option + Shift + N, from anywhere on the Mac.
    let capture_shortcut = Shortcut::new(Some(Modifiers::ALT | Modifiers::SHIFT), Code::KeyN);
    let handler_shortcut = capture_shortcut.clone();

    tauri::Builder::default()
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(move |app, shortcut, event| {
                    if shortcut == &handler_shortcut && event.state() == ShortcutState::Pressed {
                        quick_capture(app);
                    }
                })
                .build(),
        )
        .setup(move |app| {
            // If another app already owns the shortcut, keep running without it.
            if let Err(error) = app.global_shortcut().register(capture_shortcut) {
                eprintln!("Quick capture shortcut unavailable: {error}");
            }

            // Build the bubble now (hidden) so the first hotkey press is instant.
            if let Err(error) = build_capture_window(app.handle()) {
                eprintln!("Capture bubble unavailable: {error}");
            }

            let capture_item = MenuItem::with_id(app, "capture", "Quick capture (⌥⇧N)", true, None::<&str>)?;
            let show_item = MenuItem::with_id(app, "show", "Open EDGE Note", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit EDGE Note", true, None::<&str>)?;
            let separator = PredefinedMenuItem::separator(app)?;
            let menu = Menu::with_items(app, &[&capture_item, &show_item, &separator, &quit_item])?;

            let mut tray = TrayIconBuilder::with_id("edge-note-tray")
                .tooltip("EDGE Note")
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "capture" => quick_capture(app),
                    "show" => {
                        show_main(app);
                    }
                    "quit" => app.exit(0),
                    _ => {}
                });
            // Monochrome template icon: macOS tints it black or white to match
            // the menu bar, like its own icons.
            let tray_icon = tauri::image::Image::from_bytes(include_bytes!("../icons/tray-template@2x.png"))?;
            tray = tray.icon(tray_icon).icon_as_template(true);
            tray.build(app)?;
            Ok(())
        })
        .on_window_event(|window, event| match event {
            // Closing the window hides it; the app keeps running for the hotkey.
            WindowEvent::CloseRequested { api, .. } => {
                if window.label() == "main" || window.label() == "capture" {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
            // Clicking away from the capture bubble dismisses it.
            WindowEvent::Focused(false) if window.label() == "capture" => {
                let _ = window.hide();
            }
            _ => {}
        })
        .build(tauri::generate_context!())
        .expect("error while starting EDGE Note")
        .run(|app, event| {
            // Clicking the Dock icon brings the hidden window back.
            if let RunEvent::Reopen { .. } = event {
                show_main(app);
            }
        });
}
