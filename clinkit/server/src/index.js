import http from 'node:http';
import { createApp } from './app.js';
import { config } from './config.js';
import { initWs } from './ws/index.js';

const app = createApp();
const server = http.createServer(app);

// Socket.IO is optional at boot so the API runs before `npm install` completes in CI images.
try {
  const { Server } = await import('socket.io');
  const io = new Server(server, { cors: { origin: config.corsOrigins } });
  initWs(io);
  console.log('[ws] socket.io ready');
} catch {
  console.warn('[ws] socket.io not installed — REST only');
}

server.listen(config.port, () => {
  console.log(`Clinkit API on :${config.port} (mock providers: ${config.providersMock})`);
});
