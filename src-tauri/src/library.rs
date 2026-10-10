//! Reading the reel library. Changes to it (rename, move, delete and so on) are made by the
//! `sworeel` command, so the rules for those live in one place: `plugin/cli/library.ts`.

use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

#[derive(Serialize, Debug, PartialEq)]
pub struct ReelFile {
    pub path: String,
    /// File name without the extension.
    pub name: String,
    /// Folder relative to the library root, with `/` separators; empty for the root.
    pub folder: String,
    /// Milliseconds since the epoch, so the UI can tell when a file changed.
    pub modified: u64,
}

#[derive(Serialize, Debug, Default)]
pub struct Library {
    pub reels: Vec<ReelFile>,
    /// Every folder, including empty ones, relative to the root with `/` separators.
    pub folders: Vec<String>,
}

type Result<T> = std::result::Result<T, String>;

fn relative(path: &Path, root: &Path) -> String {
    path.strip_prefix(root)
        .unwrap_or(path)
        .components()
        .map(|part| part.as_os_str().to_string_lossy())
        .collect::<Vec<_>>()
        .join("/")
}

fn is_hidden(path: &Path) -> bool {
    path.file_name()
        .is_some_and(|name| name.to_string_lossy().starts_with('.'))
}

/// What a folder holds, counting everything beneath it.
#[derive(Default, Clone, Copy)]
struct Contents {
    reels: usize,
    other_files: usize,
}

fn collect(dir: &Path, root: &Path, library: &mut Library) -> Contents {
    let mut contents = Contents::default();
    let Ok(entries) = fs::read_dir(dir) else {
        return contents;
    };
    for path in entries.flatten().map(|entry| entry.path()) {
        if is_hidden(&path) {
            continue;
        }
        if path.is_dir() {
            let at = library.folders.len();
            library.folders.push(relative(&path, root));
            let inside = collect(&path, root, library);
            // A folder holding files but no reels (images, say) is not part of the library.
            // An empty folder is: someone has just made it.
            if inside.reels == 0 && inside.other_files > 0 {
                library.folders.truncate(at);
            }
            contents.reels += inside.reels;
            contents.other_files += inside.other_files;
        } else if !path.extension().is_some_and(|ext| ext == "json") {
            contents.other_files += 1;
        } else {
            contents.reels += 1;
            let modified = fs::metadata(&path)
                .and_then(|meta| meta.modified())
                .ok()
                .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
                .map_or(0, |since| since.as_millis() as u64);
            library.reels.push(ReelFile {
                name: path
                    .file_stem()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .into_owned(),
                folder: relative(path.parent().unwrap_or(root), root),
                path: path.to_string_lossy().into_owned(),
                modified,
            });
        }
    }
    contents
}

pub fn list(root: &Path) -> Library {
    let mut library = Library::default();
    collect(root, root, &mut library);
    library.folders.sort();
    library
        .reels
        .sort_by(|a, b| (&a.folder, &a.name).cmp(&(&b.folder, &b.name)));
    library
}

/// Resolves a path the UI sent back, and checks it really is a reel file inside the library.
fn reel_file(root: &Path, path: &str) -> Result<(PathBuf, PathBuf)> {
    let path = fs::canonicalize(path).map_err(|error| format!("{path}: {error}"))?;
    let root = fs::canonicalize(root).map_err(|error| error.to_string())?;
    if path.starts_with(&root) && path.is_file() {
        Ok((path, root))
    } else {
        Err(format!("{} is not a reel in the library.", path.display()))
    }
}

pub fn read_reel(root: &Path, path: &str) -> Result<String> {
    fs::read_to_string(reel_file(root, path)?.0).map_err(|error| error.to_string())
}

/// The name the `sworeel` command knows a reel by: its path inside the library without the
/// extension, such as `web/cors`.
pub fn reel_name(root: &Path, path: &str) -> Result<String> {
    let (path, root) = reel_file(root, path)?;
    Ok(relative(&path.with_extension(""), &root))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A fresh library in the temp folder, removed when dropped.
    struct TempLibrary(PathBuf);

    impl TempLibrary {
        fn new(test: &str) -> Self {
            let root = std::env::temp_dir().join(format!("sworeel-{}-{test}", std::process::id()));
            let _ = fs::remove_dir_all(&root);
            fs::create_dir_all(root.join("web")).unwrap();
            fs::write(root.join("front-door.json"), "{}").unwrap();
            fs::write(root.join("web/cors.json"), "{}").unwrap();
            fs::write(root.join("notes.txt"), "").unwrap();
            Self(root)
        }

        fn path(&self, relative: &str) -> String {
            self.0.join(relative).to_string_lossy().into_owned()
        }
    }

    impl Drop for TempLibrary {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn lists_reels_and_folders_and_skips_other_files() {
        let lib = TempLibrary::new("list");
        fs::create_dir_all(lib.0.join("empty")).unwrap();
        fs::create_dir_all(lib.0.join(".hidden")).unwrap();
        // A folder with only images is left out; so is a folder whose only content is one.
        fs::create_dir_all(lib.0.join("shots/more")).unwrap();
        fs::write(lib.0.join("shots/more/a.png"), "").unwrap();
        let library = list(&lib.0);
        let names: Vec<_> = library
            .reels
            .iter()
            .map(|reel| format!("{}/{}", reel.folder, reel.name))
            .collect();
        assert_eq!(names, ["/front-door", "web/cors"]);
        assert_eq!(library.folders, ["empty", "web"]);
    }

    #[test]
    fn names_reels_the_way_the_command_does() {
        let lib = TempLibrary::new("names");
        assert_eq!(reel_name(&lib.0, &lib.path("front-door.json")).unwrap(), "front-door");
        assert_eq!(reel_name(&lib.0, &lib.path("web/cors.json")).unwrap(), "web/cors");
    }

    #[test]
    fn refuses_paths_outside_the_library() {
        let lib = TempLibrary::new("outside");
        let outside = std::env::temp_dir().join(format!("sworeel-outside-{}.json", std::process::id()));
        fs::write(&outside, "{}").unwrap();
        let path = outside.to_string_lossy().into_owned();
        assert!(read_reel(&lib.0, &path).is_err());
        assert!(reel_name(&lib.0, &path).is_err());
        assert!(reel_name(&lib.0, &lib.path("web")).is_err());
        let _ = fs::remove_file(outside);
    }
}
