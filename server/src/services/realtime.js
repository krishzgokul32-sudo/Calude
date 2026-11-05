// Thin wrapper around Socket.IO so services can push live events to a user's open tabs.
let io = null;

export function setIO(instance) {
  io = instance;
}

export function emitToUser(userId, event, payload) {
  if (io) io.to(`user:${userId}`).emit(event, payload);
}
