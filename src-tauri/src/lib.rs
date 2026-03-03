mod commands;
mod parser;

use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::Emitter;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .menu(|app| {
            let app_quit_item = PredefinedMenuItem::quit(app, None)?;
            let app_menu = Submenu::with_items(app, "MineX9", true, &[&app_quit_item])?;

            let open_item = MenuItem::with_id(app, "open-file", "Open", true, Some("CmdOrCtrl+O"))?;
            let file_menu = Submenu::with_items(app, "File", true, &[&open_item])?;

            let search_item =
                MenuItem::with_id(app, "search", "Search", true, Some("CmdOrCtrl+F"))?;
            let edit_menu = Submenu::with_items(app, "Edit", true, &[&search_item])?;

            Menu::with_items(app, &[&app_menu, &file_menu, &edit_menu])
        })
        .on_menu_event(|app, event| {
            if event.id().as_ref() == "open-file" {
                let _ = app.emit("menu-open-file", ());
            } else if event.id().as_ref() == "search" {
                let _ = app.emit("menu-search", ());
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::parse::parse_x937_file,
            commands::parse::get_record_image
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
