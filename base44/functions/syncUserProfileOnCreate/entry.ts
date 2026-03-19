import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    
    const { data: user } = payload;
    
    if (!user) {
      return Response.json({ error: 'No user data provided' }, { status: 400 });
    }

    // Create UserProfile record
    await base44.asServiceRole.entities.UserProfile.create({
      user_id: user.id,
      email: user.email,
      full_name: user.full_name,
      user_type: user.user_type || user.role || 'client',
      organization_id: user.organization_id
    });

    return Response.json({ success: true, message: 'UserProfile created' });
  } catch (error) {
    console.error('Error syncing UserProfile on create:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});