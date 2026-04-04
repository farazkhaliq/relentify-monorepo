// Service factories
export { createConversationService } from './services/conversation.service'
export { createConnectMessageService } from './services/connect-message.service'

// Types
export type { Conversation } from './services/conversation.service'
export type { ConnectMessage } from './services/connect-message.service'

// Re-export chat for convenience
export * from '@relentify/chat'
