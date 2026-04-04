type Controller = ReadableStreamDefaultController

export class SSEManager {
  private sessions = new Map<string, Set<Controller>>()
  private entities = new Map<string, Set<Controller>>()

  constructor() {
    setInterval(() => {
      const encoder = new TextEncoder()
      const keepalive = encoder.encode(': keepalive\n\n')
      for (const ctrls of this.sessions.values()) for (const c of ctrls) { try { c.enqueue(keepalive) } catch {} }
      for (const ctrls of this.entities.values()) for (const c of ctrls) { try { c.enqueue(keepalive) } catch {} }
    }, 30_000)
  }

  addConnection(id: string, ctrl: Controller) { if (!this.sessions.has(id)) this.sessions.set(id, new Set()); this.sessions.get(id)!.add(ctrl) }
  removeConnection(id: string, ctrl: Controller) { const s = this.sessions.get(id); if (s) { s.delete(ctrl); if (!s.size) this.sessions.delete(id) } }
  addEntityConnection(id: string, ctrl: Controller) { if (!this.entities.has(id)) this.entities.set(id, new Set()); this.entities.get(id)!.add(ctrl) }
  removeEntityConnection(id: string, ctrl: Controller) { const s = this.entities.get(id); if (s) { s.delete(ctrl); if (!s.size) this.entities.delete(id) } }

  broadcast(id: string, event: string, data: any) {
    const set = this.sessions.get(id); if (!set) return
    const p = new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    for (const c of set) { try { c.enqueue(p) } catch {} }
  }

  broadcastEntity(id: string, event: string, data: any) {
    const set = this.entities.get(id); if (!set) return
    const p = new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    for (const c of set) { try { c.enqueue(p) } catch {} }
  }
}
