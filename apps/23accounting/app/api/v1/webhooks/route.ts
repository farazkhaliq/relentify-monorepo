import { NextRequest } from 'next/server';
import { requireApiKeyContext, requireScope, apiSuccess, apiError } from '@/src/lib/v1-helpers';
import { listWebhookEndpoints, createWebhookEndpoint, ALL_WEBHOOK_EVENTS } from '@/src/lib/webhook.service';

export async function GET(req: NextRequest) {
  const result = await requireApiKeyContext(req);
  if ('status' in result) return result;
  const { ctx } = result;
  const scopeErr = requireScope(ctx, 'webhooks:manage');
  if (scopeErr) return scopeErr;
  const endpoints = await listWebhookEndpoints(ctx.entityId);
  return apiSuccess(endpoints);
}

export async function POST(req: NextRequest) {
  const result = await requireApiKeyContext(req);
  if ('status' in result) return result;
  const { ctx } = result;
  const scopeErr = requireScope(ctx, 'webhooks:manage');
  if (scopeErr) return scopeErr;
  const body = await req.json();
  const { url, events } = body;
  if (!url || typeof url !== 'string') return apiError('validation_error', 'url is required', 400);
  if (!Array.isArray(events) || events.length === 0) return apiError('validation_error', 'events array is required', 400);
  const invalidEvents = events.filter((e: string) => !ALL_WEBHOOK_EVENTS.includes(e));
  if (invalidEvents.length > 0) return apiError('validation_error', `Unknown events: ${invalidEvents.join(', ')}`, 400);
  const { secret, endpoint } = await createWebhookEndpoint({ entityId: ctx.entityId, url, events });
  // Secret shown once -- include in creation response
  return apiSuccess({ ...endpoint, secret }, { status: 201 });
}
