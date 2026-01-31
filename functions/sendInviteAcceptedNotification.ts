import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const { event, data: userData } = await req.json();
    
    // Only send notification if this is a real user update (not a system event)
    if (!userData || !userData.email) {
      return Response.json({ success: true, message: "Skipped - no user data" });
    }

    // Fetch all admin and super admin users
    const allUsers = await base44.asServiceRole.entities.User.list();
    const admins = allUsers.filter(user => 
      user.role === 'admin' || user.user_type === 'super_admin'
    );

    if (admins.length === 0) {
      return Response.json({ success: true, message: "No admins to notify" });
    }

    // Send email to each admin
    const emailPromises = admins.map(admin => 
      base44.asServiceRole.integrations.Core.SendEmail({
        to: admin.email,
        subject: "New User Accepted Invite - ThinkTime",
        body: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #0EA5E9;">User Invite Accepted</h2>
            <p><strong>${userData.email}</strong> has accepted the invite.</p>
            <p>Please login to update their user settings:</p>
            <a href="https://thinktime.base44.app" 
               style="display: inline-block; padding: 12px 24px; background-color: #0EA5E9; color: white; text-decoration: none; border-radius: 6px; margin-top: 10px;">
              Login to ThinkTime
            </a>
          </div>
        `
      })
    );

    await Promise.all(emailPromises);

    return Response.json({ 
      success: true, 
      message: `Notified ${admins.length} admin(s)`,
      user_email: userData.email
    });
  } catch (error) {
    console.error("Error sending invite notification:", error);
    return Response.json({ 
      error: error.message,
      success: false 
    }, { status: 500 });
  }
});