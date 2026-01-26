import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { displayId, subject, description, priority, category, client_name, client_email } = await req.json();

        const allUsers = await base44.asServiceRole.entities.User.list();

        const adminEmails = allUsers
            .filter(u => u.role === "admin" || u.user_type === "super_admin" || u.user_type === "agent")
            .map(u => u.email);

        if (adminEmails.length > 0) {
            const emailSubject = `New Ticket #${displayId}: ${subject}`;
            const emailBody = `
                A new ticket has been created by ${client_name || client_email}.
                <br><br>
                <strong>Subject:</strong> ${subject}
                <br>
                <strong>Description:</strong> ${description || "N/A"}
                <br>
                <strong>Priority:</strong> ${priority}
                <br>
                <strong>Category:</strong> ${category}
                <br>
                <strong>Client:</strong> ${client_name || client_email}
                <br><br>
                View the ticket in your dashboard.
            `;

            for (const email of adminEmails) {
                await base44.integrations.Core.SendEmail({
                    to: email,
                    subject: emailSubject,
                    body: emailBody,
                    from_name: "ThinkSupport Notifications"
                });
            }
        }

        return Response.json({ success: true, notified: adminEmails.length });
    } catch (error) {
        console.error("Error sending notifications:", error.message);
        return Response.json({ error: error.message }, { status: 500 });
    }
});