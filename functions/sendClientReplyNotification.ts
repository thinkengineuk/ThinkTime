import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { ticketId, displayId, subject, client_name, assigned_agent_email, reply_body } = await req.json();

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
        
        <p>Please log in to your admin dashboard to view and respond to this ticket: <a href="https://thinksupport.base44.app" style="color: #2563eb;">https://thinksupport.base44.app</a></p>
        
        <p style="color: #64748b; font-size: 14px; margin-top: 30px;">
          This is an automated message from your support system.
        </p>
      </div>
    `;

    for (const email of emailList) {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: email,
        subject: `Client Reply: [${displayId}] ${subject}`,
        body: emailBody
      });
    }

    return Response.json({ success: true, sentTo: emailList });
  } catch (error) {
    console.error('Error sending client reply notification:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});