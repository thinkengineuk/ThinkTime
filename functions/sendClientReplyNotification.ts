import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Authentication check
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { ticketId, displayId, subject, client_name, assigned_agent_email, reply_body } = await req.json();

    // Authorization: Verify the user is involved in this ticket
    const ticket = await base44.asServiceRole.entities.Ticket.get(ticketId);
    if (!ticket) {
      return Response.json({ error: 'Ticket not found' }, { status: 404 });
    }

    // User must be either the client on the ticket, or an admin/agent
    const isAgent = user.role === 'admin' || user.user_type === 'agent' || user.user_type === 'super_admin';
    const isTicketClient = user.email === ticket.client_email;

    if (!isAgent && !isTicketClient) {
      return Response.json({ error: 'Forbidden: You are not authorized to send notifications for this ticket' }, { status: 403 });
    }

    // Get all admins/agents to notify
    const users = await base44.asServiceRole.entities.User.list();
    const admins = users.filter(u => 
      u.role === 'admin' || 
      u.user_type === 'super_admin'
    );
    const agents = users.filter(u => u.user_type === 'agent');

    // Always include admins, plus assigned agent if exists
    const emailList = [
      ...admins.map(a => a.email),
      ...(assigned_agent_email ? [assigned_agent_email] : agents.map(a => a.email))
    ];
    
    // Remove duplicates
    const uniqueEmails = [...new Set(emailList)];

    if (uniqueEmails.length === 0) {
      console.warn('No recipients found for client reply notification');
      return Response.json({ success: false, message: 'No recipients' });
    }

    // Fetch the last 2 comments to show conversation context
    const comments = await base44.asServiceRole.entities.Comment.filter(
      { ticket_id: ticketId },
      '-created_date',
      2
    );

    // Build conversation history HTML
    let conversationHtml = '';
    if (comments.length > 0) {
      conversationHtml = '<div style="margin: 20px 0;">';
      
      // Reverse to show oldest first in the context
      const sortedComments = [...comments].reverse();
      
      for (const comment of sortedComments) {
        const authorLabel = comment.author_role === 'agent' ? 'Agent' : 'Client';
        conversationHtml += `
          <div style="background-color: ${comment.author_role === 'agent' ? '#f1f5f9' : '#f8fafc'}; padding: 12px; border-radius: 6px; margin-bottom: 10px; border-left: 3px solid ${comment.author_role === 'agent' ? '#2563eb' : '#64748b'};">
            <div style="font-size: 12px; color: #64748b; margin-bottom: 5px;">
              <strong>${comment.author_name}</strong> (${authorLabel})
            </div>
            <div style="color: #475569; line-height: 1.6;">
              ${comment.body}
            </div>
          </div>
        `;
      }
      conversationHtml += '</div>';
    }

    const emailBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Client Reply on Ticket #${displayId}</h2>
        <p><strong>${client_name}</strong> has replied to ticket <strong>#${displayId}</strong>:</p>
        
        <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">${subject}</h3>
          <div style="color: #475569; line-height: 1.6;">
            ${reply_body}
          </div>
        </div>

        ${conversationHtml ? `
          <div style="margin-top: 20px;">
            <h4 style="color: #475569; font-size: 14px; margin-bottom: 10px;">Recent Conversation:</h4>
            ${conversationHtml}
          </div>
        ` : ''}
        
        <p>Please log in to your admin dashboard to view and respond to this ticket: <a href="https://thinktime.base44.app" style="color: #2563eb;">https://thinktime.base44.app</a></p>
        
        <p style="color: #64748b; font-size: 14px; margin-top: 30px;">
          This is an automated message from your support system.
        </p>
      </div>
    `;

    for (const email of uniqueEmails) {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: email,
        subject: `Client Reply: [${displayId}] ${subject}`,
        body: emailBody
      });
    }

    return Response.json({ success: true, sentTo: uniqueEmails });
  } catch (error) {
    console.error('Error sending client reply notification:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});