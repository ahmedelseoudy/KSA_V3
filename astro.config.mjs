import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import react from '@astrojs/react';
import vercel from '@astrojs/vercel/serverless';

export default defineConfig({
  output: 'server', // Changed from 'static' to enable server-side authentication
  adapter: vercel({
    runtime: 'nodejs20.x'
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