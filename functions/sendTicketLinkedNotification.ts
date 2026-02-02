import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user || (user.user_type !== 'agent' && user.user_type !== 'super_admin' && user.role !== 'admin')) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { displayId, subject, client_email, client_name } = await req.json();

        if (!displayId || !subject || !client_email || !client_name) {
            return Response.json({ error: 'Missing required parameters' }, { status: 400 });
        }

        const emailBody = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #2563eb;">Ticket Linked to Your Account</h2>
                <p>Hello ${client_name},</p>
                <p>We're writing to let you know that support ticket <strong>${displayId}</strong> has been linked to your account.</p>
                <p><strong>Subject:</strong> ${subject}</p>
                <p>You can now view and manage this ticket in your portal:</p>
                <p style="margin: 20px 0;">
                    <a href="https://thinksupport.base44.app/clientportal" 
                       style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                        View Your Tickets
                    </a>
                </p>
                <p>If you have any questions, please don't hesitate to reply to this email.</p>
                <p>Best regards,<br>ThinkTime Support Team</p>
            </div>
        `;

        await base44.integrations.Core.SendEmail({
            to: client_email,
            subject: `[${displayId}] Ticket Linked to Your Account`,
            body: emailBody
        });

        return Response.json({ message: 'Notification sent successfully' });
    } catch (error) {
        console.error("Error sending ticket linked notification:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});