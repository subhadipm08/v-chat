import crypto from 'node:crypto';
import os from 'node:os';
import logger from '../utils/logger.js';
import redisClient from '../utils/redis.js';
import { MATCH_QUEUE_KEY, isMatchRoom } from './socketState.js';

const STATS_INSTANCE_PREFIX = 'stats:instance:';
const STATS_SYNC_INTERVAL_MS = 15_000;
const STATS_TTL_SECONDS = 45;

const instanceId = `${os.hostname()}-${process.pid}-${crypto.randomUUID()}`;

const onlineUserSocketCounts = new Map();
const waitingUserIds = new Set();
const inCallUserIds = new Set();

let activeIo = null;
let cachedGlobalStats = { online: 0, waiting: 0, active: 0, inCall: 0 };
let syncInterval = null;
let syncInFlight = false;
let hasSyncedOnce = false;

const clampCount = (value) => Math.max(0, Number.parseInt(value ?? 0, 10) || 0);

const getUserId = (socket) => socket.user?._id?.toString?.() ?? null;

const ensureRandomStatsState = (socket) => {
  if (!socket.data) {
    socket.data = {};
  }

  if (!socket.data.randomStats) {
    socket.data.randomStats = {
      active: false,
      waiting: false,
      inCall: false,
    };
  }

  return socket.data.randomStats;
};

const getLocalStatsSnapshot = () => ({
  online: onlineUserSocketCounts.size,
  waiting: waitingUserIds.size,
  active: inCallUserIds.size,
  inCall: inCallUserIds.size,
});

const replaceMapContents = (target, source) => {
  target.clear();
  for (const [key, value] of source.entries()) {
    target.set(key, value);
  }
};

const replaceSetContents = (target, source) => {
  target.clear();
  for (const value of source.values()) {
    target.add(value);
  }
};

const markSocketAsOnline = (socket) => {
  const userId = getUserId(socket);
  if (!userId) {
    return;
  }

  const nextCount = (onlineUserSocketCounts.get(userId) ?? 0) + 1;
  onlineUserSocketCounts.set(userId, nextCount);
};

const markSocketAsOffline = (socket) => {
  const userId = getUserId(socket);
  if (!userId) {
    return;
  }

  const nextCount = (onlineUserSocketCounts.get(userId) ?? 0) - 1;
  if (nextCount > 0) {
    onlineUserSocketCounts.set(userId, nextCount);
  } else {
    onlineUserSocketCounts.delete(userId);
  }

  const randomStats = socket.data?.randomStats;
  if (randomStats) {
    if (randomStats.waiting) {
      waitingUserIds.delete(userId);
    }

    if (randomStats.inCall) {
      inCallUserIds.delete(userId);
    }

    randomStats.active = false;
    randomStats.waiting = false;
    randomStats.inCall = false;
  }
};

const markRandomWaiting = (socket) => {
  const userId = getUserId(socket);
  if (!userId) {
    return;
  }

  const randomStats = ensureRandomStatsState(socket);
  randomStats.active = true;
  randomStats.waiting = true;
  randomStats.inCall = false;

  socket.isWaiting = true;
  socket.inRoom = false;

  waitingUserIds.add(userId);
  inCallUserIds.delete(userId);
};

const markRandomInCall = (socket) => {
  const userId = getUserId(socket);
  if (!userId) {
    return;
  }

  const randomStats = ensureRandomStatsState(socket);
  randomStats.active = true;
  randomStats.waiting = false;
  randomStats.inCall = true;

  socket.isWaiting = false;
  socket.inRoom = true;

  waitingUserIds.delete(userId);
  inCallUserIds.add(userId);
};

const clearRandomMatchStateForSocket = (socket) => {
  const userId = getUserId(socket);
  if (!userId) {
    return;
  }

  const randomStats = ensureRandomStatsState(socket);
  randomStats.active = false;
  randomStats.waiting = false;
  randomStats.inCall = false;

  socket.isWaiting = false;
  socket.inRoom = false;
  socket.currentRoomId = null;

  waitingUserIds.delete(userId);
  inCallUserIds.delete(userId);
};

