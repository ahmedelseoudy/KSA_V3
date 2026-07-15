import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import react from '@astrojs/react';
import node from '@astrojs/node';

export default defineConfig({
  output: 'server', // SSR mode required for authentication
  server: {
    host: true // bind 0.0.0.0; @astrojs/node reads config.server.host, not adapter options
  },
  adapter: node({
    mode: 'standalone'
  }),
  integrations: [tailwind({ config: { applyBaseStyles: false } }), react()],
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