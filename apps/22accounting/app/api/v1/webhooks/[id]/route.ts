import { NextRequest } from 'next/server';
import { requireApiKeyContext, requireScope, apiSuccess, apiError } from '@/src/lib/v1-helpers';
import { deleteWebhookEndpoint, retryDeadLettered } from '@/src/lib/webhook.service';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = await requireApiKeyContext(req);
  if ('status' in result) return result;
  const { ctx } = result;
  const scopeErr = requireScope(ctx, 'webhooks:manage');
  if (scopeErr) return scopeErr;
  const { id } = await params;
  const deleted = await deleteWebhookEndpoint(id, ctx.entityId);
  if (!deleted) return apiError('not_found', 'Webhook endpoint not found', 404);
  return apiSuccess({ deleted: true });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // POST /api/v1/webhooks/:deliveryId/retry -- manually retry dead-lettered delivery
  const result = await requireApiKeyContext(req);
  if ('status' in result) return result;
  const { ctx } = result;
  const scopeErr = requireScope(ctx, 'webhooks:manage');
  if (scopeErr) return scopeErr;
  const { id } = await params;
  const ok = await retryDeadLettered(id, ctx.entityId);
  if (!ok) return apiError('not_found', 'Dead-lettered delivery not found', 404);
  return apiSuccess({ retrying: true });
}
