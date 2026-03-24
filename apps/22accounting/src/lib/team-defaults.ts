export type { WorkspacePermissions } from './auth';
import type { WorkspacePermissions } from './auth';

export const DEFAULT_PERMISSIONS: WorkspacePermissions = {
  invoices:  { view: true,  create: false, delete: false },
  bills:     { view: true,  create: false, delete: false },
  banking:   { view: true,  reconcile: false },
  reports:   { view: true },
  settings:  { view: false },
  customers: { view: true,  manage: false },
};
