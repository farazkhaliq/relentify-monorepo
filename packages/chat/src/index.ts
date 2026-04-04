// Service factories
export { createSessionService } from './services/session.service'
export { createMessageService } from './services/message.service'
export { createConfigService } from './services/config.service'
export { SSEManager } from './services/sse.service'

// Types
export type { ChatSession, ChatMessage, ChatVisitor, ChatConfig, Pool } from './types'
