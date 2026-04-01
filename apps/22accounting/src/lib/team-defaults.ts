export type { WorkspacePermissions } from './auth';
import type { WorkspacePermissions } from './auth';

export const DEFAULT_PERMISSIONS: WorkspacePermissions = {
  invoices:    { view: true,  create: false, delete: false },
  bills:       { view: true,  create: false, delete: false },
  banking:     { view: true,  reconcile: false },
  reports:     { view: true },
  settings:    { view: false },
  customers:   { view: true,  manage: false },
  suppliers:   { view: true,  manage: false },
  expenses:    { view: true,  create: false, approve: false },
  quotes:      { view: true,  create: false },
  creditNotes: { view: true,  create: false },
  journals:    { view: true,  create: false },
  po:          { view: true,  create: false, approve: false },
  projects:    { view: true,  manage: false },
  mileage:     { view: true,  create: false, approve: false },
  vat:         { view: true,  submit: false },
  coa:         { view: true,  manage: false },
  audit:       { view: true },
  entities:    { view: true,  manage: false },
};
