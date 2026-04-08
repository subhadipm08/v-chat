import { Room } from '../models/room.model.js';
import { nanoid } from 'nanoid';

export const verifyRoom = async (req, res) => {
  try {
    const room = await Room.findOne({ roomId: req.params.roomId });
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    res.json({ valid: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to verify room' });
  }
};

export const createRoom = async (req, res) => {
  try {
    const roomId = req.body.roomId ||nanoid(8);
    const maxParticipants = req.body.maxParticipants || 5;

    const newRoom = new Room({
      roomId,
      type: 'PRIVATE',
      createdBy: req.user._id,
      maxParticipants
    });

    await newRoom.save();
    res.status(201).json({ room: newRoom });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create room' });
  }
};

export const getIceServers = async (req, res) => {
  // If TURN credentials are provided in env, return them. Ensure TTL
  // We'll mock standard structure with public STUN.
  const iceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ];

  /* 
   * For production TURN like CoTurn or Twilio
   * if (process.env.TURN_URL) {
   *   iceServers.push({
   *      urls: process.env.TURN_URL,
   *      username: process.env.TURN_USERNAME,
   *      credential: process.env.TURN_CREDENTIAL
   *   })
   * }
   */

  res.json({ iceServers });
};
