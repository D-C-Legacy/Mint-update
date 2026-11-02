import { z } from 'zod';

export const ListUsersQuerySchema = z.object({
  q: z.string().optional(), // search by email, displayName, userId
  status: z.enum(['ACTIVE', 'SUSPENDED', 'DELETED']).optional(),
  platform: z.enum(['IOS', 'ANDROID', 'WEB', 'UNKNOWN']).optional(), // derived from most recent device
  role: z.enum(['BUYER', 'SELLER', 'ADMIN']).optional(),
  hasSupportTickets: z.coerce.boolean().optional(), // placeholder for future support ticket integration
  supportCategory: z.enum(['BILLING', 'STREAMING', 'ORDERS', 'ACCOUNT', 'OTHER']).optional(), // support ticket category
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export type ListUsersQueryDto = z.infer<typeof ListUsersQuerySchema>;
