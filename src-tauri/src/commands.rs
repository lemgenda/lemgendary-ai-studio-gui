// LemGendary AI Studio - Tauri Native Commands

use std::fs::{self, File, OpenOptions};
use std::io;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

use tauri::Manager;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

/// Folder, uvicorn app module and port of a mesh service.
struct ServiceSpec {
    folder: &'static str,
    app_module: &'static str,
    port: u16,
}

fn service_spec(service_id: &str) -> Result<ServiceSpec, String> {
    let (folder, app_module, port) = match service_id {
        "env-manager" => ("lemgendary-env-manager", "env_manager.server:app", 8000),
        "dataset-compiler" => ("lemgendary-datasets", "api.server:app", 8100),
        "training-suite" => ("lemgendary-training-suite", "training.server.app:app", 8200),
        other => return Err(format!("Unknown service '{}'", other)),
    };
    Ok(ServiceSpec { folder, app_module, port })
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

/// Open (append) `<log_dir>/<service_id>.log`, creating the folder when missing.
fn open_service_log(log_dir: &Path, service_id: &str) -> io::Result<(PathBuf, File)> {
    fs::create_dir_all(log_dir)?;
    let path = log_dir.join(format!("{}.log", service_id));
    let file = OpenOptions::new().create(true).append(true).open(&path)?;
    Ok((path, file))
}

fn python_for(proj_dir: &Path) -> String {
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

    if venv_py.exists() {
        venv_py.to_string_lossy().to_string()
    } else if cfg!(target_os = "windows") {
        "pythonw".to_string()
    } else {
        "python3".to_string()
    }
}

/// Spawn one sidecar with stdout and stderr appended to `<log_dir>/<service_id>.log`,
/// so a service that exits on startup leaves its error behind.
fn spawn_service_logged(service_id: &str, log_dir: &Path) -> Result<String, String> {
    let spec = service_spec(service_id)?;
    let proj_dir = find_project_dir(spec.folder).unwrap_or_else(|| PathBuf::from("..").join(spec.folder));

    let (log_path, log_file) = open_service_log(log_dir, service_id)
        .map_err(|e| format!("Cannot open the log file for service '{}' in {}: {}", service_id, log_dir.display(), e))?;
    let stderr_file = log_file
        .try_clone()
        .map_err(|e| format!("Cannot share the log file {} for stderr: {}", log_path.display(), e))?;

    let mut cmd = Command::new(python_for(&proj_dir));
    cmd.args(["-m", "uvicorn", spec.app_module, "--host", "127.0.0.1", "--port", &spec.port.to_string()]);

    if proj_dir.is_dir() {
        cmd.current_dir(&proj_dir);
    }

    // Direct binary invocation without any shell or console window
    cmd.stdin(Stdio::null());
    cmd.stdout(Stdio::from(log_file));
    cmd.stderr(Stdio::from(stderr_file));

    #[cfg(target_os = "windows")]
    {
        // 0x08000000 = CREATE_NO_WINDOW
        cmd.creation_flags(0x08000000);
    }

    cmd.spawn()
        .map(|child| {
            format!(
                "Service '{}' spawned (pid {}); output is logged to {}",
                service_id,
                child.id(),
                log_path.display()
            )
        })
        .map_err(|e| format!("Failed to spawn service '{}': {}", service_id, e))
}

fn service_log_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_log_dir()
        .map_err(|e| format!("Cannot resolve the app log folder: {}", e))
}

#[tauri::command]
pub fn spawn_service(app: tauri::AppHandle, service_id: String) -> Result<String, String> {
    spawn_service_logged(&service_id, &service_log_dir(&app)?)
}

#[tauri::command]
pub fn spawn_all_services(app: tauri::AppHandle) -> Result<String, String> {
    let log_dir = service_log_dir(&app)?;
    let mut messages = Vec::new();
    for service_id in ["env-manager", "dataset-compiler", "training-suite"] {
        messages.push(spawn_service_logged(service_id, &log_dir)?);
    }
    Ok(messages.join("\n"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    fn temp_log_dir(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!("lemgendary-gui-test-{}-{}", name, std::process::id()))
    }

    #[test]
    fn service_spec_knows_the_three_services() {
        assert_eq!(service_spec("env-manager").map(|s| s.port), Ok(8000));
        assert_eq!(service_spec("dataset-compiler").map(|s| s.port), Ok(8100));
        assert_eq!(service_spec("training-suite").map(|s| s.port), Ok(8200));
    }

    #[test]
    fn unknown_service_is_an_error() {
        assert_eq!(service_spec("nope").err(), Some("Unknown service 'nope'".to_string()));
        let dir = temp_log_dir("unknown");
        assert!(spawn_service_logged("nope", &dir).is_err());
    }

    #[test]
    fn service_log_is_created_and_appended() -> io::Result<()> {
        let dir = temp_log_dir("append");
        let (path, mut first) = open_service_log(&dir, "env-manager")?;
        writeln!(first, "one")?;
        let (_, mut second) = open_service_log(&dir, "env-manager")?;
        writeln!(second, "two")?;
        assert_eq!(path, dir.join("env-manager.log"));
        assert_eq!(fs::read_to_string(&path)?, "one\ntwo\n");
        fs::remove_dir_all(&dir)?;
        Ok(())
    }
}
