import { z } from 'zod';

export const registerSchema = z.object({
  body: z.object({
    username: z.string().min(3, "Username must be at least 3 characters").max(30),
    email: z.string().email("Invalid email").transform(v => v.toLowerCase()),
    password: z.string().min(6, "Password must be at least 6 characters")
  })
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email").transform(v => v.toLowerCase()),
    password: z.string().min(1, "Password is required")
  })
});

export const createRoomSchema = z.object({
  body: z.object({
    roomId: z.string().optional(),
    maxParticipants: z.number().min(2).max(4).optional()
  })
});
