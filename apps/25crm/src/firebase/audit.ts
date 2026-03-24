'use client';

import { Auth } from 'firebase/auth';
import { Firestore, collection, serverTimestamp, addDoc, DocumentReference, CollectionReference } from 'firebase/firestore';

function getEntityTypeFromPath(path: string): string {
  const parts = path.split('/');
  // For a doc path: /organizations/{orgId}/contacts/{contactId}, the collection is at index length - 2
  // For a collection path: /organizations/{orgId}/contacts, the collection is at index length - 1
  const collectionName = parts.length % 2 === 0 ? parts[parts.length - 2] : parts[parts.length - 1];

  switch (collectionName) {
    case 'contacts': return 'Contact';
    case 'properties': return 'Property';
    case 'tenancies': return 'Tenancy';
    case 'maintenanceRequests': return 'MaintenanceRequest';
    case 'tasks': return 'Task';
    case 'communications': return 'Communication';
    case 'userProfiles': return 'UserProfile';
    case 'auditLogs': return 'AuditLog';
    case 'inventoryItems': return 'InventoryItem';
    case 'documents': return 'Document';
    case 'transactions': return 'Transaction';
    case 'workflowRules': return 'WorkflowRule';
    default:
        const capitalized = collectionName.charAt(0).toUpperCase() + collectionName.slice(1);
        return capitalized;
  }
}

export const logAuditEvent = (
    firestore: Firestore,
    auth: Auth,
    organizationId: string,
    action: 'Created' | 'Updated' | 'Deleted',
    ref: DocumentReference | CollectionReference,
    entityName?: string,
    createdDocId?: string
) => {
    if (!auth.currentUser) {
        console.error("Cannot log audit event: user not authenticated.");
        return;
    }

    const auditLogRef = collection(firestore, `organizations/${organizationId}/auditLogs`);
    const entityType = getEntityTypeFromPath(ref.path);
    const entityId = createdDocId || (ref as DocumentReference).id;
    
    if (!entityId) {
        console.error("Cannot log audit event: entityId is missing.");
        return;
    }

    const logData = {
        organizationId,
        timestamp: serverTimestamp(),
        userId: auth.currentUser.uid,
        action: action,
        entityType: entityType,
        entityId: entityId,
        entityName: entityName || '',
        details: `${action} a ${entityType}`
    };

    // Fire-and-forget
    addDoc(auditLogRef, logData).catch(err => {
        console.error("Failed to write audit log:", err);
    });
};
