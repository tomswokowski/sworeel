//! Keeps the app up to date without the person doing anything.
//!
//! Soon after starting, and a few times a day while it stays open, the app asks whether a newer
//! version has been released and fetches it in the background. The download is checked against
//! the public key in `tauri.conf.json`, so only a version built by the release workflow is ever
//! accepted. On macOS and Linux the new version is put in place straight away and is what opens
//! next time. On Windows installing has to close the app, so it waits until the app is closed
//! anyway and installs then, without opening it again; or sooner, if the person chooses
//! "Restart" in the notice the window shows.
//!
//! An app that was not installed in a way that can replace itself is left alone: a build for
//! development, and on Linux anything other than the AppImage (a package manager owns those).

use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Manager, State};
use tauri_plugin_updater::{Update, UpdaterExt};

const CHECK_EVERY: Duration = Duration::from_secs(6 * 60 * 60);

struct Fetched {
    version: String,
    /// The download, where it is still to be installed.
    waiting: Option<(Update, Vec<u8>)>,
}

/// The newer version that has been fetched, once there is one.
#[derive(Default)]
pub struct Ready(Mutex<Option<Fetched>>);

fn can_update() -> bool {
    !cfg!(debug_assertions) && (!cfg!(target_os = "linux") || std::env::var_os("APPIMAGE").is_some())
}

/// Starts looking for newer versions, until one has been fetched.
pub fn watch(app: &AppHandle) {
    if !can_update() {
        return;
    }
    let app = app.clone();
    std::thread::spawn(move || {
        loop {
            match tauri::async_runtime::block_on(fetch(&app)) {
                Ok(true) => break,
                Ok(false) => {}
                // Being offline is the usual reason, and no reason to bother anyone.
                Err(error) => eprintln!("SwoReel could not check for a newer version: {error}"),
            }
            std::thread::sleep(CHECK_EVERY);
        }
    });
}

/// Fetches a newer version if there is one, and says whether there was.
async fn fetch(app: &AppHandle) -> tauri_plugin_updater::Result<bool> {
    let Some(update) = app.updater()?.check().await? else {
        return Ok(false);
    };
    let bytes = update.download(|_, _| {}, || {}).await?;
    let version = update.version.clone();
    let waiting = if cfg!(windows) {
        Some((update, bytes))
    } else {
        update.install(bytes)?;
        None
    };
    *app.state::<Ready>().0.lock().unwrap() = Some(Fetched { version, waiting });
    Ok(true)
}

/// The version that will be running after a restart, if a newer one has been fetched.
#[tauri::command]
pub fn update_ready(ready: State<Ready>) -> Option<String> {
    ready.0.lock().unwrap().as_ref().map(|fetched| fetched.version.clone())
}

/// Closes the app and opens the newer version, installing it first where that is still to do.
#[tauri::command]
pub fn restart_to_update(app: AppHandle, ready: State<Ready>) -> Result<(), String> {
    let fetched = ready.0.lock().unwrap().take();
    if let Some(Fetched { waiting: Some((update, bytes)), .. }) = fetched {
        update.install(bytes).map_err(|error| format!("Could not install the update: {error}"))?;
    }
    app.restart()
}

/// Installs a fetched version that is still waiting, as the app closes. It is not opened
/// afterwards: the person has just closed it.
pub fn install_on_close(app: &AppHandle) {
    let fetched = app.state::<Ready>().0.lock().unwrap().take();
    if let Some(Fetched { waiting: Some((update, bytes)), .. }) = fetched
        && let Err(error) = update.restart_after_install(false).install(bytes)
    {
        eprintln!("SwoReel could not install the newer version: {error}");
    }
}
