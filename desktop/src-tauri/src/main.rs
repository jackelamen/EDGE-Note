// EDGE Note for Mac: a thin native shell around the hosted web app.
// The window loads the live site, so web updates appear automatically.
// Native extras: a global quick-capture hotkey, a menu-bar icon, and
// hide-on-close so the hotkey keeps working.

use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::TrayIconBuilder,
    AppHandle, Manager, RunEvent, WebviewWindow, WindowEvent,
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

fn quick_capture(app: &AppHandle) {
    if let Some(window) = show_main(app) {
        let _ = window.eval(FOCUS_CAPTURE_JS);
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
        .on_window_event(|window, event| {
            // Closing the window hides it; the app keeps running for the hotkey.
            if let WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
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
