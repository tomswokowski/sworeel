mod library;
mod paths;
mod update;

use library::Library;
use serde::Serialize;
use std::process::Command;

type Result<T> = std::result::Result<T, String>;

#[derive(Serialize)]
struct Paths {
    reels: String,
    exports: String,
}

/// Runs the `sworeel` command and returns what it printed. Everything that changes the library
/// or renders a reel goes through here, so the app and Claude follow the same rules.
///
/// Callers put `--` before anything a person typed (a name, a folder, a watermark), so that
/// text starting with a dash is taken as text and never as an option.
async fn sworeel<const N: usize>(args: [&str; N]) -> Result<String> {
    let mut command = Command::new(paths::cli());
    // The command is a script that starts Node, so it needs the PATH a terminal would have.
    command.args(args).env("PATH", paths::search_path());
    // The command is a script on Windows; without this each call would flash a console window.
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x0800_0000);
    }

    let output = tauri::async_runtime::spawn_blocking(move || command.output())
        .await
        .map_err(|error| error.to_string())?
        .map_err(|error| {
            if error.kind() == std::io::ErrorKind::NotFound {
                // The app is a window onto the plugin's command; without it nothing can be changed or exported.
                "SwoReel could not find the sworeel command, which comes with its Claude Code plugin. \
                 Install the plugin (see https://github.com/tomswokowski/sworeel), then start the app again. \
                 If it is installed somewhere unusual, set SWOREEL_CLI to its path."
                    .to_string()
            } else {
                format!("Could not run the sworeel command: {error}")
            }
        })?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        let said = String::from_utf8_lossy(&output.stderr).trim().to_string();
        Err(if said.is_empty() { "The sworeel command failed without saying why.".into() } else { said })
    }
}

/// Runs a command that reports the reel it produced as JSON, and returns that reel's path.
async fn resulting_path<const N: usize>(args: [&str; N]) -> Result<String> {
    let printed = sworeel(args).await?;
    serde_json::from_str::<serde_json::Value>(&printed)
        .ok()
        .and_then(|result| result.get("path")?.as_str().map(str::to_owned))
        .ok_or_else(|| format!("Unexpected reply from the sworeel command: {printed}"))
}

fn reel_name(path: &str) -> Result<String> {
    library::reel_name(&paths::reels(), path)
}

#[tauri::command]
fn get_paths() -> Paths {
    let text = |path: std::path::PathBuf| path.to_string_lossy().into_owned();
    Paths {
        reels: text(paths::reels()),
        exports: text(paths::exports()),
    }
}

#[derive(Serialize)]
struct Settings {
    /// A credit drawn in the corner of every frame; empty when there is none.
    watermark: String,
    /// Whether the row of step dots is drawn on every frame.
    progress: bool,
    /// Colours that replace the default ones on every reel; an empty object when none are set.
    theme: serde_json::Value,
    /// The formats a video is rendered in when none is asked for.
    formats: Vec<String>,
    /// Frames per second for video.
    fps: u64,
}

#[tauri::command]
fn get_settings() -> Settings {
    // Read once: the app asks every second, and each setting used to mean reading the file again.
    let config = paths::config();
    let formats: Vec<String> = config
        .get("formats")
        .and_then(|value| serde_json::from_value(value.clone()).ok())
        .unwrap_or_default();
    Settings {
        watermark: config.get("watermark").and_then(|value| value.as_str()).unwrap_or_default().to_owned(),
        progress: config.get("progress").and_then(|value| value.as_bool()).unwrap_or(false),
        theme: config.get("theme").filter(|value| value.is_object()).cloned().unwrap_or_else(|| serde_json::json!({})),
        formats: if formats.is_empty() { vec!["wide".into()] } else { formats },
        fps: config.get("fps").and_then(|value| value.as_u64()).unwrap_or(30),
    }
}

/// Changes one setting through the sworeel command, which checks the value and saves it where
/// both the command and the app read it.
#[tauri::command]
async fn set_setting(key: String, value: String) -> Result<()> {
    if !["watermark", "progress", "formats", "fps", "exports"].contains(&key.as_str()) {
        return Err(format!("Unknown setting \"{key}\""));
    }
    sworeel(["config", "--", &key, &value]).await.map(|_| ())
}

