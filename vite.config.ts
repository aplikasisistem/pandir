import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, Plugin } from 'vite';
import { handler as authHandler } from './netlify/functions/auth.ts';

const currentDir =
  typeof import.meta.dirname !== 'undefined'
    ? import.meta.dirname
    : path.dirname(fileURLToPath(import.meta.url));

function authDevPlugin(): Plugin {
  return {
    name: 'auth-dev-server',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/auth')) {
          return next();
        }

        const chunks: Buffer[] = [];
        req.on('data', (chunk) => chunks.push(chunk));
        req.on('end', async () => {
          const bodyStr = Buffer.concat(chunks).toString('utf-8');
          const event = {
            httpMethod: req.method,
            path: req.url,
            headers: req.headers,
            body: bodyStr,
          };

          try {
            const result = await authHandler(event);
            res.statusCode = result.statusCode || 200;
            if (result.headers) {
              Object.entries(result.headers).forEach(([k, v]) => {
                res.setHeader(k, v as string);
              });
            }
            res.end(result.body);
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err.message }));
          }
        });
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), authDevPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(currentDir, '.'),
      },
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: false,
      chunkSizeWarningLimit: 2000,
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      headers: {
        'Service-Worker-Allowed': '/',
      },
    },
  };
});
