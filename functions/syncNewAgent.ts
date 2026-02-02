import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || (user.role !== 'admin' && user.user_type !== 'super_admin')) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { email } = await req.json();

    // Fetch user by email
    const users = await base44.asServiceRole.entities.User.list();
    const targetUser = users.find(u => u.email === email);

    if (!targetUser) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if profile already exists
    const existing = await base44.asServiceRole.entities.UserProfile.filter({ user_id: targetUser.id });

    if (existing.length > 0) {
      return Response.json({ success: true, message: 'Profile already exists' });
    }

    // Create UserProfile
    await base44.asServiceRole.entities.UserProfile.create({
      user_id: targetUser.id,
      email: targetUser.email,
      full_name: targetUser.full_name,
      user_type: targetUser.user_type || targetUser.role || 'client',
      organization_id: targetUser.organization_id
    });

    return Response.json({ success: true, message: 'UserProfile synced' });
  } catch (error) {
    console.error('Error syncing agent:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});