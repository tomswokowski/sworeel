// Exits with 1 when this Node.js is older than the 22.18 SwoReel needs. It is plain JavaScript,
// so even a Node too old to run the rest can run this and say so.
const [major, minor] = process.versions.node.split('.').map(Number)
process.exit(major > 22 || (major === 22 && minor >= 18) ? 0 : 1)
