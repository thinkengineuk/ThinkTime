import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    
    const { data: user } = payload;
    
    if (!user) {
      return Response.json({ error: 'No user data provided' }, { status: 400 });
    }

    // Find and update UserProfile record by user_id
    const profiles = await base44.asServiceRole.entities.UserProfile.filter({ user_id: user.id });
    
    if (profiles.length > 0) {
      await base44.asServiceRole.entities.UserProfile.update(profiles[0].id, {
        email: user.email,
        full_name: user.full_name,
        user_type: user.user_type || user.role || 'client',
        organization_id: user.organization_id
      });
    }

    return Response.json({ success: true, message: 'UserProfile updated' });
  } catch (error) {
    console.error('Error syncing UserProfile on update:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});