const clearRandomMatchCallStateForSocket = (socket) => {
  const userId = getUserId(socket);
  if (!userId) {
    return;
  }

  const randomStats = ensureRandomStatsState(socket);
  randomStats.inCall = false;

  socket.inRoom = false;
  socket.currentRoomId = null;

  inCallUserIds.delete(userId);
};

const rebuildLocalStatsFromSockets = (io) => {
  const nextOnlineUsers = new Map();
  const nextWaitingUsers = new Set();
  const nextInCallUsers = new Set();

  for (const socket of io.of('/').sockets.values()) {
    const userId = getUserId(socket);
    if (!userId) {
      continue;
    }

    nextOnlineUsers.set(userId, (nextOnlineUsers.get(userId) ?? 0) + 1);

    const randomStats = socket.data?.randomStats;
    if (!randomStats?.active) {
      continue;
    }

    const isInRandomMatchRoom = Array.from(socket.rooms).some((roomId) => isMatchRoom(roomId));

    if (isInRandomMatchRoom || randomStats.inCall) {
      nextInCallUsers.add(userId);
      continue;
    }

    if (randomStats.waiting) {
      nextWaitingUsers.add(userId);
    }
  }

  replaceMapContents(onlineUserSocketCounts, nextOnlineUsers);
  replaceSetContents(waitingUserIds, nextWaitingUsers);
  replaceSetContents(inCallUserIds, nextInCallUsers);
};

const flushLocalStatsToRedis = async (snapshot) => {
  const key = `${STATS_INSTANCE_PREFIX}${instanceId}`;
  await redisClient.set(
    key,
    JSON.stringify({
      onlineUsers: Array.from(onlineUserSocketCounts.keys()),
      waitingUsers: Array.from(waitingUserIds.values()),
      inCallUsers: Array.from(inCallUserIds.values()),
      counts: snapshot,
      updatedAt: Date.now(),
      instanceId,
    }),
    'EX',
    STATS_TTL_SECONDS
  );
};

const aggregateGlobalStats = async (fallbackSnapshot) => {
  const pattern = `${STATS_INSTANCE_PREFIX}*`;
  const keys = [];
  let cursor = '0';

  do {
    const [nextCursor, batchKeys] = await redisClient.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
    cursor = nextCursor;

    if (batchKeys?.length) {
      keys.push(...batchKeys);
    }
  } while (cursor !== '0');

  if (keys.length === 0) {
    return fallbackSnapshot;
  }

  const values = await redisClient.mget(keys);
  const onlineUsers = new Set();
  const waitingUsers = new Set();
  const inCallUsers = new Set();

  for (const value of values) {
    if (!value) {
      continue;
    }

    try {
      const parsed = JSON.parse(value);

      if (Array.isArray(parsed.onlineUsers)) {
        for (const userId of parsed.onlineUsers) {
          onlineUsers.add(userId);
        }
      } else if (parsed.counts) {
        const legacyKey = parsed.instanceId ?? value;
        logger.warn('[STATS] Legacy online snapshot detected; counts may be temporarily overestimated until all instances refresh');
        for (let index = 0; index < clampCount(parsed.counts.online); index += 1) {
          onlineUsers.add(`${legacyKey}:online:${index}`);
        }
      }

      if (Array.isArray(parsed.waitingUsers)) {
        for (const userId of parsed.waitingUsers) {
          waitingUsers.add(userId);
        }
      } else if (parsed.counts) {
        const legacyKey = parsed.instanceId ?? value;
        for (let index = 0; index < clampCount(parsed.counts.waiting); index += 1) {
          waitingUsers.add(`${legacyKey}:waiting:${index}`);
        }
      }

      if (Array.isArray(parsed.inCallUsers)) {
        for (const userId of parsed.inCallUsers) {
          inCallUsers.add(userId);
        }
      } else if (parsed.counts) {
        const legacyKey = parsed.instanceId ?? value;
        const fallbackActive = clampCount(parsed.counts.active ?? parsed.counts.inCall);
        for (let index = 0; index < fallbackActive; index += 1) {
          inCallUsers.add(`${legacyKey}:inCall:${index}`);
        }
      }
    } catch (err) {
      logger.warn({ err, value }, '[STATS] Skipping malformed per-instance stats payload');
    }
  }

  return {
    online: onlineUsers.size,
    waiting: waitingUsers.size,
    active: inCallUsers.size,
    inCall: inCallUsers.size,
  };
};

