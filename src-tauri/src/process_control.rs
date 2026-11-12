// LemGendary AI Studio - find and stop the process listening on a TCP port.
//
// Windows: `netstat -ano` to find listeners, `taskkill /T /F` to stop them.
// POSIX: `lsof` (or `ss` on Linux when lsof is not installed) to find
// listeners, then SIGTERM with a grace period before SIGKILL, so sidecars can
// flush logs and release their PID files.

use std::process::{Command, Stdio};
#[cfg(any(not(target_os = "windows"), test))]
use std::time::Duration;

#[cfg(not(target_os = "windows"))]
use std::io;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

/// Run a helper program and return its stdout, or a descriptive error when it
/// cannot start or exits unsuccessfully.
fn run_checked(cmd: &mut Command, what: &str) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        // 0x08000000 = CREATE_NO_WINDOW
        cmd.creation_flags(0x08000000);
    }
    let out = cmd
        .stdin(Stdio::null())
        .output()
        .map_err(|e| format!("Cannot run {}: {}", what, e))?;
    if out.status.success() {
        Ok(String::from_utf8_lossy(&out.stdout).into_owned())
    } else {
        Err(format!(
            "{} failed ({}): {}",
            what,
            out.status,
            String::from_utf8_lossy(&out.stderr).trim()
        ))
    }
}

fn push_unique(pids: &mut Vec<u32>, pid: u32) {
    if pid != 0 && !pids.contains(&pid) {
        pids.push(pid);
    }
}

/// Owning PIDs of loopback TCP sockets on `port` parsed from `netstat -ano`
/// output. Matches listeners (`LISTENING` or a `:0` / `*:*` foreign address)
/// and server-side established sockets whose local address ends with `:port`.
#[cfg(any(target_os = "windows", test))]
fn parse_netstat_listeners(output: &str, port: u16) -> Vec<u32> {
    let local_suffix = format!(":{}", port);
    let mut pids = Vec::new();
    for line in output.lines() {
        let fields: Vec<&str> = line.split_whitespace().collect();
        if fields.len() != 5 || !fields[0].eq_ignore_ascii_case("TCP") {
            continue;
        }
        if !fields[1].ends_with(&local_suffix) {
            continue;
        }
        let is_listener = fields[2].ends_with(":0")
            || fields[2] == "*:*"
            || fields[3].eq_ignore_ascii_case("LISTENING");
        let pid = fields[4].parse::<u32>().unwrap_or(0);
        // Windows loopback sockets may hand the listener PID to established
        // server sockets on the local port, so those count too.
        if is_listener || !fields[2].ends_with(&local_suffix) {
            push_unique(&mut pids, pid);
        }
    }
    pids
}

/// Process ids printed one per line by `lsof -t`.
#[cfg(any(not(target_os = "windows"), test))]
fn parse_lsof_pids(output: &str) -> Vec<u32> {
    let mut pids = Vec::new();
    for pid in output.lines().filter_map(|l| l.trim().parse::<u32>().ok()) {
        push_unique(&mut pids, pid);
    }
    pids
}

/// PIDs of sockets listening on `port` in `ss -tlpnH` output, e.g.
/// `LISTEN 0 2048 127.0.0.1:8000 0.0.0.0:* users:(("python",pid=1234,fd=3))`.
#[cfg(any(target_os = "linux", test))]
fn parse_ss_pids(output: &str, port: u16) -> Vec<u32> {
    let local_suffix = format!(":{}", port);
    let mut pids = Vec::new();
    for line in output.lines() {
        let fields: Vec<&str> = line.split_whitespace().collect();
        if fields.len() < 6 || !fields[3].ends_with(&local_suffix) {
            continue;
        }
        let process = fields[5..].join(" ");
        for chunk in process.split("pid=").skip(1) {
            let digits: String = chunk.chars().take_while(char::is_ascii_digit).collect();
            push_unique(&mut pids, digits.parse::<u32>().unwrap_or(0));
        }
    }
    pids
}

