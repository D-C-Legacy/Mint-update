import { z } from 'zod';

export const HeartbeatSchema = z.object({ sessionId: z.string().min(1) });
export type HeartbeatDto = z.infer<typeof HeartbeatSchema>;
