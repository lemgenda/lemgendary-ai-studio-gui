// LemGendary AI Studio - Tauri Native Commands

use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[tauri::command]
pub fn check_server_status() -> bool {
    true
}

fn find_project_dir(folder_name: &str) -> Option<PathBuf> {
    let candidates = [
        PathBuf::from("..").join(folder_name),
        PathBuf::from("../..").join(folder_name),
        PathBuf::from(folder_name),
    ];
    for candidate in &candidates {
        if candidate.is_dir() {
            return candidate.canonicalize().ok().or_else(|| Some(candidate.clone()));
        }
    }
    None
}

#[tauri::command]
pub fn spawn_service(service_id: String) -> Result<String, String> {
    let (folder, app_module, port) = match service_id.as_str() {
        "env-manager" => ("lemgendary-env-manager", "env_manager.server:app", 8000),
        "dataset-compiler" => ("lemgendary-datasets", "api.server:app", 8100),
        "training-suite" => ("lemgendary-training-suite", "training.server.app:app", 8200),
        other => return Err(format!("Unknown service '{}'", other)),
    };

    let proj_dir = find_project_dir(folder)
        .unwrap_or_else(|| PathBuf::from(format!("../{}", folder)));

    let venv_py = if cfg!(target_os = "windows") {
        let pyw = proj_dir.join(".venv/Scripts/pythonw.exe");
        if pyw.exists() {
            pyw
        } else {
            proj_dir.join(".venv/Scripts/python.exe")
        }
    } else {
        proj_dir.join(".venv/bin/python")
    };

    let py = if venv_py.exists() {
        venv_py.to_string_lossy().to_string()
    } else if cfg!(target_os = "windows") {
        "pythonw".to_string()
    } else {
        "python3".to_string()
    };

    let mut cmd = Command::new(&py);
    cmd.args(["-m", "uvicorn", app_module, "--host", "127.0.0.1", "--port", &port.to_string()]);

    if proj_dir.is_dir() {
        cmd.current_dir(&proj_dir);
    }

    // Direct binary invocation without any shell or console window
    cmd.stdin(Stdio::null());
    cmd.stdout(Stdio::null());
    cmd.stderr(Stdio::null());

    #[cfg(target_os = "windows")]
    {
        // 0x08000000 = CREATE_NO_WINDOW
        cmd.creation_flags(0x08000000);
    }

    match cmd.spawn() {
        Ok(_) => Ok(format!("Service '{}' spawned successfully", service_id)),
        Err(e) => Err(format!("Failed to spawn service '{}': {}", service_id, e)),
    }
}

#[tauri::command]
pub fn spawn_all_services() -> Result<String, String> {
    for service_id in ["env-manager", "dataset-compiler", "training-suite"] {
        spawn_service(service_id.to_string())?;
    }
    Ok("All services spawned successfully".to_string())
}

#[tauri::command]
pub fn spawn_sidecar(python_path: Option<String>) -> Result<String, String> {
    let _ = python_path;
    spawn_service("env-manager".to_string())
}
