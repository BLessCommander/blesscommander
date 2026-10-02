import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

const progetto = JSON.parse(
  readFileSync(fileURLToPath(new URL('../docs/progetto.json', import.meta.url)), 'utf8'),
);
const repoCodice = progetto.repos?.code || 'blesscommander';

// Percorso di base: "/" in sviluppo; "/<repository>/" in build (GitHub Pages).
// Si può forzare con la variabile VITE_BASE.
export default defineConfig(({ command }) => ({
  base: process.env.VITE_BASE ?? (command === 'build' ? `/${repoCodice}/` : '/'),
  plugins: [vue()],
  define: {
    __APP_NAME__: JSON.stringify(progetto.appName || 'Bracketeer'),
  },
  server: { port: 5173 },
  preview: { port: 4173 },
  test: {
    environment: 'node',
  },
}));
