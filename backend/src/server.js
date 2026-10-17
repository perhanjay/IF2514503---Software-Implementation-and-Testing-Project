import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import app from './app.js';
import { ensureBucketExists } from './config/s3.js';

const server = http.createServer(app);
export const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.CLIENT_URL || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

io.on('connection', (socket) => {
  console.log(`[Socket.io] Client connected: ${socket.id}`);
  socket.on('disconnect', () => {
    console.log(`[Socket.io] Client disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, async () => {
  console.log(`[Polaris Audio Backend] Server running on http://localhost:${PORT}`);
  try {
    await ensureBucketExists();
  } catch (err) {
    console.warn(`[Storage Initialization]`, err.message);
  }
});

export { server };
