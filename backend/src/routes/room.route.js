import express from 'express';
import { createRoom, getIceServers, verifyRoom } from '../controllers/room.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createRoomSchema } from '../utils/validationSchemas.js';

const router = express.Router();

router.use(requireAuth);
router.post('/create', validate(createRoomSchema), createRoom);
router.get('/verify/:roomId', verifyRoom);
router.get('/ice-servers', getIceServers);

export default router;
