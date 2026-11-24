// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod process_control;
mod recording;
mod workspace_paths;

use recording::commands::RecorderState;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(RecorderState::new())
        .on_window_event(|_window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                let _ = commands::stop_all_services_native();
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::spawn_service,
            commands::spawn_all_services,
            commands::stop_service,
            commands::stop_all_services,
            recording::commands::recording_start,
            recording::commands::recording_pause,
            recording::commands::recording_resume,
            recording::commands::recording_stop,
            recording::commands::recording_status
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app_handle, event| {
            if let tauri::RunEvent::Exit = event {
                let _ = commands::stop_all_services_native();
            }
        });
}
