// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod recording;

use recording::commands::RecorderState;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(RecorderState::new())
        .invoke_handler(tauri::generate_handler![
            commands::spawn_service,
            commands::spawn_all_services,
            recording::commands::recording_start,
            recording::commands::recording_pause,
            recording::commands::recording_resume,
            recording::commands::recording_stop,
            recording::commands::recording_status
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
