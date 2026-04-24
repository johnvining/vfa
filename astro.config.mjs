// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  build: { format: 'file' },
  markdown: { smartypants: false },
  vite: {
    plugins: [{
      name: 'htm-rewrite',
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          if (req.url?.endsWith('.htm')) {
            req.url = req.url.slice(0, -4);
          }
          next();
        });
      }
    }]
  }
});
