import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const priorityColor = (p) => p === 'urgent' ? '#dc2626' : p === 'high' ? '#ea580c' : p === 'medium' ? '#d97706' : '#64748b';
const priorityBg = (p) => p === 'urgent' ? '#fef2f2' : p === 'high' ? '#fff7ed' : p === 'medium' ? '#fffbeb' : '#f8fafc';

function emailTemplate({ preheader, headerLabel, title, bodyHtml }) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Inter',Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;">${preheader}</div>
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <!-- Logo / Header -->
        <tr>
          <td style="padding:0 0 16px 0;" align="center">
            <img src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/697352909f0a3344c678f67e/34209a095_BlueandBlackMinimalistBrandLogo.png" alt="ThinkTime" height="36" style="display:block;" />
          </td>
        </tr>
        <!-- Card -->
        <tr>
          <td style="background:#ffffff;border-radius:12px;box-shadow:0 1px 4px rgba(0,0,0,0.08);overflow:hidden;">
            <!-- Top accent bar -->
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
        <!-- Footer -->
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

function ticketMetaRow(label, value) {
  return `<tr>
    <td style="padding:6px 0;font-size:13px;color:#64748b;width:110px;vertical-align:top;">${label}</td>
    <td style="padding:6px 0;font-size:13px;color:#0f172a;font-weight:500;">${value}</td>
  </tr>`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { ticketId, displayId, subject, description, priority, category, client_name, client_email, assigned_agent_email } = await req.json();

    const isAgent = user.role === 'admin' || user.user_type === 'agent' || user.user_type === 'super_admin';
    if (!isAgent && user.email !== client_email) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const userProfiles = await base44.asServiceRole.entities.UserProfile.list();
    const adminEmails = userProfiles
      .filter(u => u.user_type === 'super_admin' || u.user_type === 'agent')
      .map(u => u.email);

    let recipientEmails = [...adminEmails];
    if (assigned_agent_email && !recipientEmails.includes(assigned_agent_email)) {
      recipientEmails.push(assigned_agent_email);
    }

    if (recipientEmails.length === 0) {
      return Response.json({ success: false, message: 'No recipients' });
    }

    const priorityDot = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${priorityColor(priority)};margin-right:6px;vertical-align:middle;"></span>`;

    const bodyHtml = `
      <p style="margin:0 0 20px 0;font-size:14px;color:#475569;">A new support ticket has been submitted and requires your attention.</p>

      <div style="background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;padding:16px 20px;margin-bottom:20px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          ${ticketMetaRow('Ticket', `<span style="font-family:monospace;background:#e0f2fe;color:#0369a1;padding:2px 7px;border-radius:4px;font-size:12px;">${displayId}</span>`)}
          ${ticketMetaRow('Subject', subject)}
          ${ticketMetaRow('Client', `${client_name} &lt;${client_email}&gt;`)}
          ${ticketMetaRow('Priority', `${priorityDot}<span style="color:${priorityColor(priority)};font-weight:600;">${priority}</span>`)}
          ${ticketMetaRow('Category', category)}
        </table>
      </div>

      ${description ? `
      <div style="margin-bottom:20px;">
        <p style="margin:0 0 8px 0;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Description</p>
        <div style="background:#f8fafc;border-left:3px solid #0ea5e9;border-radius:0 6px 6px 0;padding:12px 16px;font-size:14px;color:#334155;line-height:1.7;white-space:pre-wrap;">${description.replace(/\n/g, '<br/>')}</div>
      </div>
      ` : ''}

      <a href="https://thinktime.support" style="display:inline-block;background:linear-gradient(90deg,#0ea5e9,#1e3a8a);color:#ffffff;text-decoration:none;padding:11px 22px;border-radius:7px;font-size:14px;font-weight:600;">View Ticket →</a>
    `;

    const html = emailTemplate({
      preheader: `New ticket ${displayId}: ${subject}`,
      headerLabel: 'New Support Ticket',
      title: subject,
      bodyHtml
    });

    for (const email of recipientEmails) {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: email,
        subject: `[${displayId}] New Ticket: ${subject}`,
        body: html
      });
    }

    return Response.json({ success: true, sentTo: recipientEmails });
  } catch (error) {
    console.error('Error sending new ticket notification:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});