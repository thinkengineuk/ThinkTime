import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    
    const { event } = payload;
    
    if (!event || !event.entity_id) {
      return Response.json({ error: 'No entity ID provided' }, { status: 400 });
    }

    // Find and delete UserProfile record by user_id
    const profiles = await base44.asServiceRole.entities.UserProfile.filter({ user_id: event.entity_id });
    
    if (profiles.length > 0) {
      await base44.asServiceRole.entities.UserProfile.delete(profiles[0].id);
    }

    return Response.json({ success: true, message: 'UserProfile deleted' });
  } catch (error) {
    console.error('Error syncing UserProfile on delete:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});