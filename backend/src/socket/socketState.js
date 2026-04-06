export const MATCH_QUEUE_KEY = 'queue:random-match';

export const getUserSocketSetKey = (userId) => `user:${userId}:sockets`;
export const getSocketUserKey = (socketId) => `socket:${socketId}:user`;
export const getRoomMediaStateKey = (roomId) => `room:${roomId}:mediaState`;

export const isMatchRoom = (roomId) => roomId.startsWith('match:');
