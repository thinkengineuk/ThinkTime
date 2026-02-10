import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Authentication check
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { ticketId, displayId, subject, description, priority, category, client_name, client_email, assigned_agent_email } = await req.json();

    // Authorization: Verify the user is authorized to create this ticket
    const isAgent = user.role === 'admin' || user.user_type === 'agent' || user.user_type === 'super_admin';
    
    // If user is a client, they can only create tickets for themselves
    if (!isAgent && user.email !== client_email) {
      return Response.json({ error: 'Forbidden: You can only create tickets for yourself' }, { status: 403 });
    }

    // Fetch all users to identify administrators and agents
    const users = await base44.asServiceRole.entities.User.list();
    
    // If there's an assigned agent, notify them; otherwise notify only super_admins
    let recipientEmails;
    if (assigned_agent_email) {
      recipientEmails = [assigned_agent_email];
    } else {
      recipientEmails = users
        .filter(user => user.user_type === 'super_admin')
        .map(user => user.email);
    }

    if (recipientEmails.length === 0) {
      console.warn('No recipients found for new ticket notification');
      return Response.json({ success: false, message: 'No recipients' });
    }

    // Construct email notification
    const emailSubject = `New Support Ticket: [${displayId}] ${subject}`;
    const emailBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">New ThinkTime Support Ticket Created</h2>
        <p>A new support ticket has been submitted:</p>
        
        <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Ticket ID:</strong> ${displayId}</p>
          <p><strong>Subject:</strong> ${subject}</p>
          <p><strong>Priority:</strong> ${priority}</p>
          <p><strong>Category:</strong> ${category}</p>
          <p><strong>Client:</strong> ${client_name} (${client_email})</p>
          ${description ? `<p><strong>Description:</strong></p><p style="color: #475569; white-space: pre-wrap;">${description.replace(/\n/g, '<br/>')}</p>` : ''}
        </div>
        
        <p>Please log in to your admin dashboard to view and respond to this ticket: <a href="https://thinktime.support" style="color: #2563eb;">https://thinktime.support</a></p>
        
        <p style="color: #64748b; font-size: 14px; margin-top: 30px;">
          This is an automated message from your ThinkTime support system.
        </p>
      </div>
    `;

    // Send email to recipients
    for (const email of recipientEmails) {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: email,
        subject: emailSubject,
        body: emailBody
      });
    }

    return Response.json({ success: true, sentTo: recipientEmails });
  } catch (error) {
    console.error('Error sending new ticket notification:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});