import { Session } from '../models/session.model.js';

export const startSession = async ({ userId, roomId, connectionId }) => {
  const session = new Session({
    user: userId,
    room: roomId,
    connectionId,
    joinedAt: new Date(),
  });

  await session.save();
  return session;
};

export const endSession = async (connectionId, exitReason = 'DISCONNECTED') => {
  const session = await Session.findOne({ connectionId, leftAt: null });

  if (!session) {
    return null;
  }

  session.leftAt = new Date();
  session.duration = session.leftAt.getTime() - session.joinedAt.getTime();
  session.exitReason = exitReason;
  await session.save();

  return session;
};