#[derive(Serialize)]
struct OpenRequest {
    /// The reel to show, as the command names it (`web/cors`); none means just come forward.
    reel: Option<String>,
}

/// Picks up a request left by `sworeel app`, removing it so the command knows the app is
/// running, and brings the window forward.
#[tauri::command]
fn take_request(window: tauri::Window) -> Option<OpenRequest> {
    let file = paths::request_file();
    let text = std::fs::read_to_string(&file).ok()?;
    let _ = std::fs::remove_file(&file);
    let _ = window.unminimize();
    let _ = window.set_focus();
    let request: serde_json::Value = serde_json::from_str(&text).ok()?;
    Some(OpenRequest {
        reel: request.get("reel").and_then(|reel| reel.as_str()).map(str::to_owned),
    })
}

/// Notes which reel and step the app is showing, so Claude can tell what "this" means.
/// With no reel, the note is removed.
#[tauri::command]
fn set_showing(reel: Option<String>, step: u32) {
    let file = paths::showing_file();
    match reel.and_then(|path| library::reel_name(&paths::reels(), &path).ok()) {
        Some(name) => {
            let at = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map_or(0, |since| since.as_millis() as u64);
            // The process id lets the command tell a note from a running app from one left by an
            // app that was killed before it could tidy up.
            let note = serde_json::json!({ "reel": name, "step": step, "at": at, "pid": std::process::id() });
            let _ = std::fs::write(file, note.to_string());
        }
        None => {
            let _ = std::fs::remove_file(file);
        }
    }
}

#[tauri::command]
fn list_library() -> Library {
    let reels = paths::reels();
    let _ = std::fs::create_dir_all(&reels);
    library::list(&reels)
}

#[tauri::command]
fn read_reel(path: String) -> Result<String> {
    library::read_reel(&paths::reels(), &path)
}

/// Reads the image a picture reel names. Only image files are read.
#[tauri::command]
fn read_picture(reel: String, src: String) -> Result<tauri::ipc::Response> {
    let reel = std::path::PathBuf::from(&reel);
    library::read_reel(&paths::reels(), &reel.to_string_lossy())?;
    // The picture store first, then (as older reels have it) a path from the reel's own folder.
    let candidates = [paths::assets().join(&src), reel.parent().unwrap_or(&reel).join(&src)];
    let file = candidates
        .iter()
        .find(|candidate| candidate.is_file())
        .ok_or_else(|| format!("There is no picture called \"{src}\"."))?;
    let is_image = file
        .extension()
        .and_then(|ext| ext.to_str())
        .is_some_and(|ext| ["png", "jpg", "jpeg"].contains(&ext.to_lowercase().as_str()));
    if !is_image {
        return Err(format!("{src} is not a PNG or JPEG file."));
    }
    std::fs::read(file)
        .map(tauri::ipc::Response::new)
        .map_err(|error| format!("Could not read the picture {}: {error}", file.display()))
}

#[tauri::command]
async fn rename_reel(path: String, name: String) -> Result<String> {
    resulting_path(["rename", "--json", "--", &reel_name(&path)?, &name]).await
}

#[tauri::command]
async fn move_reel(path: String, folder: String) -> Result<String> {
    let folder = if folder.is_empty() { "." } else { &folder };
    resulting_path(["move", "--json", "--", &reel_name(&path)?, folder]).await
}

#[tauri::command]
async fn duplicate_reel(path: String) -> Result<String> {
    resulting_path(["duplicate", "--json", "--", &reel_name(&path)?]).await
}

/// Sends a reel to the system trash, where it can be restored.
#[tauri::command]
async fn delete_reel(path: String) -> Result<()> {
    sworeel(["delete", "--", &reel_name(&path)?]).await.map(|_| ())
}

/// A folder's name is one folder, not a path, so nothing typed can reach into other folders.
fn one_name(name: &str) -> Result<()> {
    if name.contains(['/', '\\']) {
        return Err("A folder name can't contain / or \\.".into());
    }
    Ok(())
}