#[cfg(target_os = "windows")]
pub fn listening_pids(port: u16) -> Result<Vec<u32>, String> {
    let out = run_checked(
        Command::new("netstat").args(["-ano", "-p", "TCP"]),
        "netstat",
    )?;
    Ok(parse_netstat_listeners(&out, port))
}

#[cfg(not(target_os = "windows"))]
pub fn listening_pids(port: u16) -> Result<Vec<u32>, String> {
    let out = match Command::new("lsof")
        .args(["-t", &format!("-iTCP:{}", port), "-sTCP:LISTEN"])
        .stdin(Stdio::null())
        .output()
    {
        Ok(out) => out,
        Err(e) if e.kind() == io::ErrorKind::NotFound => return listening_pids_without_lsof(port),
        Err(e) => return Err(format!("Cannot run lsof: {}", e)),
    };
    let stderr = String::from_utf8_lossy(&out.stderr);
    // lsof exits 1 with no output when nothing listens on the port.
    if !out.status.success() && !stderr.trim().is_empty() {
        return Err(format!("lsof failed ({}): {}", out.status, stderr.trim()));
    }
    Ok(parse_lsof_pids(&String::from_utf8_lossy(&out.stdout)))
}

/// Linux without lsof: read the listening sockets from `ss`.
#[cfg(target_os = "linux")]
fn listening_pids_without_lsof(port: u16) -> Result<Vec<u32>, String> {
    let out = run_checked(Command::new("ss").arg("-tlpnH"), "ss (lsof is not installed)")?;
    Ok(parse_ss_pids(&out, port))
}

#[cfg(all(not(target_os = "windows"), not(target_os = "linux")))]
fn listening_pids_without_lsof(port: u16) -> Result<Vec<u32>, String> {
    Err(format!(
        "Cannot find the process on port {}: lsof is not installed.",
        port
    ))
}

#[cfg(target_os = "windows")]
pub fn stop_pid(pid: u32) -> Result<(), String> {
    let pid = pid.to_string();
    run_checked(
        Command::new("taskkill").args(["/PID", &pid, "/T", "/F"]),
        "taskkill",
    )
    .map(|_| ())
}

/// How long a POSIX process gets to exit after SIGTERM before SIGKILL.
#[cfg(any(not(target_os = "windows"), test))]
const TERM_GRACE: Duration = Duration::from_secs(3);
/// How often the process is checked during the grace period.
#[cfg(any(not(target_os = "windows"), test))]
const TERM_POLL: Duration = Duration::from_millis(100);

/// The signal operations the graceful stop needs, so it can be tested without real processes.
#[cfg(any(not(target_os = "windows"), test))]
trait SignalOps {
    fn send(&mut self, pid: u32, signal: &str) -> Result<(), String>;
    fn is_alive(&mut self, pid: u32) -> bool;
    fn pause(&mut self, duration: Duration);
}

/// SIGTERM, wait up to `grace` for the process to exit, then SIGKILL.
#[cfg(any(not(target_os = "windows"), test))]
fn terminate_gracefully(ops: &mut impl SignalOps, pid: u32, grace: Duration, poll: Duration) -> Result<(), String> {
    ops.send(pid, "TERM")?;
    let mut waited = Duration::ZERO;
    while waited < grace {
        if !ops.is_alive(pid) {
            return Ok(());
        }
        ops.pause(poll);
        waited += poll;
    }
    if !ops.is_alive(pid) {
        return Ok(());
    }
    match ops.send(pid, "KILL") {
        // It exited between the last check and SIGKILL.
        Err(_) if !ops.is_alive(pid) => Ok(()),
        result => result,
    }
}

/// Signals sent with the system `kill` utility.
#[cfg(not(target_os = "windows"))]
struct KillCommand;

#[cfg(not(target_os = "windows"))]
impl SignalOps for KillCommand {
    fn send(&mut self, pid: u32, signal: &str) -> Result<(), String> {
        run_checked(
            Command::new("kill").args([format!("-{}", signal), pid.to_string()]),
            "kill",
        )
        .map(|_| ())
    }

