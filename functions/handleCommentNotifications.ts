import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();

    // Only process new comments
    if (event.type !== 'create') {
      return Response.json({ success: false, message: 'Only create events are processed' });
    }

    const comment = data;

    // Skip internal notes
    if (comment.is_internal) {
      return Response.json({ success: true, message: 'Internal note - no notifications sent' });
    }

    // Fetch the ticket
    const ticket = await base44.asServiceRole.entities.Ticket.get(comment.ticket_id);
    if (!ticket) {
      return Response.json({ success: false, message: 'Ticket not found' });
    }

    // Fetch the comment author to get full details
    const users = await base44.asServiceRole.entities.User.list();
    const author = users.find(u => u.email === comment.author_email);

    if (comment.author_role === 'agent') {
      // Agent replied - notify client
      await base44.asServiceRole.functions.invoke('sendTicketReplyNotification', {
        ticketId: comment.ticket_id,
        displayId: ticket.display_id,
        subject: ticket.subject,
        client_email: ticket.client_email,
        client_name: ticket.client_name,
        agent_name: author?.full_name || comment.author_name,
        reply_body: comment.body
      });
    } else {
      // Client replied - notify agents/admins
      await base44.asServiceRole.functions.invoke('sendClientReplyNotification', {
        ticketId: comment.ticket_id,
        displayId: ticket.display_id,
        subject: ticket.subject,
        client_name: author?.full_name || comment.author_name,
        assigned_agent_email: ticket.assigned_agent_email,
        reply_body: comment.body
      });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error handling comment notifications:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});