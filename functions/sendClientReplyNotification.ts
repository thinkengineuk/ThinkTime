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

function commentBubble(comment, isMostRecent) {
  const isAgent = comment.author_role === 'agent';
  return `
    <div style="margin-bottom:12px;">
      <div style="font-size:11px;color:#94a3b8;margin-bottom:4px;font-weight:500;">
        ${comment.author_name || comment.author_email}
        <span style="font-weight:400;margin-left:4px;">${isAgent ? '· Engineer' : '· Client'}</span>
      </div>
      <div style="background:${isMostRecent ? (isAgent ? '#e0f2fe' : '#f0fdf4') : '#f8fafc'};border-left:3px solid ${isMostRecent ? (isAgent ? '#0ea5e9' : '#22c55e') : '#cbd5e1'};border-radius:0 8px 8px 0;padding:12px 16px;font-size:14px;color:#334155;line-height:1.7;white-space:pre-wrap;">${(comment.body || '').replace(/\n/g, '<br/>')}</div>
    </div>
  `;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { ticketId, displayId, subject, client_name, assigned_agent_email, reply_body } = await req.json();

    const ticket = await base44.asServiceRole.entities.Ticket.get(ticketId);
    if (!ticket) return Response.json({ error: 'Ticket not found' }, { status: 404 });

    const isAgent = user.role === 'admin' || user.user_type === 'agent' || user.user_type === 'super_admin';
    const isTicketClient = user.email === ticket.client_email;
    if (!isAgent && !isTicketClient) return Response.json({ error: 'Forbidden' }, { status: 403 });

    // Fetch last 2 non-internal comments for context
    const recentComments = await base44.asServiceRole.entities.Comment.filter(
      { ticket_id: ticketId, is_internal: false },
      '-created_date',
      2
    );
    const sortedComments = [...recentComments].reverse();

    const conversationHtml = sortedComments.length > 0 ? `
      <div style="margin-bottom:20px;">
        <p style="margin:0 0 10px 0;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Conversation</p>
        ${sortedComments.map((c, i) => commentBubble(c, i === sortedComments.length - 1)).join('')}
      </div>
    ` : '';

    const allUsers = await base44.asServiceRole.entities.User.list();

    let primaryRecipients = [];
    if (ticket.assigned_agent_email) {
      primaryRecipients.push(ticket.assigned_agent_email);
    } else {
      const superAdmins = allUsers.filter(u => u.user_type === 'super_admin');
      primaryRecipients.push(...superAdmins.map(u => u.email));
    }

    const watcherEmails = ticket.watchers ? ticket.watchers.map(w => w.email) : [];
    const uniqueEmails = [...new Set([...primaryRecipients, ...watcherEmails])];

    if (uniqueEmails.length === 0) {
      return Response.json({ success: false, message: 'No recipients' });
    }

    for (const email of uniqueEmails) {
      const bodyHtml = `
        <p style="margin:0 0 20px 0;font-size:14px;color:#475569;"><strong>${client_name}</strong> has replied to ticket <span style="font-family:monospace;background:#e0f2fe;color:#0369a1;padding:1px 6px;border-radius:4px;font-size:12px;">${displayId}</span>.</p>
        ${conversationHtml}
        <a href="https://thinktime.support" style="display:inline-block;background:linear-gradient(90deg,#0ea5e9,#1e3a8a);color:#ffffff;text-decoration:none;padding:11px 22px;border-radius:7px;font-size:14px;font-weight:600;">View & Reply →</a>
      `;

      const html = emailTemplate({
        preheader: `${client_name} replied to ticket ${displayId}`,
        headerLabel: `Client Reply · ${displayId}`,
        title: subject,
        bodyHtml
      });

      await base44.asServiceRole.integrations.Core.SendEmail({
        to: email,
        subject: `Client Reply: [${displayId}] ${subject}`,
        body: html
      });
    }

    return Response.json({ success: true, sentTo: uniqueEmails });
  } catch (error) {
    console.error('Error sending client reply notification:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});