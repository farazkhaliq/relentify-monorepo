import pool from './pool'
import { createSessionService, createMessageService, createConfigService, SSEManager } from '@relentify/chat'
import { createConversationService, createConnectMessageService } from '@relentify/connect'

// Chat (29chat) service instances
export const chatSessionService = createSessionService(pool)
export const chatMessageService = createMessageService(pool)
export const chatConfigService = createConfigService(pool)

// Connect (30connect) service instances
export const conversationService = createConversationService(pool)
export const connectMessageService = createConnectMessageService(pool)

// Shared SSE manager for CRM
export const sseManager = new SSEManager()
