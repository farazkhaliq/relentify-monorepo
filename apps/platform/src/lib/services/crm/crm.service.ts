import pool from '../../pool';

// --- Types ---

export interface Contact {
  id: string;
  entity_id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  contact_type: 'Lead' | 'Tenant' | 'Landlord' | 'Contractor' | 'Guarantor';
  status: 'Active' | 'Inactive' | 'Archived';
  notes?: string;
  created_at: Date;
  updated_at: Date;
}

export interface Property {
  id: string;
  entity_id: string;
  user_id: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  postcode: string;
  property_type?: string;
  rent_amount: number;
  status: string;
  notes?: string;
  number_of_bedrooms: number;
  number_of_bathrooms: number;
  description?: string;
  created_at: Date;
  updated_at: Date;
}

export interface Tenancy {
  id: string;
  entity_id: string;
  user_id: string;
  property_id: string;
  start_date: Date;
  end_date?: Date;
  rent_amount: number;
  deposit_amount?: number;
  status: 'Active' | 'Ended' | 'Arrears' | 'Pending' | 'Draft';
  pipeline_status?: string;
  created_at: Date;
  updated_at: Date;
  // Joined fields
  property_address?: string;
  tenant_names?: string[];
  tenant_ids?: string[];
}

// --- Contacts Service ---

export async function getAllContacts(entityId: string): Promise<Contact[]> {
  const { rows } = await pool.query(
    'SELECT * FROM crm_contacts WHERE entity_id = $1 ORDER BY last_name ASC, first_name ASC',
    [entityId]
  );
  return rows;
}

export async function getContactById(id: string, entityId: string): Promise<Contact | null> {
  const { rows } = await pool.query(
    'SELECT * FROM crm_contacts WHERE id = $1 AND entity_id = $2',
    [id, entityId]
  );
  return rows[0] || null;
}

// --- Properties Service --- (Extended from property.service.ts)

export async function getAllProperties(entityId: string): Promise<Property[]> {
  const { rows } = await pool.query(
    'SELECT * FROM crm_properties WHERE entity_id = $1 ORDER BY created_at DESC',
    [entityId]
  );
  return rows;
}

export async function getPropertyById(id: string, entityId: string): Promise<Property | null> {
  const { rows } = await pool.query(
    'SELECT * FROM crm_properties WHERE id = $1 AND entity_id = $2',
    [id, entityId]
  );
  return rows[0] || null;
}

// --- Tenancies Service ---

export async function getAllTenancies(entityId: string): Promise<Tenancy[]> {
  const { rows } = await pool.query(
    `SELECT t.*, p.address_line1 as property_address,
     ARRAY(SELECT c.first_name || ' ' || c.last_name 
           FROM crm_tenancy_tenants tt 
           JOIN crm_contacts c ON tt.contact_id = c.id 
           WHERE tt.tenancy_id = t.id) as tenant_names,
     ARRAY(SELECT tt.contact_id FROM crm_tenancy_tenants tt WHERE tt.tenancy_id = t.id) as tenant_ids
     FROM crm_tenancies t
     LEFT JOIN crm_properties p ON t.property_id = p.id
     WHERE t.entity_id = $1 
     ORDER BY t.start_date DESC`,
    [entityId]
  );
  return rows;
}

export async function getTenancyById(id: string, entityId: string): Promise<Tenancy | null> {
  const { rows } = await pool.query(
    `SELECT t.*, p.address_line1 as property_address,
     ARRAY(SELECT c.first_name || ' ' || c.last_name 
           FROM crm_tenancy_tenants tt 
           JOIN crm_contacts c ON tt.contact_id = c.id 
           WHERE tt.tenancy_id = t.id) as tenant_names,
     ARRAY(SELECT tt.contact_id FROM crm_tenancy_tenants tt WHERE tt.tenancy_id = t.id) as tenant_ids
     FROM crm_tenancies t
     LEFT JOIN crm_properties p ON t.property_id = p.id
     WHERE t.id = $1 AND t.entity_id = $2`,
    [id, entityId]
  );
  return rows[0] || null;
}

// --- Recent Activity ---

export async function getRecentActivity(entityId: string) {
  const [leads, arrears] = await Promise.all([
    pool.query(
      "SELECT id, first_name, last_name, created_at FROM crm_contacts WHERE entity_id = $1 AND contact_type = 'Lead' ORDER BY created_at DESC LIMIT 5",
      [entityId]
    ),
    pool.query(
      `SELECT t.id, p.address_line1 as property_address, t.updated_at 
       FROM crm_tenancies t
       JOIN crm_properties p ON t.property_id = p.id
       WHERE t.entity_id = $1 AND t.status = 'Arrears' 
       ORDER BY t.updated_at DESC LIMIT 5`,
      [entityId]
    ),
  ]);

  const activities = [
    ...leads.rows.map(l => ({
      id: l.id,
      type: 'lead',
      title: `New lead: ${l.first_name} ${l.last_name}`,
      date: l.created_at,
      href: `/contacts/${l.id}`
    })),
    ...arrears.rows.map(a => ({
      id: a.id,
      type: 'arrears',
      title: `Arrears: ${a.property_address}`,
      date: a.updated_at,
      href: `/tenancies/${a.id}`
    }))
  ];

  return activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 7);
}
// --- Maintenance Service ---

export async function getAllMaintenanceRequests(entityId: string) {
  const { rows } = await pool.query(
    `SELECT m.*, p.address_line1 as property_address
     FROM crm_maintenance_requests m
     LEFT JOIN crm_properties p ON m.property_id = p.id
     WHERE m.entity_id = $1
     ORDER BY m.reported_date DESC`,
    [entityId]
  );
  return rows;
}

// --- Tasks Service ---

export async function getAllTasks(entityId: string) {
  const { rows } = await pool.query(
    'SELECT * FROM crm_tasks WHERE entity_id = $1 ORDER BY due_date ASC',
    [entityId]
  );
  return rows;
}

// --- Dashboard Stats ---

export async function getDashboardStats(entityId: string) {
  const [properties, contacts, maintenance] = await Promise.all([
    pool.query('SELECT count(*) FROM crm_properties WHERE entity_id = $1', [entityId]),
    pool.query('SELECT contact_type, count(*) FROM crm_contacts WHERE entity_id = $1 GROUP BY contact_type', [entityId]),
    pool.query("SELECT count(*) FROM crm_maintenance_requests WHERE entity_id = $1 AND status IN ('New', 'In Progress', 'Awaiting Quote', 'Scheduled')", [entityId]),
  ]);

  const contactCounts = contacts.rows.reduce((acc: any, row: any) => {
    acc[row.contact_type] = parseInt(row.count);
    return acc;
  }, {});

  return {
    totalProperties: parseInt(properties.rows[0].count),
    activeTenants: contactCounts['Tenant'] || 0,
    newLeads: contactCounts['Lead'] || 0,
    openMaintenance: parseInt(maintenance.rows[0].count),
  };
}


// --- Notifications ---

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  link?: string;
  is_read: boolean;
  created_at: Date;
}

export async function getNotifications(userId: string): Promise<Notification[]> {
  const { rows } = await pool.query(
    'SELECT * FROM crm_notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
    [userId]
  );
  return rows;
}
