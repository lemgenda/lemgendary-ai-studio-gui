// LemGendary AI Studio - locate sibling workspace projects on disk.
//
// The GUI lives next to the other LemGendary projects. When it is started
// from its own folder (`npm run tauri dev`) the working directory finds them;
// an installed or double-clicked build may start anywhere, so the folders
// around the executable are searched too.

use std::path::{Path, PathBuf};

/// Places where `folder_name` may live, in search order: relative to the
/// working directory (`..`, `../..`, `.`), then every folder that contains the
/// executable, from the nearest upwards.
fn project_dir_candidates(folder_name: &str, cwd: Option<&Path>, exe: Option<&Path>) -> Vec<PathBuf> {
    let mut candidates = Vec::new();
    if let Some(cwd) = cwd {
        for base in [cwd.join(".."), cwd.join("../.."), cwd.to_path_buf()] {
            candidates.push(base.join(folder_name));
        }
    }
    if let Some(exe) = exe {
        for dir in exe.ancestors().skip(1) {
            candidates.push(dir.join(folder_name));
        }
    }
    candidates
}

/// First existing candidate folder, canonicalised when possible.
fn find_project_dir_from(folder_name: &str, cwd: Option<&Path>, exe: Option<&Path>) -> Option<PathBuf> {
    project_dir_candidates(folder_name, cwd, exe)
        .into_iter()
        .find(|candidate| candidate.is_dir())
        .map(|found| found.canonicalize().unwrap_or(found))
}

/// Folder of the workspace project `folder_name`, searched from the working
/// directory and from the executable's location.
pub fn find_project_dir(folder_name: &str) -> Option<PathBuf> {
    let cwd = std::env::current_dir().ok();
    let exe = std::env::current_exe().ok();
    find_project_dir_from(folder_name, cwd.as_deref(), exe.as_deref())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::io;

    fn temp_workspace(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!("lemgendary-gui-ws-{}-{}", name, std::process::id()))
    }

    #[test]
    fn candidates_cover_cwd_then_executable_ancestors() {
        let cwd = Path::new("ws").join("gui");
        let exe = Path::new("ws").join("gui").join("target").join("app");
        let found = project_dir_candidates("proj", Some(&cwd), Some(&exe));
        assert_eq!(found[0], cwd.join("..").join("proj"));
        assert_eq!(found[2], cwd.join("proj"));
        assert_eq!(found[3], Path::new("ws").join("gui").join("target").join("proj"));
        assert!(found.contains(&Path::new("ws").join("proj")));
    }

    #[test]
    fn project_is_found_from_the_executable_when_cwd_is_elsewhere() -> io::Result<()> {
        let root = temp_workspace("exe");
        let project = root.join("lemgendary-datasets");
        let exe_dir = root.join("lemgendary-ai-studio-gui").join("src-tauri").join("target").join("debug");
        let elsewhere = root.join("unrelated").join("deep").join("cwd");
        fs::create_dir_all(&project)?;
        fs::create_dir_all(&exe_dir)?;
        fs::create_dir_all(&elsewhere)?;

        let exe = exe_dir.join("app.exe");
        let found = find_project_dir_from("lemgendary-datasets", Some(&elsewhere), Some(&exe));
        assert_eq!(found, Some(project.canonicalize()?));
        assert_eq!(find_project_dir_from("lemgendary-missing", Some(&elsewhere), Some(&exe)), None);

        fs::remove_dir_all(&root)?;
        Ok(())
    }
}
