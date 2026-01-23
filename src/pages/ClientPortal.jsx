import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Ticket, Loader2 } from "lucide-react";
import TicketCard from "@/components/tickets/TicketCard";
import CreateTicketDialog from "@/components/tickets/CreateTicketDialog";
import { generateTicketId } from "@/components/utils/base44";

export default function ClientPortal() {
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

  const { data: tickets = [], isLoading, refetch } = useQuery({
    queryKey: ["clientTickets", user?.email],
    queryFn: () => base44.entities.Ticket.filter({ client_email: user?.email }, "-last_activity"),
    enabled: !!user?.email
  });

  const handleCreateTicket = async (formData) => {
    if (!organization) return;

    const newCounter = (organization.ticket_counter || 0) + 1;
    const displayId = generateTicketId(organization.prefix, newCounter);

    await base44.entities.Ticket.create({
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
      status: "open"
    });

    await base44.entities.Organization.update(organization.id, { ticket_counter: newCounter });
    refetch();
  };

  const filteredTickets = tickets.filter(ticket => {
    if (viewMode === "open") return ["open", "pending"].includes(ticket.status);
    if (viewMode === "closed") return ["resolved", "closed"].includes(ticket.status);
    return true;
  });

  const brandColor = organization?.branding_color || "#3B82F6";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header with Branding */}
      <div 
        className="py-8 px-6"
        style={{ background: `linear-gradient(135deg, ${brandColor}15, ${brandColor}05)` }}
      >
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold" style={{ color: brandColor }}>
                {organization?.name || "Support"} Portal
              </h1>
              <p className="text-slate-600 mt-1">Welcome back, {user?.full_name || "User"}</p>
            </div>
            <Button 
              onClick={() => setCreateOpen(true)}
              style={{ backgroundColor: brandColor }}
              className="hover:opacity-90"
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
          <Card className="p-4">
            <p className="text-sm text-slate-500">Open Tickets</p>
            <p className="text-2xl font-bold" style={{ color: brandColor }}>
              {tickets.filter(t => ["open", "pending"].includes(t.status)).length}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-slate-500">Resolved</p>
            <p className="text-2xl font-bold text-emerald-600">
              {tickets.filter(t => ["resolved", "closed"].includes(t.status)).length}
            </p>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex items-center justify-between mb-6">
          <Tabs value={viewMode} onValueChange={setViewMode}>
            <TabsList className="bg-white border">
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
            <Card className="p-12 text-center">
              <Ticket className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No tickets found</p>
              <Button 
                className="mt-4"
                variant="outline"
                onClick={() => setCreateOpen(true)}
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
        onSubmit={handleCreateTicket}
        isClient={true}
        clientEmail={user?.email}
      />
    </div>
  );
}