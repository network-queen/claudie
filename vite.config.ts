import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3434',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:3434',
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'xterm': ['@xterm/xterm', '@xterm/addon-fit', '@xterm/addon-web-links'],
          'codemirror': ['codemirror', '@codemirror/view', '@codemirror/state', '@codemirror/theme-one-dark',
            '@codemirror/lang-javascript', '@codemirror/lang-html', '@codemirror/lang-css', '@codemirror/lang-json',
            '@codemirror/lang-markdown', '@codemirror/lang-python', '@codemirror/lang-rust', '@codemirror/lang-java', '@codemirror/lang-cpp'],
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
});
