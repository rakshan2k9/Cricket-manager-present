import 'dotenv/config';
import http from 'http';
import path from 'path';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { apiRouter } from './src/server/routes.ts';
import { wsHub } from './src/server/wsHub.ts';
import { tickLiveAuctions } from './src/server/auctionEngine.ts';
import { tickGlobalLeagueCalendars, tickLivePvpFixtures } from './src/server/scheduleEngine.ts';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', time: Date.now() });
  });

  app.use('/api', apiRouter);

  const server = http.createServer(app);
  wsHub.init(server, async () => {
    await tickLiveAuctions();
    await tickLivePvpFixtures();
    await tickGlobalLeagueCalendars();
  });

  // Startup catch-up in case any auto-simulation intervals elapsed while offline
  tickGlobalLeagueCalendars(true).catch((err) => {
    console.error('Startup calendar catch-up error:', err);
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Cricket Dynasty server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
