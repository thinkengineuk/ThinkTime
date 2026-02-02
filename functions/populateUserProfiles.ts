import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Only admins can run this
    if (!user || (user.role !== 'admin' && user.user_type !== 'super_admin')) {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Fetch all users
    const users = await base44.asServiceRole.entities.User.list();
    
    // Check existing UserProfiles
    const existingProfiles = await base44.asServiceRole.entities.UserProfile.list();
    const existingUserIds = new Set(existingProfiles.map(p => p.user_id));

    // Create UserProfile for users not yet in the table
    const newProfiles = users
      .filter(user => !existingUserIds.has(user.id))
      .map(user => ({
        user_id: user.id,
        email: user.email,
        full_name: user.full_name,
        user_type: user.user_type || user.role || 'client',
        organization_id: user.organization_id
      }));

    if (newProfiles.length === 0) {
      return Response.json({ success: true, message: 'No new profiles to create' });
    }

    await base44.asServiceRole.entities.UserProfile.bulkCreate(newProfiles);

    return Response.json({ 
      success: true, 
      message: `Created ${newProfiles.length} UserProfile records` 
    });
  } catch (error) {
    console.error('Error populating UserProfiles:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});