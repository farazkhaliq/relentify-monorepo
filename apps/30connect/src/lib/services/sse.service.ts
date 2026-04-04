type Controller = ReadableStreamDefaultController

class SSEManager {
  private conversations = new Map<string, Set<Controller>>()
  private entities = new Map<string, Set<Controller>>()

  constructor() {
    setInterval(() => {
      const encoder = new TextEncoder()
      const keepalive = encoder.encode(': keepalive\n\n')
      for (const controllers of this.conversations.values()) {
        for (const ctrl of controllers) { try { ctrl.enqueue(keepalive) } catch {} }
      }
      for (const controllers of this.entities.values()) {
        for (const ctrl of controllers) { try { ctrl.enqueue(keepalive) } catch {} }
      }
    }, 30_000)
  }

  addConnection(convId: string, controller: Controller) {
    if (!this.conversations.has(convId)) this.conversations.set(convId, new Set())
    this.conversations.get(convId)!.add(controller)
  }

  removeConnection(convId: string, controller: Controller) {
    const set = this.conversations.get(convId)
    if (set) { set.delete(controller); if (set.size === 0) this.conversations.delete(convId) }
  }

  addEntityConnection(entityId: string, controller: Controller) {
    if (!this.entities.has(entityId)) this.entities.set(entityId, new Set())
    this.entities.get(entityId)!.add(controller)
  }

  removeEntityConnection(entityId: string, controller: Controller) {
    const set = this.entities.get(entityId)
    if (set) { set.delete(controller); if (set.size === 0) this.entities.delete(entityId) }
  }

  broadcast(convId: string, event: string, data: any) {
    const set = this.conversations.get(convId)
    if (!set) return
    const encoder = new TextEncoder()
    const payload = encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    for (const ctrl of set) { try { ctrl.enqueue(payload) } catch {} }
  }

  broadcastEntity(entityId: string, event: string, data: any) {
    const set = this.entities.get(entityId)
    if (!set) return
    const encoder = new TextEncoder()
    const payload = encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    for (const ctrl of set) { try { ctrl.enqueue(payload) } catch {} }
  }
}

export const sseManager = new SSEManager()
