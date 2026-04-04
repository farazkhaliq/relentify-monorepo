// DB row shape (snake_case)
export interface InventoryRow {
  id: string
  user_id: string
  property_address: string
  type: string
  created_at: Date
  created_by: string
  notes: string | null
  tenant_confirmed: boolean
  confirmed_at: Date | null
  confirmed_ip: string | null
  confirm_token: string
  tenant_email: string | null
  email_sent_at: Date | null
  signing_request_id: string | null
  tenant_signature_data: string | null
}

// API response shape (camelCase, matches existing frontend)
export interface Inventory {
  id: string
  userId: string
  propertyAddress: string
  type: string
  createdAt: Date
  createdBy: string
  notes: string | null
  tenantConfirmed: boolean
  confirmedAt: Date | null
  confirmedIp: string | null
  confirmToken: string
  tenantEmail: string | null
  emailSentAt: Date | null
  signingRequestId: string | null
  tenantSignatureData: string | null
}

export function toInventory(row: InventoryRow): Inventory {
  return {
    id: row.id,
    userId: row.user_id,
    propertyAddress: row.property_address,
    type: row.type,
    createdAt: row.created_at,
    createdBy: row.created_by,
    notes: row.notes,
    tenantConfirmed: row.tenant_confirmed,
    confirmedAt: row.confirmed_at,
    confirmedIp: row.confirmed_ip,
    confirmToken: row.confirm_token,
    tenantEmail: row.tenant_email,
    emailSentAt: row.email_sent_at,
    signingRequestId: row.signing_request_id,
    tenantSignatureData: row.tenant_signature_data,
  }
}

export interface PhotoRow {
  id: string
  inventory_id: string
  room: string
  description: string | null
  condition: string
  image_data: string | null
  uploaded_at: Date
}

export interface Photo {
  id: string
  inventoryId: string
  room: string
  description: string | null
  condition: string
  imageData: string | null
  uploadedAt: Date
}

export function toPhoto(row: PhotoRow): Photo {
  return {
    id: row.id,
    inventoryId: row.inventory_id,
    room: row.room,
    description: row.description,
    condition: row.condition,
    imageData: row.image_data,
    uploadedAt: row.uploaded_at,
  }
}

export interface InventoryWithPhotos extends Inventory {
  photos: Photo[]
}
