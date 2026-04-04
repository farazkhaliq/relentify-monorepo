import { NextRequest } from 'next/server'
import { corsHeaders } from '@/lib/cors'
import { sseManager } from '@/lib/services/chat/sse.service'

export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders })
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(': keepalive\n\n'))
      sseManager.addConnection(id, controller)
      req.signal.addEventListener('abort', () => {
        sseManager.removeConnection(id, controller)
      })
    },
  })

  return new Response(stream, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
