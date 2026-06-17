import { app, initDatabase } from './app.js';
import db from './database.js';
import { startScheduler } from './scheduler.js';

const PORT = process.env.PORT || 3001;

async function start() {
  await initDatabase();
  const server = app.listen(PORT, () => {
    console.log(`Server ready on port ${PORT}`);
  });

  startScheduler();

  const shutdown = () => {
    console.log('Shutdown signal received');
    try { db.save(); } catch { /* ignore */ }
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
