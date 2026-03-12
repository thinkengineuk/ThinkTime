import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Ticket, Loader2 } from "lucide-react";
import TicketCard from "@/components/tickets/TicketCard";
import CreateTicketDialog from "@/components/tickets/CreateTicketDialog";
import { toast } from "sonner";

export default function ClientPortal() {
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState("open");
  const [createOpen, setCreateOpen] = useState(false);

  const { data: user } = useQuery({
    queryKey: ["currentUser"],
    queryFn: () => base44.auth.me()
  });

  const { data: clientUserProfile, isLoading: isLoadingProfile } = useQuery({
    queryKey: ["clientUserProfile", user?.id],
    queryFn: () => base44.entities.UserProfile.filter({ user_id: user.id }).then(res => res[0] || null),
    enabled: !!user,
  });

  const currentUserDisplayName = isLoadingProfile
    ? ""
    : clientUserProfile?.display_full_name?.split(' ')[0] || clientUserProfile?.full_name?.split(' ')[0] || user?.email;

  const clientOrganizationId = user?.organization_id;

  const { data: organization, isLoading: isLoadingOrganization, error: orgError } = useQuery({
    queryKey: ["clientOrg", clientOrganizationId],
    queryFn: async () => {
      if (!clientOrganizationId) {
        console.warn("No organization_id found on current user data");
        return null;
      }
      try {
        const org = await base44.entities.Organization.get(clientOrganizationId);
        if (!org) {
          console.error("Organization not found with ID:", clientOrganizationId);
          return null;
        }
        return org;
      } catch (error) {
        console.error("Error fetching organization:", error);
        toast.error("Unable to load organization data. Please contact support.");
        return null;
      }
    },
    enabled: !!clientOrganizationId,
    retry: 1
  });

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["clientTickets", user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      
      const clientTickets = await base44.entities.Ticket.filter({ client_email: user.email }, "-last_activity");
      
      const allTickets = await base44.entities.Ticket.list("-last_activity");
      const watchedTickets = allTickets.filter(ticket => 
        ticket.watchers?.some(w => w.email === user.email)
      );
      
      const combinedMap = new Map();
      [...clientTickets, ...watchedTickets].forEach(ticket => {
        combinedMap.set(ticket.id, ticket);
      });
      
      return Array.from(combinedMap.values());
    },
    enabled: !!user?.email
  });

  const handleCreateTicket = async (formData) => {
    try {
      if (!organization) {
        toast.error("Unable to create ticket. Organization data not loaded yet. Please try again.");
        return;
      }

      if (!user?.email || !user?.full_name) {
        toast.error("Unable to create ticket. User information incomplete.");
        return;
      }

      // Generate unique ticket ID atomically via backend function
      const { data: ticketIdData } = await base44.functions.invoke('generateTicketId', {
        organization_id: organization.id
      });
      const displayId = ticketIdData.display_id;

      // Auto-assign to karla@thinkengine.co
      const userProfiles = await base44.entities.UserProfile.list();
      const karlaProfile = userProfiles.find(p => p.email === "karla@thinkengine.co");
      const assignedAgentEmail = "karla@thinkengine.co";
      const assignedAgentName = karlaProfile?.display_full_name || karlaProfile?.full_name || "Karl Abbott";

      const ticketData = {
        subject: formData.subject,
        description: formData.description,
        priority: formData.priority,
        category: formData.category,
        organization_id: organization.id,
        organization_prefix: organization.prefix,
        client_email: user.email,
        client_name: currentUserDisplayName,
        assigned_agent_email: assignedAgentEmail,
        assigned_agent_name: assignedAgentName,
        display_id: displayId,
        last_activity: new Date().toISOString(),
        status: "open",
        attachments: formData.attachments || []
      };

      const newTicket = await base44.entities.Ticket.create(ticketData);

      if (formData.description || formData.attachments?.length > 0) {
        await base44.entities.Comment.create({
          ticket_id: newTicket.id,
          ticket_display_id: displayId,
          author_email: user.email,
          author_name: currentUserDisplayName,
          author_role: "client",
          body: formData.description || "New ticket created",
          is_internal: false,
          source: "web",
          attachments: formData.attachments || []
        });
      }

      queryClient.setQueryData(["clientTickets", user?.email], (oldTickets) => [newTicket, ...(oldTickets || [])]);

      await base44.functions.invoke('sendAgentAssignmentNotification', {
        ticketId: newTicket.id,
        displayId,
        subject: formData.subject,
        agent_email: assignedAgentEmail,
        agent_name: assignedAgentName,
        client_name: currentUserDisplayName,
        client_email: user.email,
        priority: formData.priority,
        category: formData.category,
        description: formData.description
      });

      await base44.functions.invoke('sendNewTicketNotification', {
        ticketId: newTicket.id,
        displayId,
        subject: formData.subject,
        description: formData.description,
        priority: formData.priority,
        category: formData.category,
        client_name: currentUserDisplayName,
        client_email: user.email,
        assigned_agent_email: assignedAgentEmail
      });
      
      toast.success(`Ticket #${displayId} created successfully!`);
    } catch (error) {
      console.error("Ticket creation error:", error);
      toast.error("Failed to create ticket. Please try again.");
    }
  };

  const filteredTickets = tickets.filter(ticket => {
    if (viewMode === "open") return ["open", "pending"].includes(ticket.status);
    if (viewMode === "closed") return ["resolved", "closed"].includes(ticket.status);
    return true;
  });

  const brandColor = organization?.branding_color || "#3B82F6";

  return (
    <div>
      <div 
        className="py-10 px-6 relative overflow-hidden"
        style={{ 
          background: `linear-gradient(135deg, ${brandColor}15, ${brandColor}05)`,
        }}
      >
        <div className="absolute inset-0 bg-grid-slate-200/50 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))]" />
        <div className="max-w-7xl mx-auto relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {organization?.logo_url && (
                <img 
                  src={organization.logo_url} 
                  alt={organization.name} 
                  className="h-12 object-contain rounded"
                />
              )}
              <div>
                <h1 className="text-3xl font-bold" style={{ color: brandColor }}>
                  {organization?.name || "Support"} Portal
                </h1>
                <p className="text-slate-600 mt-1">Welcome back, {currentUserDisplayName}</p>
              </div>
            </div>
            <Button 
              onClick={() => {
                if (!clientOrganizationId) {
                  toast.error("Your account is not linked to an organization. Please contact support.");
                  return;
                }
                if (!organization) {
                  toast.error("Organization data could not be loaded. Please try refreshing the page.");
                  return;
                }
                setCreateOpen(true);
              }}
              style={{ backgroundColor: brandColor }}
              className="hover:opacity-90 shadow-lg"
              disabled={isLoadingOrganization || !organization}
            >
              {isLoadingOrganization ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              New Request
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid grid-cols-2 gap-4 mb-8">
          <Card className="p-5 bg-gradient-to-br from-white to-slate-50/50 border-slate-200/50 shadow-sm hover:shadow-md transition-shadow">
            <p className="text-sm text-slate-500 font-medium">Open Tickets</p>
            <p className="text-3xl font-bold mt-2" style={{ color: brandColor }}>
              {tickets.filter(t => ["open", "pending"].includes(t.status)).length}
            </p>
          </Card>
          <Card className="p-5 bg-gradient-to-br from-white to-emerald-50/30 border-emerald-200/30 shadow-sm hover:shadow-md transition-shadow">
            <p className="text-sm text-slate-500 font-medium">Resolved</p>
            <p className="text-3xl font-bold text-emerald-600 mt-2">
              {tickets.filter(t => ["resolved", "closed"].includes(t.status)).length}
            </p>
          </Card>
        </div>

        <div className="flex items-center justify-between mb-6">
          <Tabs value={viewMode} onValueChange={setViewMode}>
            <TabsList className="bg-white/70 backdrop-blur-sm border border-slate-200/50 shadow-sm">
              <TabsTrigger value="open">My Open Tickets</TabsTrigger>
              <TabsTrigger value="closed">History</TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : filteredTickets.length === 0 ? (
            <Card className="p-12 text-center bg-white/70 backdrop-blur-sm border-slate-200/50 shadow-sm">
              <Ticket className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 mb-4">No tickets found</p>
              <Button 
                variant="outline"
                onClick={() => setCreateOpen(true)}
                className="shadow-sm"
              >
                Create your first ticket
              </Button>
            </Card>
          ) : (
            filteredTickets.map(ticket => (
              <TicketCard key={ticket.id} ticket={ticket} />
            ))
          )}
        </div>
      </div>

      <CreateTicketDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={async (formData) => {
          await handleCreateTicket(formData);
          setCreateOpen(false);
        }}
        isClient={true}
        clientEmail={user?.email}
        defaultOrgId={clientOrganizationId}
      />
    </div>
  );
}