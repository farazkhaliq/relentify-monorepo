type Controller = ReadableStreamDefaultController

class SSEManager {
  // Session-level connections (session ID → controllers)
  private sessions = new Map<string, Set<Controller>>()
  // Entity-level connections (entity ID → controllers) for dashboard events
  private entities = new Map<string, Set<Controller>>()

  constructor() {
    // Keepalive every 30s to prevent proxy/browser timeout
    setInterval(() => {
      const encoder = new TextEncoder()
      const keepalive = encoder.encode(': keepalive\n\n')
      for (const controllers of this.sessions.values()) {
        for (const ctrl of controllers) {
          try { ctrl.enqueue(keepalive) } catch { /* closed */ }
        }
      }
      for (const controllers of this.entities.values()) {
        for (const ctrl of controllers) {
          try { ctrl.enqueue(keepalive) } catch { /* closed */ }
        }
      }
    }, 30_000)
  }

  addConnection(sessionId: string, controller: Controller) {
    if (!this.sessions.has(sessionId)) this.sessions.set(sessionId, new Set())
    this.sessions.get(sessionId)!.add(controller)
  }

  removeConnection(sessionId: string, controller: Controller) {
    const set = this.sessions.get(sessionId)
    if (set) {
      set.delete(controller)
      if (set.size === 0) this.sessions.delete(sessionId)
    }
  }

  addEntityConnection(entityId: string, controller: Controller) {
    if (!this.entities.has(entityId)) this.entities.set(entityId, new Set())
    this.entities.get(entityId)!.add(controller)
  }

  removeEntityConnection(entityId: string, controller: Controller) {
    const set = this.entities.get(entityId)
    if (set) {
      set.delete(controller)
      if (set.size === 0) this.entities.delete(entityId)
    }
  }

  /** Broadcast to all connections listening on a specific session */
  broadcast(sessionId: string, event: string, data: any) {
    const set = this.sessions.get(sessionId)
    if (!set || set.size === 0) return

    const encoder = new TextEncoder()
    const payload = encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)

    for (const ctrl of set) {
      try { ctrl.enqueue(payload) } catch { /* closed, cleanup will handle */ }
    }
  }

  /** Broadcast to all entity-level connections (dashboard events) */
  broadcastEntity(entityId: string, event: string, data: any) {
    const set = this.entities.get(entityId)
    if (!set || set.size === 0) return

    const encoder = new TextEncoder()
    const payload = encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)

    for (const ctrl of set) {
      try { ctrl.enqueue(payload) } catch { /* closed */ }
    }
  }

  getSessionConnectionCount(sessionId: string): number {
    return this.sessions.get(sessionId)?.size || 0
  }

  getEntityConnectionCount(entityId: string): number {
    return this.entities.get(entityId)?.size || 0
  }
}

// Singleton
export const sseManager = new SSEManager()
