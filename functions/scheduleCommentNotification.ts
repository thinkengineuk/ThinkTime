import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// This function is called right after a comment is created.
// It waits 30 seconds, then checks if the comment still exists and hasn't been updated.
// If so, it fires the email notification.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { commentId, ticketId, scheduledAt, isPending, authorRole, authorName } = await req.json();

    // Wait 30 seconds
    await new Promise(resolve => setTimeout(resolve, 30000));

    // Fetch the current state of the comment
    const comments = await base44.asServiceRole.entities.Comment.filter({ id: commentId });
    const comment = comments[0];

    // If comment was deleted, abort
    if (!comment) {
      return Response.json({ success: false, message: 'Comment was deleted during grace period' });
    }

    // If notification already sent (shouldn't happen but guard), abort
    if (comment.notification_sent) {
      return Response.json({ success: false, message: 'Notification already sent' });
    }

    // Check if comment was edited after scheduling (notification_scheduled_at vs updated_date)
    // If updated_date is meaningfully newer than scheduled_at, the user edited it — reschedule from the edit
    // We simply check: if notification_scheduled_at changed, another invocation will handle it
    if (comment.notification_scheduled_at !== scheduledAt) {
      return Response.json({ success: false, message: 'Comment was re-scheduled by an edit, aborting this invocation' });
    }

    // Mark notification as sent BEFORE sending to avoid double sends
    await base44.asServiceRole.entities.Comment.update(commentId, { notification_sent: true });

    // Fetch ticket
    const ticket = await base44.asServiceRole.entities.Ticket.get(ticketId);
    if (!ticket) return Response.json({ success: false, message: 'Ticket not found' });

    const users = await base44.asServiceRole.entities.User.list();
    const author = users.find(u => u.email === comment.author_email);

    if (authorRole === 'agent') {
      await base44.asServiceRole.functions.invoke('sendTicketReplyNotification', {
        ticketId: ticket.id,
        displayId: ticket.display_id,
        subject: ticket.subject,
        client_email: ticket.client_email,
        client_name: ticket.client_name,
        agent_name: author?.full_name || authorName,
        reply_body: comment.body,
        isPending: isPending || ticket.status === 'pending'
      });
    } else {
      await base44.asServiceRole.functions.invoke('sendClientReplyNotification', {
        ticketId: ticket.id,
        displayId: ticket.display_id,
        subject: ticket.subject,
        client_name: author?.full_name || authorName,
        assigned_agent_email: ticket.assigned_agent_email,
        reply_body: comment.body
      });
    }

    return Response.json({ success: true, message: 'Notification sent after grace period' });
  } catch (error) {
    console.error('Error in scheduleCommentNotification:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});