const syncStats = async () => {
  if (!activeIo || syncInFlight) {
    return;
  }

  syncInFlight = true;

  try {
    rebuildLocalStatsFromSockets(activeIo);

    const localSnapshot = getLocalStatsSnapshot();
    await flushLocalStatsToRedis(localSnapshot);

    cachedGlobalStats = await aggregateGlobalStats({
      ...localSnapshot,
    });
    hasSyncedOnce = true;

    activeIo.emit('stats', cachedGlobalStats);
  } catch (err) {
    const fallbackSnapshot = getLocalStatsSnapshot();
    cachedGlobalStats = { ...fallbackSnapshot };
    hasSyncedOnce = true;

    if (activeIo) {
      activeIo.emit('stats', cachedGlobalStats);
    }

    logger.error({ err, instanceId }, '[STATS] Failed to sync live stats');
  } finally {
    syncInFlight = false;
  }
};

export const setupStatsSync = (io) => {
  activeIo = io;

  if (syncInterval) {
    clearInterval(syncInterval);
  }

  void syncStats();

  syncInterval = setInterval(() => {
    void syncStats();
  }, STATS_SYNC_INTERVAL_MS);

  syncInterval.unref?.();

  logger.info({ instanceId, syncIntervalMs: STATS_SYNC_INTERVAL_MS }, '[STATS] In-memory stats service initialized');
};

export const registerOnlineUser = (socket) => {
  markSocketAsOnline(socket);
};

export const unregisterOnlineUser = (socket) => {
  markSocketAsOffline(socket);
};

export const markRandomMatchWaiting = (socket) => {
  markRandomWaiting(socket);
};

export const markRandomMatchInCall = (socket) => {
  markRandomInCall(socket);
};

export const clearRandomMatchState = (socket) => {
  clearRandomMatchStateForSocket(socket);
};

export const clearRandomMatchCallState = (socket) => {
  clearRandomMatchCallStateForSocket(socket);
};

export const emitInitialStats = (socket) => {
  if (!hasSyncedOnce) {
    socket.emit('stats', getLocalStatsSnapshot());
    return;
  }

  socket.emit('stats', cachedGlobalStats);
};

export const getStats = async () => cachedGlobalStats;

export const resetVolatileStats = async () => {
  try {
    logger.warn('[STATS] Resetting volatile stats state');

    onlineUserSocketCounts.clear();
    waitingUserIds.clear();
    inCallUserIds.clear();
    cachedGlobalStats = { online: 0, waiting: 0, active: 0, inCall: 0 };
    hasSyncedOnce = false;

    const pattern = `${STATS_INSTANCE_PREFIX}*`;
    let cursor = '0';
    const keys = [];

    do {
      const [nextCursor, batchKeys] = await redisClient.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;

      if (batchKeys?.length) {
        keys.push(...batchKeys);
      }
    } while (cursor !== '0');

    if (keys.length > 0) {
      await redisClient.del(...keys);
    }

    await redisClient.del(MATCH_QUEUE_KEY);
    await redisClient.del('active_matches');

    logger.info('[STATS] Volatile stats reset complete');
    return true;
  } catch (err) {
    logger.error({ err }, '[STATS] Failed to reset volatile stats');
    return false;
  }
};
