import { fileURLToPath, URL } from 'node:url'

import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const mathjaxVersion = JSON.parse(readFileSync('plugin/node_modules/mathjax-full/package.json', 'utf8')).version

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
  ],
  // MathJax reads its version from this when bundled; without it, it tries to load a file
  // through Node's `require`, which a browser doesn't have.
  define: {
    PACKAGE_VERSION: JSON.stringify(mathjaxVersion),
  },
  server: {
    port: 5181,
    strictPort: true,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
