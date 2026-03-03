import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Authentication and authorization check
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admins and agents can send ticket reply notifications
    const isAuthorized = user.role === 'admin' || user.user_type === 'agent' || user.user_type === 'super_admin';
    if (!isAuthorized) {
      return Response.json({ error: 'Forbidden: Admin or agent access required' }, { status: 403 });
    }

    const { ticketId, displayId, subject, client_email, client_name, agent_name, reply_body, isPending } = await req.json();

    // Fetch ticket to get assigned engineer
    const ticket = await base44.asServiceRole.entities.Ticket.get(ticketId);

    // Fetch client user to check if they have logged in before
    const clientUsers = await base44.asServiceRole.entities.User.filter({ email: client_email });
    const clientUser = clientUsers.length > 0 ? clientUsers[0] : null;
    const hasClientLoggedInBefore = clientUser && clientUser.has_logged_in_before;

    // Always send email to client if client email is present
    if (client_email) {
      const firstName = client_name.split(' ')[0];
      
      const clientEmailBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">New Reply on Your Support Ticket</h2>
          <p>Hi ${firstName},</p>
          <p>${agent_name} has replied to your ticket <strong>#${displayId}</strong>:</p>
          
          <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0;">${subject}</h3>
            <div style="color: #475569; line-height: 1.6; white-space: pre-wrap;">
              ${reply_body.replace(/\n/g, '<br/>')}
            </div>
          </div>
          
          <p>You can view and reply to this ticket by logging into your support portal: <a href="https://thinktime.support" style="color: #2563eb;">https://thinktime.support</a></p>
          
          <p style="color: #64748b; font-size: 14px; margin-top: 30px;">
            This is an automated message from your support system.
          </p>
        </div>
      `;

      // Send email to client
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: client_email,
        subject: `Re: [${displayId}] ${subject}`,
        body: clientEmailBody
      });
    }

    // Fetch all users to identify admins and agents
    const allUsers = await base44.asServiceRole.entities.User.list();
    
    const recipientEmails = new Set();

    // Add all admins and super admins (excluding the person who replied)
    allUsers.forEach(u => {
      if ((u.role === 'admin' || u.user_type === 'super_admin') && u.email !== user.email) {
        recipientEmails.add(u.email);
      }
    });

    // Add assigned agent if exists and not already in the list
    if (ticket?.assigned_agent_email && ticket.assigned_agent_email !== user.email && !recipientEmails.has(ticket.assigned_agent_email)) {
      recipientEmails.add(ticket.assigned_agent_email);
    }
    
    // Add watchers if not already in the list
    if (ticket?.watchers) {
      ticket.watchers.forEach(watcher => {
        if (watcher.email !== user.email && !recipientEmails.has(watcher.email)) {
          recipientEmails.add(watcher.email);
        }
      });
    }

    // Send emails to all recipients
    for (const email of recipientEmails) {
      const emailBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Update on Ticket #${displayId}</h2>
          <p>Hi,</p>
          <p>${agent_name} has replied to ticket <strong>#${displayId}</strong>:</p>
          
          <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0;">${subject}</h3>
            <div style="color: #475569; line-height: 1.6; white-space: pre-wrap;">
              ${reply_body.replace(/\n/g, '<br/>')}
            </div>
          </div>
          
          <p>View ticket details: <a href="https://thinktime.support" style="color: #2563eb;">https://thinktime.support</a></p>
          
          <p style="color: #64748b; font-size: 14px; margin-top: 30px;">
            This is an automated message from your support system.
          </p>
        </div>
      `;

      await base44.asServiceRole.integrations.Core.SendEmail({
        to: email,
        subject: `Update: [${displayId}] ${subject}`,
        body: emailBody
      });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error sending ticket reply notification:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});