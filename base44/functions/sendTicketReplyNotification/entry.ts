import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

function emailTemplate({ preheader, headerLabel, title, bodyHtml }) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Inter',Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;">${preheader}</div>
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr>
          <td style="padding:0 0 16px 0;" align="center">
            <img src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/697352909f0a3344c678f67e/34209a095_BlueandBlackMinimalistBrandLogo.png" alt="ThinkTime" height="36" style="display:block;" />
          </td>
        </tr>
        <tr>
          <td style="background:#ffffff;border-radius:12px;box-shadow:0 1px 4px rgba(0,0,0,0.08);overflow:hidden;">
            <div style="height:4px;background:linear-gradient(90deg,#0ea5e9,#1e3a8a);"></div>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:28px 32px 8px 32px;">
                  <span style="font-size:11px;font-weight:600;letter-spacing:0.08em;color:#64748b;text-transform:uppercase;">${headerLabel}</span>
                </td>
              </tr>
              <tr>
                <td style="padding:4px 32px 24px 32px;">
                  <h1 style="margin:0;font-size:22px;font-weight:700;color:#0f172a;line-height:1.3;">${title}</h1>
                </td>
              </tr>
              <tr><td style="padding:0 32px 28px 32px;">${bodyHtml}</td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 0 0 0;text-align:center;">
            <p style="margin:0;font-size:12px;color:#94a3b8;">ThinkTime Support · <a href="https://thinktime.support" style="color:#64748b;">thinktime.support</a></p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
}

// isMostRecent = true means this is the newest comment (shown first/top)
function commentBubble(comment, isMostRecent) {
  const isAgent = comment.author_role === 'agent';
  const dateStr = comment.created_date ? formatDate(comment.created_date) : '';
  return `
    <div style="margin-bottom:6px;">
      <div style="font-size:11px;color:#64748b;margin-bottom:3px;font-weight:500;display:flex;align-items:center;gap:8px;">
        <strong style="color:#334155;">${comment.author_name || comment.author_email}</strong>
        <span style="font-weight:400;">· ${isAgent ? 'Engineer' : 'Client'}</span>
        ${dateStr ? `<span style="color:#94a3b8;margin-left:4px;">${dateStr}</span>` : ''}
      </div>
      <div style="background:${isMostRecent ? (isAgent ? '#e0f2fe' : '#f0fdf4') : '#f8fafc'};border-left:3px solid ${isMostRecent ? (isAgent ? '#0ea5e9' : '#22c55e') : '#cbd5e1'};border-radius:0 8px 8px 0;padding:12px 16px;font-size:14px;color:#334155;line-height:1.6;">${(comment.body || '').replace(/\n/g, '<br/>')}</div>
    </div>
  `;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const isAuthorized = user.role === 'admin' || user.user_type === 'agent' || user.user_type === 'super_admin';
    if (!isAuthorized) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const { ticketId, displayId, subject, client_email, client_name, agent_name, reply_body, isPending } = await req.json();

    const ticket = await base44.asServiceRole.entities.Ticket.get(ticketId);

    // Fetch last 2 non-internal comments, newest first (index 0 = newest)
    const recentComments = await base44.asServiceRole.entities.Comment.filter(
      { ticket_id: ticketId, is_internal: false },
      '-created_date',
      2
    );

    // --- Email to client ---
    if (client_email) {
      const firstName = client_name ? client_name.split(' ')[0] : 'there';

      // newest first: recentComments[0] is newest, recentComments[1] is previous
      const conversationHtml = recentComments.length > 0 ? `
        <div style="margin-bottom:20px;">
          <p style="margin:0 0 8px 0;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Conversation</p>
          ${recentComments.map((c, i) => commentBubble(c, i === 0)).join('')}
        </div>
      ` : '';

      const pendingNotice = isPending ? `
        <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:14px 16px;margin-bottom:20px;">
          <p style="margin:0;font-size:13px;color:#9a3412;font-weight:600;">⏰ Action Required</p>
          <p style="margin:6px 0 0;font-size:13px;color:#9a3412;line-height:1.6;">This ticket is pending your review. If no response is received within <strong>7 days</strong>, it will be automatically closed.</p>
        </div>
      ` : '';

      const bodyHtml = `
        <p style="margin:0 0 20px 0;font-size:14px;color:#475569;">Hi ${firstName}, <strong>${agent_name}</strong> has replied to your ticket <span style="font-family:monospace;background:#e0f2fe;color:#0369a1;padding:1px 6px;border-radius:4px;font-size:12px;">${displayId}</span>.</p>
        ${pendingNotice}
        ${conversationHtml}
        <a href="https://thinktime.support" style="display:inline-block;background:linear-gradient(90deg,#0ea5e9,#1e3a8a);color:#ffffff;text-decoration:none;padding:11px 22px;border-radius:7px;font-size:14px;font-weight:600;">View & Reply →</a>
      `;

      const html = emailTemplate({
        preheader: `${agent_name} replied to ticket ${displayId}`,
        headerLabel: `Ticket ${displayId}`,
        title: subject,
        bodyHtml
      });

      await base44.asServiceRole.integrations.Core.SendEmail({
        to: client_email,
        subject: `Re: [${displayId}] ${subject}`,
        body: html
      });
    }

    // --- Email to admins/agents/watchers ---
    const userProfiles = await base44.asServiceRole.entities.UserProfile.list();
    const ticketOrgId = ticket?.organization_id;
    const recipientEmails = new Set();

    userProfiles.forEach(u => {
      if (u.email === user.email || u.email === client_email) return;
      // super_admins get all notifications
      if (u.user_type === 'super_admin') {
        recipientEmails.add(u.email);
      }
      // agents/admins only get notified for tickets in their organization
      if ((u.user_type === 'agent' || u.user_type === 'admin') && ticketOrgId && u.organization_id === ticketOrgId) {
        recipientEmails.add(u.email);
      }
    });

    if (ticket?.assigned_agent_email && ticket.assigned_agent_email !== user.email && ticket.assigned_agent_email !== client_email) {
      recipientEmails.add(ticket.assigned_agent_email);
    }

    if (ticket?.watchers) {
      ticket.watchers.forEach(w => {
        if (w.email !== user.email && w.email !== client_email) recipientEmails.add(w.email);
      });
    }

    for (const email of recipientEmails) {
      const conversationHtml = recentComments.length > 0 ? `
        <div style="margin-bottom:20px;">
          <p style="margin:0 0 8px 0;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Conversation</p>
          ${recentComments.map((c, i) => commentBubble(c, i === 0)).join('')}
        </div>
      ` : '';

      const bodyHtml = `
        <p style="margin:0 0 20px 0;font-size:14px;color:#475569;"><strong>${agent_name}</strong> replied to ticket <span style="font-family:monospace;background:#e0f2fe;color:#0369a1;padding:1px 6px;border-radius:4px;font-size:12px;">${displayId}</span>.</p>
        ${conversationHtml}
        <a href="https://thinktime.support" style="display:inline-block;background:linear-gradient(90deg,#0ea5e9,#1e3a8a);color:#ffffff;text-decoration:none;padding:11px 22px;border-radius:7px;font-size:14px;font-weight:600;">View Ticket →</a>
      `;

      const html = emailTemplate({
        preheader: `${agent_name} replied to ${displayId}`,
        headerLabel: `Ticket Update · ${displayId}`,
        title: subject,
        bodyHtml
      });

      await base44.asServiceRole.integrations.Core.SendEmail({
        to: email,
        subject: `Update: [${displayId}] ${subject}`,
        body: html
      });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error sending ticket reply notification:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});