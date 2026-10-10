// Moves files and folders to the system trash, so a delete can be undone.
// Never falls back to deleting permanently.
import { execFile } from 'node:child_process'
import { mkdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, join } from 'node:path'
import { promisify } from 'node:util'

const run = promisify(execFile)

/** The freedesktop.org home trash, for Linux desktops with none of the usual tools. */
async function homeTrash(path: string) {
  const trash = join(process.env.XDG_DATA_HOME || join(homedir(), '.local', 'share'), 'Trash')
  await mkdir(join(trash, 'files'), { recursive: true })
  await mkdir(join(trash, 'info'), { recursive: true })
  let name = basename(path)
  for (let n = 2; await stat(join(trash, 'files', name)).then(() => true, () => false); n++) name = `${basename(path)}.${n}`
  const info = `[Trash Info]\nPath=${encodeURI(path)}\nDeletionDate=${new Date().toISOString().slice(0, 19)}\n`
  const infoFile = join(trash, 'info', `${name}.trashinfo`)
  await writeFile(infoFile, info)
  try {
    await rename(path, join(trash, 'files', name))
  } catch (error) {
    await rm(infoFile, { force: true })
    throw (error as NodeJS.ErrnoException).code === 'EXDEV' ? new Error('it is on a different drive from the trash') : error
  }
}

async function trashOne(path: string) {
  if (process.platform === 'darwin') {
    // `trash` ships with macOS 14 and later; Finder covers older versions.
    await run('/usr/bin/trash', [path]).catch(() =>
      run('osascript', ['-e', 'on run argv', '-e', 'tell application "Finder" to delete POSIX file (item 1 of argv)', '-e', 'end run', path]),
    )
  } else if (process.platform === 'win32') {
    const method = (await stat(path)).isDirectory() ? 'DeleteDirectory' : 'DeleteFile'
    // The path goes in through the environment: PowerShell would read one given on the command
    // line as more script.
    const script = `Add-Type -AssemblyName Microsoft.VisualBasic; [Microsoft.VisualBasic.FileIO.FileSystem]::${method}($env:SWOREEL_TRASH, 'OnlyErrorDialogs', 'SendToRecycleBin')`
    await run('powershell', ['-NoProfile', '-NonInteractive', '-Command', script], { env: { ...process.env, SWOREEL_TRASH: path } })
  } else {
    await run('gio', ['trash', '--', path])
      .catch(() => run('trash-put', ['--', path]))
      .catch(() => homeTrash(path))
  }
}

export async function trash(paths: string | string[]) {
  for (const path of [paths].flat()) {
    try {
      await trashOne(path)
    } catch (error) {
      throw new Error(`Could not move ${path} to the trash, so it was left in place. (${(error as Error).message.split('\n')[0]})`)
    }
  }
}
