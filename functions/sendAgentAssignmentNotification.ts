import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Authentication check
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { ticketId, displayId, subject, agent_email, agent_name, client_name, client_email, priority, category, description } = await req.json();

    // Authorization: Only agents and admins can trigger this notification
    const isAgent = user.role === 'admin' || user.user_type === 'agent' || user.user_type === 'super_admin';
    
    if (!isAgent) {
      return Response.json({ error: 'Forbidden: Only agents can send assignment notifications' }, { status: 403 });
    }

    // Construct email notification for the assigned agent
    const emailSubject = `New Ticket Assigned: [${displayId}] ${subject}`;
    const emailBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">New Ticket Assigned to You</h2>
        <p>Hi ${agent_name},</p>
        <p>A new support ticket has been assigned to you:</p>
        
        <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Ticket ID:</strong> ${displayId}</p>
          <p><strong>Subject:</strong> ${subject}</p>
          <p><strong>Priority:</strong> <span style="color: ${priority === 'urgent' ? '#dc2626' : priority === 'high' ? '#ea580c' : '#64748b'};">${priority}</span></p>
          <p><strong>Category:</strong> ${category}</p>
          <p><strong>Client:</strong> ${client_name} (${client_email})</p>
          ${description ? `<p><strong>Description:</strong></p><p style="color: #475569;">${description}</p>` : ''}
        </div>
        
        <p><strong>View Ticket:</strong> <a href="https://thinksupport.base44.app" style="color: #2563eb;">https://thinksupport.base44.app</a></p>
        
        <p>Please log in to your dashboard to view and respond to this ticket.</p>
        
        <p style="color: #64748b; font-size: 14px; margin-top: 30px;">
          This is an automated message from your support system.
        </p>
      </div>
    `;

    // Send email to the assigned agent
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: agent_email,
      subject: emailSubject,
      body: emailBody
    });

    return Response.json({ success: true, sentTo: agent_email });
  } catch (error) {
    console.error('Error sending agent assignment notification:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});