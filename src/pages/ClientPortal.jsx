import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Ticket, Loader2 } from "lucide-react";
import TicketCard from "@/components/tickets/TicketCard";
import CreateTicketDialog from "@/components/tickets/CreateTicketDialog";
import { generateTicketId } from "@/components/utils/base44";
import { toast } from "sonner";

export default function ClientPortal() {
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState("open");
  const [createOpen, setCreateOpen] = useState(false);

  const { data: user } = useQuery({
    queryKey: ["currentUser"],
    queryFn: () => base44.auth.me()
  });

  const { data: userProfile } = useQuery({
    queryKey: ["userProfile", user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      const profiles = await base44.entities.User.filter({ email: user.email });
      return profiles[0];
    },
    enabled: !!user?.email
  });

  const { data: organization } = useQuery({
    queryKey: ["clientOrg", userProfile?.organization_id],
    queryFn: async () => {
      if (!userProfile?.organization_id) return null;
      const orgs = await base44.entities.Organization.filter({ id: userProfile.organization_id });
      return orgs[0];
    },
    enabled: !!userProfile?.organization_id
  });

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["clientTickets", user?.email],
    queryFn: () => base44.entities.Ticket.filter({ client_email: user?.email }, "-last_activity"),
    enabled: !!user?.email
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ["allUsersForNotifications"],
    queryFn: () => base44.entities.User.list(),
  });

  const handleCreateTicket = async (formData) => {
    if (!organization) return;

    const newCounter = (organization.ticket_counter || 0) + 1;
    const displayId = generateTicketId(organization.prefix, newCounter);

    const ticketData = {
      subject: formData.subject,
      description: formData.description,
      priority: formData.priority,
      category: formData.category,
      organization_id: organization.id,
      organization_prefix: organization.prefix,
      client_email: user.email,
      client_name: user.full_name,
      display_id: displayId,
      last_activity: new Date().toISOString(),
      status: "open",
      attachments: formData.attachments || []
    };

    const newTicket = await base44.entities.Ticket.create(ticketData);

    await base44.entities.Organization.update(organization.id, { ticket_counter: newCounter });

    await queryClient.invalidateQueries(["clientTickets", user?.email]);
    
    toast.success(`Ticket #${displayId} created successfully!`);

    // Send email to admins/agents
    const adminEmails = allUsers
      .filter(u => u.role === "admin" || u.user_type === "super_admin" || u.user_type === "agent")
      .map(u => u.email);

    if (adminEmails.length > 0) {
      const subject = `New Ticket #${displayId}: ${formData.subject}`;
      const body = `
        A new ticket has been created by ${user.full_name || user.email}.
        <br><br>
        <strong>Subject:</strong> ${formData.subject}
        <br>
        <strong>Description:</strong> ${formData.description || "N/A"}
        <br>
        <strong>Priority:</strong> ${formData.priority}
        <br>
        <strong>Category:</strong> ${formData.category}
        <br>
        <strong>Client:</strong> ${user.full_name || user.email}
        <br><br>
        View the ticket in your dashboard.
      `;

      for (const email of adminEmails) {
        await base44.integrations.Core.SendEmail({
          to: email,
          subject: subject,
          body: body,
          from_name: "ThinkSupport Notifications"
        });
      }
    }
  };

  const filteredTickets = tickets.filter(ticket => {
    if (viewMode === "open") return ["open", "pending"].includes(ticket.status);
    if (viewMode === "closed") return ["resolved", "closed"].includes(ticket.status);
    return true;
  });

  const brandColor = organization?.branding_color || "#3B82F6";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-sky-50/30">
      {/* Header with Branding */}
      <div 
        className="py-10 px-6 relative overflow-hidden"
        style={{ 
          background: `linear-gradient(135deg, ${brandColor}15, ${brandColor}05)`,
        }}
      >
        <div className="absolute inset-0 bg-grid-slate-200/50 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))]" />
        <div className="max-w-4xl mx-auto relative">
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
                <p className="text-slate-600 mt-1">Welcome back, {user?.full_name || "User"}</p>
              </div>
            </div>
            <Button 
              onClick={() => setCreateOpen(true)}
              style={{ backgroundColor: brandColor }}
              className="hover:opacity-90 shadow-lg"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Request
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {/* Stats */}
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

        {/* Tabs */}
        <div className="flex items-center justify-between mb-6">
          <Tabs value={viewMode} onValueChange={setViewMode}>
            <TabsList className="bg-white/70 backdrop-blur-sm border border-slate-200/50 shadow-sm">
              <TabsTrigger value="open">My Open Tickets</TabsTrigger>
              <TabsTrigger value="closed">History</TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Tickets */}
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
      />
    </div>
  );
}