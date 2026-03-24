
-- 6. Maintenance Requests
CREATE TABLE IF NOT EXISTS crm_maintenance_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    property_id UUID REFERENCES crm_properties(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    priority VARCHAR(50) DEFAULT 'Medium'
        CHECK (priority IN ('Low', 'Medium', 'High', 'Urgent')),
    status VARCHAR(50) DEFAULT 'New'
        CHECK (status IN ('New', 'In Progress', 'Awaiting Quote', 'Scheduled', 'Completed', 'Cancelled')),
    reported_by_id UUID REFERENCES crm_contacts(id) ON DELETE SET NULL,
    assigned_to_id UUID REFERENCES crm_contacts(id) ON DELETE SET NULL,
    reported_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    due_date DATE,
    estimated_cost DECIMAL(12,2),
    actual_cost DECIMAL(12,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Tasks
CREATE TABLE IF NOT EXISTS crm_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    due_date TIMESTAMP WITH TIME ZONE,
    priority VARCHAR(50) DEFAULT 'Medium'
        CHECK (priority IN ('Low', 'Medium', 'High')),
    status VARCHAR(50) DEFAULT 'To Do'
        CHECK (status IN ('To Do', 'In Progress', 'Completed')),
    related_type VARCHAR(50), -- 'Property', 'Contact', 'Tenancy'
    related_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_maintenance_entity_id ON crm_maintenance_requests(entity_id);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_entity_id ON crm_tasks(entity_id);

CREATE TRIGGER update_crm_maintenance_updated_at BEFORE UPDATE ON crm_maintenance_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_crm_tasks_updated_at BEFORE UPDATE ON crm_tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
