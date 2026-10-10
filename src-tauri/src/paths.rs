//! Where SwoReel keeps things. The CLI (`plugin/cli/paths.ts`) follows the same rules.
//!
//! | What     | Linux                          | macOS                                          | Windows                    |
//! |----------|--------------------------------|------------------------------------------------|----------------------------|
//! | Reels   | `~/.local/share/sworeel/reels`| `~/Library/Application Support/SwoReel/reels` | `%APPDATA%\SwoReel\reels` |
//! | Settings | `~/.config/sworeel/config.json`| `~/Library/Application Support/SwoReel/config.json` | `%APPDATA%\SwoReel\config.json` |
//! | Exports  | `Documents/SwoReel` on all three                                                                             |
//!
//! | Pictures | an `assets` folder beside the reels folder                                                                   |
//!
//! Reels are the app's working files; exports are what the user publishes, so only exports
//! go in Documents. `reels` and `exports` in `config.json` override the defaults.
//!
//! `SWOREEL_HOME` moves everything into one folder: its `reels`, `assets` and `exports`
//! folders and its own `config.json`. Nothing outside it is read or written.
//! The default exports folder is written to `config.json` the first time it is used, so the
//! CLI and the app agree even where they would locate Documents differently.

use serde_json::{Map, Value};
use std::fs;
use std::path::PathBuf;

fn user_home() -> PathBuf {
    dirs::home_dir().unwrap_or_default()
}

fn app_folder() -> &'static str {
    if cfg!(target_os = "linux") {
        "sworeel"
    } else {
        "SwoReel"
    }
}

fn env_home() -> Option<PathBuf> {
    std::env::var_os("SWOREEL_HOME")
        .filter(|value| !value.is_empty())
        .map(|value| std::path::absolute(&value).unwrap_or_else(|_| PathBuf::from(value)))
}

pub fn config_file() -> PathBuf {
    if let Some(home) = env_home() {
        return home.join("config.json");
    }
    dirs::config_dir()
        .unwrap_or_else(|| user_home().join(".config"))
        .join(app_folder())
        .join("config.json")
}

/// The settings in `config.json`. `None` means the file is there but could not be read as
/// settings, which happens for an instant while the command is saving it; a missing file is
/// simply no settings yet.
fn read_config() -> Option<Map<String, Value>> {
    match fs::read_to_string(config_file()) {
        Ok(text) => serde_json::from_str(&text).ok(),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Some(Map::new()),
        Err(_) => None,
    }
}

/// Every setting in `config.json`; empty when there are none or the file can't be read.
pub fn config() -> Map<String, Value> {
    read_config().unwrap_or_default()
}

/// A text setting from `config.json`, if it is set to something.
fn setting(key: &str) -> Option<String> {
    config().get(key).and_then(|value| value.as_str()).filter(|text| !text.is_empty()).map(str::to_owned)
}

fn configured(key: &str) -> Option<PathBuf> {
    setting(key).map(PathBuf::from)
}

/// Where the app notes which reel and step it is showing, for `sworeel showing` to read.
pub fn showing_file() -> PathBuf {
    config_file().with_file_name("showing.json")
}

/// Where the `sworeel app` command leaves a note asking the app to show a reel.
pub fn request_file() -> PathBuf {
    config_file().with_file_name("open-request.json")
}

pub fn reels() -> PathBuf {
    if let Some(home) = env_home() {
        return home.join("reels");
    }
    configured("reels").unwrap_or_else(|| {
        dirs::data_dir()
            .unwrap_or_else(|| user_home().join(".local/share"))
            .join(app_folder())
            .join("reels")
    })
}

/// Where images that reels use are kept: beside the reels folder, not inside it.
pub fn assets() -> PathBuf {
    reels().with_file_name("assets")
}

pub fn exports() -> PathBuf {
    if let Some(home) = env_home() {
        return home.join("exports");
    }
    if let Some(exports) = configured("exports") {
        return exports;
    }

    let exports = dirs::document_dir()
        .unwrap_or_else(|| user_home().join("Documents"))
        .join("SwoReel");
    // Remember it, so the folder stays put if the Documents folder is later renamed. If the
    // settings can't be read right now, leave them alone rather than write over them.
    if let Some(mut config) = read_config() {
        config.insert("exports".into(), exports.to_string_lossy().into());
        let file = config_file();
        if let Some(folder) = file.parent() {
            let _ = fs::create_dir_all(folder);
        }
        if let Ok(text) = serde_json::to_string_pretty(&config) {
            // Written beside the file and moved into place, so nothing ever reads half of it.
            let draft = file.with_extension("json.tmp");
            if fs::write(&draft, text + "\n").is_ok() {
                let _ = fs::rename(&draft, &file);
            }
        }
    }
    exports
}

/// The `sworeel` command: `SWOREEL_CLI` if set, else the first one on PATH, else the usual
/// per-user install location.
pub fn cli() -> PathBuf {
    if let Some(cli) = std::env::var_os("SWOREEL_CLI").filter(|value| !value.is_empty()) {
        return PathBuf::from(cli);
    }
    let name = if cfg!(windows) { "sworeel.cmd" } else { "sworeel" };
    std::env::var_os("PATH")
        .and_then(|path| {
            std::env::split_paths(&path)
                .map(|folder| folder.join(name))
                .find(|candidate| candidate.is_file())
        })
        .unwrap_or_else(|| user_home().join(".local/bin").join(name))
}
