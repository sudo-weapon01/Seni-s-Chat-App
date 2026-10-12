let io = null;

function setIo(instance) {
  io = instance;
}

function getIo() {
  if (!io) {
    return { to() { return { emit() {} }; }, emit() {} };
  }
  return io;
}

function emitToUsers(userIds, event, payload) {
  const instance = getIo();
  for (const id of userIds) {
    instance.to(`user:${id}`).emit(event, payload);
  }
}

module.exports = { setIo, getIo, emitToUsers };
