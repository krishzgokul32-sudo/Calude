import { cache } from './cache.js';

// Thin wrapper around Socket.IO so services can push live events to a user's open tabs.
let io = null;

export function setIO(instance) {
  io = instance;
}

export function emitToUser(userId, event, payload) {
  // Any write that notifies the UI also clears the user's cached analytics.
  if (event === 'data:changed') cache.invalidateUser(userId);
  if (io) io.to(`user:${userId}`).emit(event, payload);
}
