import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { ticketId, commentId, commentBody, authorName } = await req.json();

    // Fetch ticket and related data
    const ticket = await base44.asServiceRole.entities.Ticket.get(ticketId);
    if (!ticket) {
      return Response.json({ error: 'Ticket not found' }, { status: 404 });
    }

    // Get all potential participants (client, agent, watchers, admins)
    const allUsers = await base44.asServiceRole.entities.User.list();
    const userProfiles = await base44.asServiceRole.entities.UserProfile.list();

    const participants = [];

    // Add client
    if (ticket.client_email) {
      const clientProfile = userProfiles.find(p => p.email === ticket.client_email);
      if (clientProfile) {
        participants.push({
          email: ticket.client_email,
          name: clientProfile.display_full_name || clientProfile.full_name,
          firstName: (clientProfile.display_full_name || clientProfile.full_name).split(' ')[0]
        });
      }
    }

    // Add assigned agent
    if (ticket.assigned_agent_email) {
      const agentProfile = userProfiles.find(p => p.email === ticket.assigned_agent_email);
      if (agentProfile) {
        participants.push({
          email: ticket.assigned_agent_email,
          name: agentProfile.display_full_name || agentProfile.full_name,
          firstName: (agentProfile.display_full_name || agentProfile.full_name).split(' ')[0]
        });
      }
    }

    // Add watchers
    if (ticket.watchers) {
      for (const watcher of ticket.watchers) {
        const watcherProfile = userProfiles.find(p => p.email === watcher.email);
        if (watcherProfile) {
          participants.push({
            email: watcher.email,
            name: watcherProfile.display_full_name || watcherProfile.full_name,
            firstName: (watcherProfile.display_full_name || watcherProfile.full_name).split(' ')[0]
          });
        }
      }
    }

    // Add admins and super admins
    const admins = allUsers.filter(u => u.user_type === 'super_admin' || u.role === 'admin');
    for (const admin of admins) {
      const adminProfile = userProfiles.find(p => p.email === admin.email);
      if (adminProfile) {
        participants.push({
          email: admin.email,
          name: adminProfile.display_full_name || adminProfile.full_name,
          firstName: (adminProfile.display_full_name || adminProfile.full_name).split(' ')[0]
        });
      }
    }

    // Find @mentions in the comment body
    const mentionRegex = /@(\w+)/g;
    const mentions = [...commentBody.matchAll(mentionRegex)].map(match => match[1].toLowerCase());

    if (mentions.length === 0) {
      return Response.json({ success: true, notificationsCreated: 0 });
    }

    // Create notifications for mentioned users
    const notificationsCreated = [];
    for (const participant of participants) {
      const firstNameLower = participant.firstName.toLowerCase();
      
      // Check if this person was mentioned and is not the author
      if (mentions.includes(firstNameLower) && participant.email !== user.email) {
        // Extract snippet around the mention
        const mentionIndex = commentBody.toLowerCase().indexOf(`@${firstNameLower}`);
        const snippetStart = Math.max(0, mentionIndex - 30);
        const snippetEnd = Math.min(commentBody.length, mentionIndex + 50);
        let snippet = commentBody.substring(snippetStart, snippetEnd);
        if (snippetStart > 0) snippet = '...' + snippet;
        if (snippetEnd < commentBody.length) snippet = snippet + '...';

        // Create notification
        await base44.asServiceRole.entities.Notification.create({
          user_email: participant.email,
          ticket_id: ticketId,
          ticket_display_id: ticket.display_id,
          comment_id: commentId,
          message: snippet,
          mentioned_by_name: authorName,
          type: 'mention',
          is_read: false
        });

        notificationsCreated.push(participant.email);
      }
    }

    return Response.json({ 
      success: true, 
      notificationsCreated: notificationsCreated.length,
      recipients: notificationsCreated
    });
  } catch (error) {
    console.error('Error handling mention notifications:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});