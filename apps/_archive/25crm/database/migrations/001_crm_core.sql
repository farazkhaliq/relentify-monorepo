
-- RELENTIFY CRM - Core Tables (Postgres Migration)

-- 1. Contacts (Landlords, Tenants, Leads)
CREATE TABLE IF NOT EXISTS crm_contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    contact_type VARCHAR(50) NOT NULL DEFAULT 'Lead' 
        CHECK (contact_type IN ('Lead', 'Tenant', 'Landlord', 'Contractor', 'Guarantor')),
    status VARCHAR(50) DEFAULT 'Active' 
        CHECK (status IN ('Active', 'Inactive', 'Archived')),
    address TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Properties
CREATE TABLE IF NOT EXISTS crm_properties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    address_line1 VARCHAR(255) NOT NULL,
    address_line2 VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    postcode VARCHAR(20) NOT NULL,
    property_type VARCHAR(50) NOT NULL DEFAULT 'House'
        CHECK (property_type IN ('House', 'Flat', 'HMO', 'Commercial', 'Land')),
    bedrooms INTEGER DEFAULT 1,
    bathrooms INTEGER DEFAULT 1,
    status VARCHAR(50) DEFAULT 'Available'
        CHECK (status IN ('Available', 'Let', 'Under Maintenance', 'Sold', 'Inactive')),
    landlord_id UUID REFERENCES crm_contacts(id) ON DELETE SET NULL,
    monthly_rent DECIMAL(12,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Tenancies
CREATE TABLE IF NOT EXISTS crm_tenancies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES crm_properties(id) ON DELETE CASCADE,
    rent_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    deposit_amount DECIMAL(12,2) DEFAULT 0,
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE,
    status VARCHAR(50) DEFAULT 'Active'
        CHECK (status IN ('Active', 'Ended', 'Arrears', 'Pending')),
    pipeline_status VARCHAR(100) DEFAULT 'Application Received'
        CHECK (pipeline_status IN ('Application Received', 'Referencing', 'Awaiting Guarantor', 'Contract Signed', 'Awaiting Payment', 'Complete')),
    payment_frequency VARCHAR(50) DEFAULT 'Monthly'
        CHECK (payment_frequency IN ('Weekly', 'Monthly', 'Quarterly', 'Yearly')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Tenancy Tenants (Many-to-Many join table)
CREATE TABLE IF NOT EXISTS crm_tenancy_tenants (
    tenancy_id UUID REFERENCES crm_tenancies(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES crm_contacts(id) ON DELETE CASCADE,
    PRIMARY KEY (tenancy_id, contact_id)
);

-- 5. Notifications (Relentify CRM version)
CREATE TABLE IF NOT EXISTS crm_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    link VARCHAR(255),
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_crm_contacts_user_id ON crm_contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_crm_properties_user_id ON crm_properties(user_id);
CREATE INDEX IF NOT EXISTS idx_crm_tenancies_user_id ON crm_tenancies(user_id);
CREATE INDEX IF NOT EXISTS idx_crm_notifications_user_id ON crm_notifications(user_id);

-- Triggers for updated_at
CREATE TRIGGER update_crm_contacts_updated_at BEFORE UPDATE ON crm_contacts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_crm_properties_updated_at BEFORE UPDATE ON crm_properties FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_crm_tenancies_updated_at BEFORE UPDATE ON crm_tenancies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
