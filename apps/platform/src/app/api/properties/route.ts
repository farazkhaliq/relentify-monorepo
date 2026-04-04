import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { getAllProperties, createProperty } from '@/lib/services/crm/property.service';
import { logAuditEvent } from '@/lib/audit';

export async function GET() {
  const auth = await getAuthUser();
  if (!auth?.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const properties = await getAllProperties(auth.activeEntityId);
    return NextResponse.json(properties);
  } catch (error) {
    console.error('GET /api/properties error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth?.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const property = await createProperty({
      ...body,
      entity_id: auth.activeEntityId,
      user_id: auth.userId,
    });
    await logAuditEvent(auth.activeEntityId, auth.userId, 'Create', 'Property', property.id, property.address_line1);
    return NextResponse.json(property, { status: 201 });
  } catch (error) {
    console.error('POST /api/properties error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
