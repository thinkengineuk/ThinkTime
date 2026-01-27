import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { ticketId, displayId, subject, client_name, assigned_agent_email, reply_body } = await req.json();

    // Get all admins/agents to notify
    const users = await base44.asServiceRole.entities.User.list();
    const recipients = users.filter(u => 
      u.role === 'admin' || 
      u.user_type === 'super_admin' || 
      u.user_type === 'agent'
    );

    // If there's an assigned agent, prioritize them
    const emailList = assigned_agent_email 
      ? [assigned_agent_email]
      : recipients.map(r => r.email);

    if (emailList.length === 0) {
      console.warn('No recipients found for client reply notification');
      return Response.json({ success: false, message: 'No recipients' });
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
        
        <p>Please log in to your admin dashboard to view and respond to this ticket.</p>
        
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