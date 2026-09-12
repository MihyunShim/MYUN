import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

let revision = 'local';
try { revision = execFileSync('git', ['rev-parse', '--short=8', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { /* Source ZIP without git metadata. */ }
const version = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version;

export default defineConfig({
  plugins: [react()],
  define: { 'import.meta.env.VITE_BUILD_LABEL': JSON.stringify(`${version} · ${revision}`) },
  build: { outDir: 'dist' },
  server: { port: 5173 },
});
