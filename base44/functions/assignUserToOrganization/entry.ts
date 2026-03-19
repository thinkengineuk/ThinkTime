import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { data: userData } = await req.json();

    // Only process if user doesn't have an organization_id
    if (userData.organization_id) {
      return Response.json({ 
        message: "User already has organization", 
        updated: false 
      });
    }

    // Extract domain from email
    const emailDomain = userData.email.split('@')[1];
    if (!emailDomain) {
      return Response.json({ error: "Invalid email format" }, { status: 400 });
    }

    // Find organization matching this domain
    const organizations = await base44.asServiceRole.entities.Organization.list();
    const matchingOrg = organizations.find(org => org.domain === emailDomain);

    if (!matchingOrg) {
      return Response.json({ 
        message: "No matching organization found for domain", 
        domain: emailDomain,
        updated: false 
      });
    }

    // Update user with organization_id
    await base44.asServiceRole.entities.User.update(userData.id, {
      organization_id: matchingOrg.id
    });

    console.log(`✅ Assigned user ${userData.email} to organization ${matchingOrg.name}`);

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