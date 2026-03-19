import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { organization_id } = await req.json();

    if (!organization_id) {
      return Response.json({ error: 'organization_id is required' }, { status: 400 });
    }

    // Fetch the organization
    const org = await base44.asServiceRole.entities.Organization.get(organization_id);
    
    if (!org) {
      return Response.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Atomically increment the counter
    const newCounter = (org.ticket_counter || 0) + 1;
    await base44.asServiceRole.entities.Organization.update(organization_id, { 
      ticket_counter: newCounter 
    });

    const displayId = `${org.prefix}-${newCounter}`;

    return Response.json({ 
      display_id: displayId,
      ticket_counter: newCounter
    });
  } catch (error) {
    console.error('Error generating ticket ID:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});