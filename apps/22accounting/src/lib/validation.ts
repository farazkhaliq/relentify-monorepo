import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email(), password: z.string().min(8),
  fullName: z.string().min(2), businessName: z.string().optional(),
  userType: z.enum(['sole_trader','small_business','medium','corporate','accountant']).default('sole_trader'),
});

export const loginSchema = z.object({
  email: z.string().email(), password: z.string().min(1),
});

export const invoiceSchema = z.object({
  customerId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  clientName: z.string().optional().default(''),
  clientEmail: z.string().email().optional().or(z.literal('')),
  clientAddress: z.string().optional(),
  issueDate: z.string().optional(),
  dueDate: z.string().min(1),
  taxRate: z.number().min(0).max(100).default(0),
  paymentTerms: z.string().optional().default('net_30'),
  notes: z.string().optional(),
  terms: z.string().optional(),
  currency: z.string().default('GBP'),
  items: z.array(z.object({
    description: z.string().min(1),
    quantity: z.number().positive(),
    unitPrice: z.number().min(0),
    taxRate: z.number().min(0).max(100).default(0),
  })).min(1),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type InvoiceInput = z.infer<typeof invoiceSchema>;