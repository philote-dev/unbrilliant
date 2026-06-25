import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
//
// `--mode frozen` (npm run gallery) starts a second dev server with HMR off so a
// gallery tab stays put while the main dev server (npm run dev) hot-reloads from
// edits. The two share source, so a manual browser refresh re-syncs the frozen
// copy to the latest. A separate cacheDir keeps their dep optimizers from
// clobbering each other.
export default defineConfig(({ mode }) => {
  const frozen = mode === 'frozen'
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    ...(frozen
      ? { cacheDir: 'node_modules/.vite-frozen', server: { hmr: false } }
      : {}),
  }
})
