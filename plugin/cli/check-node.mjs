// Exits with 1 when this Node.js cannot run SwoReel's TypeScript as it is: 22.18 or newer, and
// on 23 at least 23.6, where running TypeScript became the default. It is plain JavaScript, so
// even a Node too old to run the rest can run this and say so.
const [major, minor] = process.versions.node.split('.').map(Number)
process.exit(major > 23 || (major === 23 && minor >= 6) || (major === 22 && minor >= 18) ? 0 : 1)
