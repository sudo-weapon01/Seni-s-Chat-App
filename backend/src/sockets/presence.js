const socketsByUser = new Map();

function addSocket(userId, socketId) {
  if (!socketsByUser.has(userId)) {
    socketsByUser.set(userId, new Set());
  }
  socketsByUser.get(userId).add(socketId);
}

function removeSocket(userId, socketId) {
  const set = socketsByUser.get(userId);
  if (!set) return;
  set.delete(socketId);
  if (set.size === 0) {
    socketsByUser.delete(userId);
  }
}

function isOnline(userId) {
  return socketsByUser.has(userId) && socketsByUser.get(userId).size > 0;
}

function onlineUserIds() {
  return Array.from(socketsByUser.keys());
}

module.exports = { addSocket, removeSocket, isOnline, onlineUserIds };
