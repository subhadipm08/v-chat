import express from 'express';
import { createRoom, getIceServers } from '../controllers/room.controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.use(requireAuth);
router.post('/create', createRoom);
router.get('/ice-servers', getIceServers);

export default router;
