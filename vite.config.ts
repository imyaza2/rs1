
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Cloudflare Pages works best with standard settings.
// 'dist' is the default build output which Pages detects automatically.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: true
  },
  define: {
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY)
  }
});
