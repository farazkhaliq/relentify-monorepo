'use client';
    
import {
  addDoc,
  updateDoc,
  deleteDoc,
  CollectionReference,
  DocumentReference,
  Firestore,
  Auth
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import {FirestorePermissionError} from '@/firebase/errors';
import { logAuditEvent } from './audit';


/**
 * Initiates an addDoc operation for a collection reference and logs an audit event.
 * Does NOT await the write operation internally.
 * Returns the Promise for the new doc ref, but typically not awaited by caller.
 */
export function addDocumentNonBlocking(
  firestore: Firestore,
  auth: Auth,
  organizationId: string,
  colRef: CollectionReference,
  data: any,
  entityName?: string
) {
  const promise = addDoc(colRef, data)
    .then(docRef => {
      logAuditEvent(firestore, auth, organizationId, 'Created', docRef, entityName, docRef.id);
      return docRef;
    })
    .catch(error => {
      errorEmitter.emit(
        'permission-error',
        new FirestorePermissionError({
          path: colRef.path,
          operation: 'create',
          requestResourceData: data,
        })
      )
    });
  return promise;
}


/**
 * Initiates an updateDoc operation for a document reference and logs an audit event.
 * Does NOT await the write operation internally.
 */
export function updateDocumentNonBlocking(
  firestore: Firestore,
  auth: Auth,
  organizationId: string,
  docRef: DocumentReference,
  data: any,
  entityName?: string
) {
  updateDoc(docRef, data)
    .then(() => {
        logAuditEvent(firestore, auth, organizationId, 'Updated', docRef, entityName);
    })
    .catch(error => {
      errorEmitter.emit(
        'permission-error',
        new FirestorePermissionError({
          path: docRef.path,
          operation: 'update',
          requestResourceData: data,
        })
      )
    });
}

/**
 * Initiates a deleteDoc operation for a document reference and logs an audit event.
 * Does NOT await the write operation internally.
 */
export function deleteDocumentNonBlocking(
  firestore: Firestore,
  auth: Auth,
  organizationId: string,
  docRef: DocumentReference,
  entityName?: string
) {
  deleteDoc(docRef)
    .then(() => {
        logAuditEvent(firestore, auth, organizationId, 'Deleted', docRef, entityName);
    })
    .catch(error => {
      errorEmitter.emit(
        'permission-error',
        new FirestorePermissionError({
          path: docRef.path,
          operation: 'delete',
        })
      )
    });
}
