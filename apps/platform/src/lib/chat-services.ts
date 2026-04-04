// Re-export chat and connect services for CRM pages that used shared packages
// These services are now local to the platform app

export { sseManager } from './services/chat/sse.service'

// Chat services are accessed directly via @/lib/services/chat/*
// Connect services are accessed directly via @/lib/services/connect/*
// CRM pages should import from the service files directly