#[tauri::command]
async fn create_folder(parent: String, name: String) -> Result<()> {
    one_name(&name)?;
    let folder = if parent.is_empty() { name } else { format!("{parent}/{name}") };
    sworeel(["folder", "create", "--", &folder]).await.map(|_| ())
}

#[tauri::command]
async fn rename_folder(folder: String, name: String) -> Result<()> {
    one_name(&name)?;
    sworeel(["folder", "rename", "--", &folder, &name]).await.map(|_| ())
}

#[tauri::command]
async fn move_folder(folder: String, into: String) -> Result<()> {
    let into = if into.is_empty() { "." } else { &into };
    sworeel(["folder", "move", "--", &folder, into]).await.map(|_| ())
}

/// Sends a folder and everything in it to the system trash.
#[tauri::command]
async fn delete_folder(folder: String) -> Result<()> {
    sworeel(["folder", "delete", "--", &folder]).await.map(|_| ())
}

/// Renders a reel with the sworeel command and returns what it wrote: one path a line.
/// `what` is `video` (in `format`), `videos` (in every default format), `still` (of `step`)
/// or `stills` (every step, into a folder).
#[tauri::command]
async fn export_reel(path: String, what: String, format: String, step: Option<u32>) -> Result<Vec<String>> {
    let name = reel_name(&path)?;
    let step = step.unwrap_or(0).to_string();
    let printed = match what.as_str() {
        "video" => sworeel(["render", "--format", &format, "--", &name]).await?,
        "videos" => sworeel(["render", "--", &name]).await?,
        "still" => sworeel(["still", "--format", &format, "--step", &step, "--", &name]).await?,
        "stills" => sworeel(["stills", "--format", &format, "--", &name]).await?,
        _ => return Err(format!("Unknown export \"{what}\"")),
    };
    Ok(printed.lines().map(str::to_owned).collect())
}

/// Packs a reel, a folder of reels (`name/`) or the whole library (`.`) into one file, with the
/// pictures they use, and returns where it was saved.
#[tauri::command]
async fn bundle(name: String) -> Result<String> {
    sworeel(["bundle", "--", &name]).await
}

/// Adds the reels in a bundle to the library. The bundle arrives as text because the window
/// reads the chosen file; the command reads it from a file, so it is written out for a moment.
#[tauri::command]
async fn import_bundle(text: String) -> Result<String> {
    // Named for this moment, so two imports close together can't read each other's file.
    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_or(0, |since| since.as_nanos());
    let file = paths::config_file().with_file_name(format!("incoming-{stamp}.sworeel"));
    if let Some(folder) = file.parent() {
        std::fs::create_dir_all(folder).map_err(|error| error.to_string())?;
    }
    std::fs::write(&file, text).map_err(|error| error.to_string())?;
    let result = sworeel(["import", "--", &file.to_string_lossy()]).await;
    let _ = std::fs::remove_file(&file);
    result
}

/// Opens a file or folder with the desktop's default application.
#[tauri::command]
async fn open_path(path: String) -> Result<()> {
    // Only what the app itself shows: the library, the exports folder, and files inside them.
    let wanted = std::fs::canonicalize(&path).map_err(|_| format!("{path} does not exist."))?;
    let allowed = [paths::reels(), paths::exports()]
        .iter()
        .filter_map(|folder| std::fs::canonicalize(folder).ok())
        .any(|folder| wanted.starts_with(folder));
    if !allowed {
        return Err(format!("{path} is not in the SwoReel library or exports folder."));
    }
    sworeel(["open", "--", &path]).await.map(|_| ())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(update::Ready::default())
        .setup(|app| {
            update::watch(app.handle());
            Ok(())
        })
        // Once the window is gone the app is showing nothing, however it was closed.
        .on_window_event(|_window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                let _ = std::fs::remove_file(paths::showing_file());
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_paths,
            get_settings,
            set_setting,
            take_request,
            set_showing,
            list_library,
            read_reel,
            read_picture,
            rename_reel,
            move_reel,
            duplicate_reel,
            delete_reel,
            create_folder,
            rename_folder,
            move_folder,
            delete_folder,
            export_reel,
            bundle,
            import_bundle,
            open_path,
            update::update_ready,
            update::restart_to_update
        ])
        .run(tauri::generate_context!())
        .expect("error while running sworeel");
}
