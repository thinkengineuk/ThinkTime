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

    const { ticketId, displayId, subject, client_email, client_name, agent_name, reply_body } = await req.json();

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
            <div style="color: #475569; line-height: 1.6;">
              ${reply_body}
            </div>
          </div>
          
          <p>You can view and reply to this ticket by logging into your support portal: <a href="https://thinktime.base44.app" style="color: #2563eb;">https://thinktime.base44.app</a></p>
          
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

    // Send email to assigned engineer if exists and not the same person who replied
    if (ticket?.assigned_agent_email && ticket.assigned_agent_email !== user.email) {
      const engineerEmailBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Update on Assigned Ticket #${displayId}</h2>
          <p>Hi ${ticket.assigned_agent_name},</p>
          <p>${agent_name} has replied to ticket <strong>#${displayId}</strong> that is assigned to you:</p>
          
          <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0;">${subject}</h3>
            <div style="color: #475569; line-height: 1.6;">
              ${reply_body}
            </div>
          </div>
          
          <p>View ticket details: <a href="https://thinktime.base44.app" style="color: #2563eb;">https://thinktime.base44.app</a></p>
          
          <p style="color: #64748b; font-size: 14px; margin-top: 30px;">
            This is an automated message from your support system.
          </p>
        </div>
      `;

      await base44.asServiceRole.integrations.Core.SendEmail({
        to: ticket.assigned_agent_email,
        subject: `Update: [${displayId}] ${subject}`,
        body: engineerEmailBody
      });
    }

    // Send email to watchers
    if (ticket?.watchers && ticket.watchers.length > 0) {
      for (const watcher of ticket.watchers) {
        const watcherFirstName = watcher.name.split(' ')[0];
        const watcherEmailBody = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">Update on Watched Ticket #${displayId}</h2>
            <p>Hi ${watcherFirstName},</p>
            <p>${agent_name} has replied to ticket <strong>#${displayId}</strong> that you are watching:</p>
            
            <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0;">${subject}</h3>
              <div style="color: #475569; line-height: 1.6;">
                ${reply_body}
              </div>
            </div>
            
            <p>View ticket details: <a href="https://thinktime.base44.app" style="color: #2563eb;">https://thinktime.base44.app</a></p>
            
            <p style="color: #64748b; font-size: 14px; margin-top: 30px;">
              You are receiving this because you are watching this ticket.
            </p>
          </div>
        `;

        await base44.asServiceRole.integrations.Core.SendEmail({
          to: watcher.email,
          subject: `Update: [${displayId}] ${subject}`,
          body: watcherEmailBody
        });
      }
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error sending ticket reply notification:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});