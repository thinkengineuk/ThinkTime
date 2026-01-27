import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { Resend } from 'npm:resend@3.2.0';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Authentication and authorization check
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Only admins and agents can send emails
        const isAuthorized = user.role === 'admin' || user.user_type === 'agent' || user.user_type === 'super_admin';
        if (!isAuthorized) {
            return Response.json({ error: 'Forbidden: Admin or agent access required' }, { status: 403 });
        }

        const { to, subject, body, from } = await req.json();

        if (!to || !subject || !body) {
            return Response.json({ error: 'Missing required parameters: to, subject, body' }, { status: 400 });
        }

        const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

        const { data, error } = await resend.emails.send({
            from: from || 'onboarding@resend.dev',
            to: [to],
            subject: subject,
            html: body,
        });

        if (error) {
            console.error('Resend error:', error);
            return Response.json({ error: error.message }, { status: 500 });
        }

        return Response.json({ message: 'Email sent successfully', data });
    } catch (error) {
        console.error('Function execution error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});