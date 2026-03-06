import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// This automation trigger now does nothing for email notifications —
// email delivery is handled by scheduleCommentNotification (30-second grace period).
// We keep this handler only for any future non-email processing needs.

Deno.serve(async (req) => {
  try {
    const { event, data } = await req.json();

    if (event.type !== 'create') {
      return Response.json({ success: false, message: 'Only create events are processed' });
    }

    const comment = data;

    if (comment.is_internal) {
      return Response.json({ success: true, message: 'Internal note - no notifications sent' });
    }

    // Email notifications are now handled via scheduleCommentNotification
    // called directly from the frontend with a 30-second grace period.
    return Response.json({ success: true, message: 'Email notification delegated to scheduleCommentNotification' });
  } catch (error) {
    console.error('Error in handleCommentNotifications:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});