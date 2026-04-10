import redisClient, { pubClient, subClient } from '../utils/redis.js';
import logger from '../utils/logger.js';
import crypto from 'node:crypto';
import os from 'node:os';
import { MATCH_QUEUE_KEY } from './socketState.js';

const STATS_ONLINE_KEY = 'stats:online';
const STATS_WAITING_KEY = 'stats:waiting';
const STATS_ACTIVE_ROOMS_KEY = 'stats:activeRooms';
const STATS_CHANNEL = 'stats:updates';
const ROOM_COUNT_PREFIX = 'room_count:';

// Guaranteed unique per machine and per process
const instanceId = `${os.hostname()}-${process.pid}-${crypto.randomUUID()}`;

// Local cache to minimize Redis read costs
let localStats = { online: 0, waiting: 0, active: 0 };

// Helper to ensure values never drift below zero
const clamp = (val) => Math.max(0, parseInt(val || 0, 10));

const updateLocalStats = (key, delta) => {
  const statKey = key.replace('stats:', '');
  if (statKey in localStats) {
    localStats[statKey] = clamp(localStats[statKey] + delta);
  }
};

export const updateStat = async (io, key, delta) => {
  try {
    const newVal = await redisClient.incrby(key, delta);
    
    // Update local copy immediately for "self" server
    updateLocalStats(key, delta);
    
    // Publish to other instances
    await pubClient.publish(STATS_CHANNEL, JSON.stringify({
      instanceId,
      key,
      delta
    }));

    if (newVal < 0) {
      await redisClient.set(key, 0);
    }
  } catch (err) {
    logger.error({ err, key, delta }, 'Error updating stat in Redis/PubSub');
  }
};

export const getStats = async () => {
  try {
    const [online, waiting, active] = await Promise.all([
      redisClient.get(STATS_ONLINE_KEY),
      redisClient.get(STATS_WAITING_KEY),
      redisClient.get(STATS_ACTIVE_ROOMS_KEY),
    ]);

    return {
      online: parseInt(online || 0, 10),
      waiting: parseInt(waiting || 0, 10),
      active: parseInt(active || 0, 10),
    };
  } catch (err) {
    logger.error({ err }, 'Error fetching stats from Redis');
    return { online: 0, waiting: 0, active: 0 };
  }
};

export const setupStatsSync = (io) => {
  // 1. Initial Load from Redis
  getStats().then(stats => {
    localStats = stats;
    logger.info({ localStats, instanceId }, 'Stats Service Initialized');
  });

  // 2. Listen for updates from other instances
  subClient.subscribe(STATS_CHANNEL);
  subClient.on('message', (channel, message) => {
    if (channel !== STATS_CHANNEL) return;
    
    try {
      const { instanceId: senderId, key, delta } = JSON.parse(message);
      
      // Safeguard: Ignore updates from ourselves to avoid double counting
      if (senderId === instanceId) return;

      updateLocalStats(key, delta);
    } catch (err) {
      logger.error({ err, message }, 'Failed to parse stats PubSub message');
    }
  });

  // 3. Periodic UI Broadcast (Throttled to 10s)
  setInterval(() => {
    io.emit('stats', localStats);
  }, 10000);

  // 4. Periodic Drift Correction (Re-sync from Redis every 60s)
  setInterval(async () => {
    const freshStats = await getStats();
    localStats = freshStats;
  }, 60000);
};

export const updateOnlineUsers = (io, delta) => {
  updateStat(io, STATS_ONLINE_KEY, delta);
};

export const updateWaitingUsers = (io, delta) => {
  updateStat(io, STATS_WAITING_KEY, delta);
};

export const updateActiveRooms = (io, delta) => {
  updateStat(io, STATS_ACTIVE_ROOMS_KEY, delta);
};

export const handleRoomJoin = async (io, roomId) => {
  const key = `${ROOM_COUNT_PREFIX}${roomId}`;
  const count = await redisClient.incr(key);
  
  if (count === 2) {
    // Room just became active (2 participants)
    await updateActiveRooms(io, 1);
  }
  
  // Set TTL to prevent leaks if something goes wrong (e.g., 24h)
  await redisClient.expire(key, 86400);
  return count;
};

export const handleRoomLeave = async (io, roomId) => {
  const key = `${ROOM_COUNT_PREFIX}${roomId}`;
  const count = await redisClient.decr(key);
  
  if (count === 1) {
    // Room just became inactive (only 1 participant left)
    await updateActiveRooms(io, -1);
  } else if (count <= 0) {
    // Clean up empty room counters
    await redisClient.del(key);
  }
  
  return count > 0 ? count : 0;
};

export const emitInitialStats = (socket) => {
  socket.emit('stats', localStats);
};

// Reset metrics that shouldn't persist across full system restarts (Maintenance Only)
export const resetVolatileStats = async () => {
  try {
    logger.warn('[STATS] Performing a full volatile stats reset...');
    
    // 1. Reset global counters
    await Promise.all([
      redisClient.set(STATS_ONLINE_KEY, 0),
      redisClient.set(STATS_WAITING_KEY, 0),
      redisClient.set(STATS_ACTIVE_ROOMS_KEY, 0)
    ]);

    // 2. Clear ephemeral matchmaking structures
    // (Socket-based IDs are invalid after a restart)
    await redisClient.del(MATCH_QUEUE_KEY); 
    await redisClient.del('active_matches');
    
    // 3. Clear all temporary room participant counters
    const keys = await redisClient.keys(`${ROOM_COUNT_PREFIX}*`);
    if (keys.length > 0) {
      await redisClient.del(...keys);
    }

    logger.info('[STATS] Volatile stats and ephemeral data cleared successfully.');
    return true;
  } catch (err) {
    logger.error({ err }, '[STATS] Failed to reset volatile stats');
    return false;
  }
};
