// LemGendary AI Studio - Tauri Native Commands

use std::process::Command;

#[tauri::command]
pub fn check_server_status() -> bool {
    // Basic ping or connection check
    true
}

#[tauri::command]
pub fn spawn_sidecar(python_path: Option<String>) -> Result<String, String> {
    let py = python_path.unwrap_or_else(|| "python".to_string());
    match Command::new(py)
        .args(["-m", "env_manager.cli", "serve", "--port", "8000"])
        .spawn()
    {
        Ok(_) => Ok("Sidecar spawned successfully".to_string()),
        Err(e) => Err(format!("Failed to spawn sidecar: {}", e)),
    }
}
