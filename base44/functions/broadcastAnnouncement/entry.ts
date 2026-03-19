import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (!user || (user.user_type !== 'super_admin' && user.role !== 'admin')) {
      return Response.json({ error: 'Unauthorized - Admin access required' }, { status: 403 });
    }

    const { announcementId } = await req.json();

    // Get announcement
    const announcement = await base44.asServiceRole.entities.Announcement.get(announcementId);
    if (!announcement) {
      return Response.json({ error: 'Announcement not found' }, { status: 404 });
    }

    if (announcement.is_published) {
      return Response.json({ error: 'Announcement already published' }, { status: 400 });
    }

    // Get all users
    const allUsers = await base44.asServiceRole.entities.User.list();
    
    // Filter by target audience
    let targetUsers = [];
    if (announcement.target_audience === 'all') {
      targetUsers = allUsers;
    } else if (announcement.target_audience === 'agents') {
      targetUsers = allUsers.filter(u => 
        u.user_type === 'agent' || u.user_type === 'super_admin' || u.role === 'admin'
      );
    } else if (announcement.target_audience === 'clients') {
      targetUsers = allUsers.filter(u => 
        u.user_type !== 'agent' && u.user_type !== 'super_admin' && u.role !== 'admin'
      );
    }

    // Create notifications for each user
    const notifications = targetUsers.map(targetUser => ({
      user_email: targetUser.email,
      announcement_id: announcementId,
      title: announcement.title,
      message: announcement.message,
      type: 'announcement',
      is_read: false
    }));

    // Bulk create notifications
    await base44.asServiceRole.entities.Notification.bulkCreate(notifications);

    // Mark announcement as published
    await base44.asServiceRole.entities.Announcement.update(announcementId, {
      is_published: true,
      published_at: new Date().toISOString(),
      published_by: user.email
    });

    return Response.json({ 
      success: true,
      notificationsSent: notifications.length,
      targetAudience: announcement.target_audience
    });
  } catch (error) {
    console.error('Error broadcasting announcement:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});