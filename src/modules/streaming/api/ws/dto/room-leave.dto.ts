import { z } from 'zod';

export const RoomLeaveSchema = z.object({ sessionId: z.string().min(1) });
export type RoomLeaveDto = z.infer<typeof RoomLeaveSchema>;
