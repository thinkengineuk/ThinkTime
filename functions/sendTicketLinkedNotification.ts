import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user || (user.user_type !== 'agent' && user.user_type !== 'super_admin' && user.role !== 'admin')) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { ticketId, displayId, subject, client_email, client_name } = await req.json();

        if (!ticketId || !displayId || !subject || !client_email || !client_name) {
            return Response.json({ error: 'Missing required parameters' }, { status: 400 });
        }

        const emailBody = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #1e293b;">Ticket Linked to Your Account</h2>
                <p>Hello ${client_name},</p>
                <p>We're writing to let you know that ticket <strong>${displayId} - ${subject}</strong> has been linked to your account.</p>
                <p>You can now view and manage this ticket in your support portal.</p>
                <p style="margin: 30px 0;">
                    <a href="${Deno.env.get('BASE44_APP_PUBLIC_URL')}/ClientPortal" 
                       style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                        View Your Tickets
                    </a>
                </p>
                <p>If you have any questions, please don't hesitate to reply to this email.</p>
                <p>Thank you,<br>Your Support Team</p>
            </div>
        `;

        await base44.integrations.Core.SendEmail({
            to: client_email,
            subject: `Ticket ${displayId} Linked to Your Account`,
            body: emailBody
        });

        return Response.json({ message: 'Ticket linked notification sent successfully' });
    } catch (error) {
        console.error("Error sending ticket linked notification:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});