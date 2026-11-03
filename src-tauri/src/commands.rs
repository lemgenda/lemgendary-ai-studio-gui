// LemGendary AI Studio - Tauri Native Commands

use std::fs::{self, File, OpenOptions};
use std::io;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::OnceLock;

use serde::Deserialize;

use tauri::Manager;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

/// Ecosystem SSOT snapshot, synced from the Environment Manager by
/// `scripts/sync-ecosystem.mjs` and embedded at compile time.
const ECOSYSTEM_JSON: &str = include_str!("../../src/generated/ecosystem.json");

#[derive(Debug, Deserialize)]
struct EcosystemIdentity {
    bind_host: String,
}

#[derive(Debug, Deserialize)]
struct EcosystemService {
    id: String,
    project: String,
    port: u16,
    app_import: String,
}

/// The subset of `ecosystem.json` the native side needs (unknown keys are ignored).
#[derive(Debug, Deserialize)]
struct Ecosystem {
    identity: EcosystemIdentity,
    services: Vec<EcosystemService>,
}

fn parse_ecosystem(json: &str) -> Result<Ecosystem, String> {
    serde_json::from_str(json)
        .map_err(|e| format!("Embedded src/generated/ecosystem.json is invalid: {}", e))
}

fn ecosystem() -> Result<&'static Ecosystem, String> {
    static ECOSYSTEM: OnceLock<Result<Ecosystem, String>> = OnceLock::new();
    ECOSYSTEM
        .get_or_init(|| parse_ecosystem(ECOSYSTEM_JSON))
        .as_ref()
        .map_err(Clone::clone)
}

/// Folder, uvicorn app module, bind host and port of a mesh service.
struct ServiceSpec {
    folder: &'static str,
    app_module: &'static str,
    host: &'static str,
    port: u16,
}

fn service_spec(service_id: &str) -> Result<ServiceSpec, String> {
    let eco = ecosystem()?;
    let service = eco
        .services
        .iter()
        .find(|s| s.id == service_id)
        .ok_or_else(|| format!("Unknown service '{}'", service_id))?;
    Ok(ServiceSpec {
        folder: &service.project,
        app_module: &service.app_import,
        host: &eco.identity.bind_host,
        port: service.port,
    })
}

/// Every service id in the ecosystem file, in file order (Environment Manager first).
fn service_ids() -> Result<Vec<&'static str>, String> {
    Ok(ecosystem()?.services.iter().map(|s| s.id.as_str()).collect())
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
    cmd.args(["-m", "uvicorn", spec.app_module, "--host", spec.host, "--port", &spec.port.to_string()]);

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
    for service_id in service_ids()? {
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
    fn service_spec_knows_the_three_services() -> Result<(), String> {
        let mut ports = Vec::new();
        for id in ["env-manager", "dataset-compiler", "training-suite"] {
            let port = service_spec(id)?.port;
            assert_ne!(port, 0, "{} has no port", id);
            assert!(!ports.contains(&port), "{} reuses port {}", id, port);
            ports.push(port);
        }
        Ok(())
    }

    #[test]
    fn embedded_ecosystem_matches_the_snapshot_shape() -> Result<(), String> {
        let eco = parse_ecosystem(ECOSYSTEM_JSON)?;
        assert_eq!(eco.identity.bind_host, "127.0.0.1");
        assert_eq!(service_ids()?, vec!["env-manager", "dataset-compiler", "training-suite"]);
        for service in &eco.services {
            let spec = service_spec(&service.id)?;
            assert_eq!(spec.port, service.port);
            assert_eq!(spec.folder, service.project);
            assert_eq!(spec.app_module, service.app_import);
        }
        Ok(())
    }

    #[test]
    fn invalid_ecosystem_json_is_a_descriptive_error() {
        let err = parse_ecosystem("{}").err().unwrap_or_default();
        assert!(err.starts_with("Embedded src/generated/ecosystem.json is invalid"), "{}", err);
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
