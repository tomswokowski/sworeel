// How reels, folders and files are named, the same way the sworeel command names them. Plain
// functions with nothing of the window in them, so the tests can run them too.

/** A reel's name as the sworeel command and Claude know it: its folder and file name, `web/cors`. */
export const fullName = (file: { folder: string; name: string }) => `${file.folder ? `${file.folder}/` : ''}${file.name}`

/** Whether a folder is `parent` or somewhere inside it. */
export const within = (candidate: string, parent: string) => candidate === parent || candidate.startsWith(`${parent}/`)

/** The last part of a path, on any system. */
export const baseName = (path: string) => path.split(/[/\\]/).pop() ?? path
