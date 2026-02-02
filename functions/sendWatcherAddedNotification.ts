import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Authentication and authorization check
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admins and agents can send watcher notifications
    const isAuthorized = user.role === 'admin' || user.user_type === 'agent' || user.user_type === 'super_admin';
    if (!isAuthorized) {
      return Response.json({ error: 'Forbidden: Admin or agent access required' }, { status: 403 });
    }

    const { displayId, subject, watcher_email, watcher_name, client_name } = await req.json();

    const watcherFirstName = watcher_name.split(' ')[0];
    
    const emailBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">You've Been Added as a Watcher</h2>
        <p>Hi ${watcherFirstName},</p>
        <p>You have been added as a watcher to support ticket <strong>#${displayId}</strong>:</p>
        
        <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">${subject}</h3>
          <p style="color: #475569; margin: 0;">Client: <strong>${client_name}</strong></p>
        </div>
        
        <p>You will receive email notifications whenever there are updates to this ticket.</p>
        
        <p>View ticket details: <a href="https://thinktime.base44.app" style="color: #2563eb;">https://thinktime.base44.app</a></p>
        
        <p style="color: #64748b; font-size: 14px; margin-top: 30px;">
          This is an automated message from your support system.
        </p>
      </div>
    `;

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: watcher_email,
      subject: `Added as Watcher: [${displayId}] ${subject}`,
      body: emailBody
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error sending watcher added notification:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});