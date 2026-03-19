import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    // Support direct assignment: { user_id, organization_id }
    if (payload.user_id && payload.organization_id) {
      await base44.asServiceRole.entities.User.update(payload.user_id, {
        organization_id: payload.organization_id
      });
      return Response.json({ message: "User assigned to organization", updated: true });
    }

    // Legacy: domain-based matching
    const { data: userData } = payload;
    if (!userData) {
      return Response.json({ error: "No user data provided" }, { status: 400 });
    }

    if (userData.organization_id) {
      return Response.json({ message: "User already has organization", updated: false });
    }

    const emailDomain = userData.email.split('@')[1];
    if (!emailDomain) {
      return Response.json({ error: "Invalid email format" }, { status: 400 });
    }

    const organizations = await base44.asServiceRole.entities.Organization.list();
    const matchingOrg = organizations.find(org => org.domain === emailDomain);

    if (!matchingOrg) {
      return Response.json({ 
        message: "No matching organization found for domain", 
        domain: emailDomain,
        updated: false 
      });
    }

    await base44.asServiceRole.entities.User.update(userData.id, {
      organization_id: matchingOrg.id
    });

    return Response.json({ 
      message: "User assigned to organization",
      organization: matchingOrg.name,
      updated: true
    });

  } catch (error) {
    console.error("Error assigning user to organization:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});