    fn is_alive(&mut self, pid: u32) -> bool {
        Command::new("kill")
            .args(["-0", &pid.to_string()])
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .map(|status| status.success())
            .unwrap_or(false)
    }

    fn pause(&mut self, duration: Duration) {
        std::thread::sleep(duration);
    }
}

#[cfg(not(target_os = "windows"))]
pub fn stop_pid(pid: u32) -> Result<(), String> {
    terminate_gracefully(&mut KillCommand, pid, TERM_GRACE, TERM_POLL)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn netstat_listeners_are_found_by_port() {
        let out = "Active Connections

  Proto  Local Address          Foreign Address        State           PID
  TCP    127.0.0.1:8000         0.0.0.0:0              LISTENING       4242
  TCP    [::]:8000              [::]:0                 LISTENING       4242
  TCP    127.0.0.1:8000         127.0.0.1:8001         ESTABLISHED     4242
  TCP    127.0.0.1:8001         127.0.0.1:8000         ESTABLISHED     777
  TCP    127.0.0.1:18000        0.0.0.0:0              LISTENING       999
";
        assert_eq!(parse_netstat_listeners(out, 8000), vec![4242]);
        assert!(parse_netstat_listeners(out, 8100).is_empty());
    }

    #[test]
    fn lsof_pids_are_parsed_and_deduplicated() {
        assert_eq!(parse_lsof_pids("123\n456\n123\n\n"), vec![123, 456]);
        assert!(parse_lsof_pids("").is_empty());
    }

    #[test]
    fn ss_pids_are_parsed_by_port() {
        let out = "LISTEN 0 2048 127.0.0.1:8000 0.0.0.0:* users:((\"python\",pid=1234,fd=3),(\"python\",pid=1240,fd=3))
LISTEN 0 2048 127.0.0.1:18000 0.0.0.0:* users:((\"python\",pid=999,fd=3))
LISTEN 0 4096 [::1]:8000 [::]:* users:((\"python\",pid=1234,fd=4))
LISTEN 0 128 0.0.0.0:22 0.0.0.0:*
";
        assert_eq!(parse_ss_pids(out, 8000), vec![1234, 1240]);
        assert!(parse_ss_pids(out, 22).is_empty());
        assert!(parse_ss_pids(out, 8200).is_empty());
    }

    /// Fake process: exits after `exits_after` liveness checks, or ignores SIGTERM when `None`.
    struct FakeProcess {
        exits_after: Option<u32>,
        checks: u32,
        killed: bool,
        sent: Vec<String>,
        paused: Duration,
    }

    impl FakeProcess {
        fn new(exits_after: Option<u32>) -> Self {
            FakeProcess { exits_after, checks: 0, killed: false, sent: Vec::new(), paused: Duration::ZERO }
        }
    }

    impl SignalOps for FakeProcess {
        fn send(&mut self, _pid: u32, signal: &str) -> Result<(), String> {
            self.sent.push(signal.to_string());
            if signal == "KILL" {
                self.killed = true;
            }
            Ok(())
        }

        fn is_alive(&mut self, _pid: u32) -> bool {
            self.checks += 1;
            !self.killed && self.exits_after.is_none_or(|n| self.checks <= n)
        }

        fn pause(&mut self, duration: Duration) {
            self.paused += duration;
        }
    }

    #[test]
    fn sigterm_is_enough_when_the_process_exits_in_time() -> Result<(), String> {
        let mut process = FakeProcess::new(Some(2));
        terminate_gracefully(&mut process, 42, TERM_GRACE, TERM_POLL)?;
        assert_eq!(process.sent, vec!["TERM"]);
        assert_eq!(process.paused, TERM_POLL * 2);
        Ok(())
    }

    #[test]
    fn sigkill_follows_when_the_grace_period_runs_out() -> Result<(), String> {
        let mut process = FakeProcess::new(None);
        terminate_gracefully(&mut process, 42, Duration::from_millis(300), TERM_POLL)?;
        assert_eq!(process.sent, vec!["TERM", "KILL"]);
        assert_eq!(process.paused, Duration::from_millis(300));
        Ok(())
    }
}
