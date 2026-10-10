import { ref } from 'vue'

/** Becomes true once the diagram fonts are usable; canvases drawn earlier need redrawing. */
export const fontsReady = ref(false)

// A canvas only uses a web font once the browser has loaded it, and nothing on the page
// asks for most of these weights, so request them explicitly.
const faces = ['400 16px "SwoReel Sans"', '600 16px "SwoReel Sans"', '700 16px "SwoReel Sans"', '400 16px "SwoReel Mono"']

Promise.all(faces.map((face) => document.fonts.load(face))).finally(() => (fontsReady.value = true))
