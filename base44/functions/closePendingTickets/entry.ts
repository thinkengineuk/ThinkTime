import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Get all pending tickets
    const pendingTickets = await base44.asServiceRole.entities.Ticket.filter({ status: 'pending' });

    const now = new Date();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    let closedCount = 0;

    for (const ticket of pendingTickets) {
      // Get all comments for this ticket, sorted by date descending
      const comments = await base44.asServiceRole.entities.Comment.filter(
        { ticket_id: ticket.id },
        '-created_date'
      );

      // Find the most recent agent reply (non-internal)
      const lastAgentComment = comments.find(c => c.author_role === 'agent' && !c.is_internal);
      if (!lastAgentComment) continue;

      const lastAgentCommentDate = new Date(lastAgentComment.created_date);
      const timeSinceAgentReply = now - lastAgentCommentDate;

      // Check if 7 days have passed since last agent reply with no client response after it
      if (timeSinceAgentReply < sevenDaysMs) continue;

      // Check if client replied after the last agent comment
      const clientRepliedAfter = comments.some(
        c => c.author_role === 'client' && new Date(c.created_date) > lastAgentCommentDate
      );
      if (clientRepliedAfter) continue;

      // Auto-close the ticket
      await base44.asServiceRole.entities.Ticket.update(ticket.id, {
        status: 'closed',
        resolved_at: now.toISOString(),
        last_activity: now.toISOString()
      });

      // Add a system comment
      await base44.asServiceRole.entities.Comment.create({
        ticket_id: ticket.id,
        ticket_display_id: ticket.display_id,
        author_email: 'system@thinktime.support',
        author_name: 'ThinkTime System',
        author_role: 'agent',
        body: '🔒 This ticket has been automatically closed after 7 days with no client response.',
        is_internal: false,
        source: 'web',
        attachments: []
      });

      // Notify client
      if (ticket.client_email) {
        const firstName = (ticket.client_name || ticket.client_email).split(' ')[0];
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: ticket.client_email,
          subject: `Ticket Closed: [${ticket.display_id}] ${ticket.subject}`,
          body: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #64748b;">Ticket Automatically Closed</h2>
              <p>Hi ${firstName},</p>
              <p>Your support ticket <strong>#${ticket.display_id}: ${ticket.subject}</strong> has been automatically closed as no response was received within 7 days.</p>
              <p>If you still need assistance, please open a new ticket or contact us at <a href="https://thinktime.support" style="color: #2563eb;">https://thinktime.support</a>.</p>
              <p style="color: #64748b; font-size: 14px; margin-top: 30px;">This is an automated message from your support system.</p>
            </div>
          `
        });
      }

      closedCount++;
    }

    return Response.json({ success: true, closedCount });
  } catch (error) {
    console.error('Error closing pending tickets:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});