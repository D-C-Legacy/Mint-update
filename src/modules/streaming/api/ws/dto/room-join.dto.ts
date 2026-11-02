import { z } from 'zod';

export const RoomJoinSchema = z.object({ sessionId: z.string().min(1) });
export type RoomJoinDto = z.infer<typeof RoomJoinSchema>;
