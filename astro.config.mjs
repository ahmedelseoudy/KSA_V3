import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import react from '@astrojs/react';
import node from '@astrojs/node';

export default defineConfig({
  output: 'server', // SSR mode required for authentication
  adapter: node({
    mode: 'standalone',
    host: true // bind 0.0.0.0 regardless of HOST env var, required for Render's port scan
  }),
  integrations: [tailwind(), react()],
  vite: {
    ssr: {
      noExternal: ['chart.js', 'jszip', 'xlsx-js-style']
    },
    optimizeDeps: {
      include: ['chart.js', 'jszip', 'xlsx', 'xlsx-js-style']
    },
    build: {
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('chart.js')) {
                return 'charts';
              }
              if (id.includes('xlsx') || id.includes('xlsx-js-style') || id.includes('jszip')) {
                return 'utils';
              }
              return 'vendor';
            }
          },
          inlineDynamicImports: false
        }
      }
    }
  }
});