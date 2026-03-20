import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    // Support both direct calls and entity automation payloads
    const userProfile = payload.data || payload.userProfile;

    if (!userProfile) {
      return Response.json({ error: 'No user profile data provided' }, { status: 400 });
    }

    // Only notify for pending client users
    if (userProfile.status !== 'pending' || userProfile.user_type === 'super_admin' || userProfile.user_type === 'agent') {
      return Response.json({ skipped: true, reason: 'Not a pending client user' });
    }

    // Get all admins to notify - filter directly to avoid fetching all profiles
    const superAdmins = await base44.asServiceRole.entities.UserProfile.filter({ user_type: 'super_admin' });
    const adminProfiles = await base44.asServiceRole.entities.UserProfile.filter({ user_type: 'admin' });
    const admins = [...superAdmins, ...adminProfiles];

    if (admins.length === 0) {
      return Response.json({ success: true, notified: 0 });
    }

    const userName = userProfile.display_full_name || userProfile.full_name || userProfile.email;
    const clientsUrl = 'https://app.base44.com'; // Admins will go to Clients page

    const emailHtml = `
      <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8fafc; padding: 24px;">
        <div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
          
          <div style="background: linear-gradient(135deg, #0ea5e9, #1e3a8a); padding: 28px 32px;">
            <img src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/697352909f0a3344c678f67e/34209a095_BlueandBlackMinimalistBrandLogo.png" 
                 alt="ThinkTime" style="height: 36px; margin-bottom: 16px; display: block;" />
            <h1 style="color: white; margin: 0; font-size: 20px; font-weight: 600;">New User Pending Approval</h1>
          </div>

          <div style="padding: 32px;">
            <p style="color: #475569; margin: 0 0 20px; font-size: 15px; line-height: 1.6;">
              A new user has signed up and is waiting for your approval in the ThinkTime portal.
            </p>

            <div style="background: #f1f5f9; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 6px 0; color: #64748b; font-size: 13px; font-weight: 500; width: 130px;">Name</td>
                  <td style="padding: 6px 0; color: #0f172a; font-size: 14px; font-weight: 600;">${userName}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #64748b; font-size: 13px; font-weight: 500;">Email</td>
                  <td style="padding: 6px 0; color: #0f172a; font-size: 14px;">${userProfile.email}</td>
                </tr>
                ${userProfile.company_name ? `
                <tr>
                  <td style="padding: 6px 0; color: #64748b; font-size: 13px; font-weight: 500;">Company</td>
                  <td style="padding: 6px 0; color: #0f172a; font-size: 14px;">${userProfile.company_name}</td>
                </tr>` : ''}
                <tr>
                  <td style="padding: 6px 0; color: #64748b; font-size: 13px; font-weight: 500;">Status</td>
                  <td style="padding: 6px 0;">
                    <span style="background: #fef3c7; color: #92400e; font-size: 12px; font-weight: 600; padding: 2px 8px; border-radius: 999px;">
                      Pending Approval
                    </span>
                  </td>
                </tr>
              </table>
            </div>

            <p style="color: #64748b; font-size: 14px; margin: 0 0 20px;">
              Please review this user in the Clients page and assign them to an organisation and role.
            </p>

            <a href="${clientsUrl}" 
               style="display: inline-block; background: linear-gradient(135deg, #0ea5e9, #1e3a8a); color: white; 
                      text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px;">
              Review in ThinkTime →
            </a>
          </div>

          <div style="border-top: 1px solid #e2e8f0; padding: 16px 32px; background: #f8fafc;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">
              You received this email because you are an administrator of ThinkTime.
            </p>
          </div>
        </div>
      </div>
    `;

    // Send email to all admins
    await Promise.all(admins.map(admin =>
      base44.asServiceRole.integrations.Core.SendEmail({
        to: admin.email,
        subject: `New User Pending Approval: ${userName}`,
        body: emailHtml
      })
    ));

    return Response.json({ success: true, notified: admins.length });
  } catch (error) {
    console.error('Error notifying admins of new pending user:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});