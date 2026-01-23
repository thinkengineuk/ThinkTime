import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Ticket, Clock, CheckCircle, AlertTriangle, Loader2 } from "lucide-react";
import StatsCard from "@/components/dashboard/StatsCard";
import OrgSwitcher from "@/components/dashboard/OrgSwitcher";
import TicketCard from "@/components/tickets/TicketCard";
import TicketFilters from "@/components/tickets/TicketFilters";
import CreateTicketDialog from "@/components/tickets/CreateTicketDialog";
import { generateTicketId } from "@/components/utils/base44";

export default function Dashboard() {
  const [selectedOrg, setSelectedOrg] = useState("all");
  const [viewMode, setViewMode] = useState("active");
  const [createOpen, setCreateOpen] = useState(false);
  const [filters, setFilters] = useState({
    status: "all",
    priority: "all",
    organization: "all",
    search: ""
  });

  const { data: user } = useQuery({
    queryKey: ["currentUser"],
    queryFn: () => base44.auth.me()
  });

  const { data: organizations = [] } = useQuery({
    queryKey: ["organizations"],
    queryFn: () => base44.entities.Organization.list()
  });

  const { data: tickets = [], isLoading, refetch } = useQuery({
    queryKey: ["tickets", selectedOrg],
    queryFn: async () => {
      if (selectedOrg === "all") {
        return base44.entities.Ticket.list("-last_activity");
      }
      return base44.entities.Ticket.filter({ organization_id: selectedOrg }, "-last_activity");
    }
  });

  const handleCreateTicket = async (formData) => {
    const org = organizations.find(o => o.id === formData.organization_id);
    if (!org) return;

    const newCounter = (org.ticket_counter || 0) + 1;
    const displayId = generateTicketId(org.prefix, newCounter);

    const ticketData = {
      subject: formData.subject,
      description: formData.description,
      priority: formData.priority,
      category: formData.category,
      organization_id: formData.organization_id,
      client_email: formData.client_email,
      client_name: formData.client_name,
      display_id: displayId,
      organization_prefix: org.prefix,
      last_activity: new Date().toISOString(),
      status: "open",
      attachments: formData.attachments || []
    };

    await base44.entities.Ticket.create(ticketData);

    await base44.entities.Organization.update(org.id, { ticket_counter: newCounter });
    refetch();
  };

  const filteredTickets = tickets.filter(ticket => {
    const isActive = ["open", "pending"].includes(ticket.status);
    const isInactive = ["resolved", "closed"].includes(ticket.status);
    
    if (viewMode === "active" && !isActive) return false;
    if (viewMode === "inactive" && !isInactive) return false;

    if (filters.status !== "all" && ticket.status !== filters.status) return false;
    if (filters.priority !== "all" && ticket.priority !== filters.priority) return false;
    if (filters.organization !== "all" && ticket.organization_id !== filters.organization) return false;
    if (filters.search) {
      const search = filters.search.toLowerCase();
      const matches = 
        ticket.subject?.toLowerCase().includes(search) ||
        ticket.display_id?.toLowerCase().includes(search) ||
        ticket.client_email?.toLowerCase().includes(search);
      if (!matches) return false;
    }
    return true;
  });

  const stats = {
    open: tickets.filter(t => t.status === "open").length,
    pending: tickets.filter(t => t.status === "pending").length,
    resolved: tickets.filter(t => t.status === "resolved").length,
    urgent: tickets.filter(t => t.priority === "urgent" && ["open", "pending"].includes(t.status)).length
  };

  const selectedOrgData = organizations.find(o => o.id === selectedOrg);

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-blue-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            {selectedOrgData?.logo_url && (
              <img 
                src={selectedOrgData.logo_url} 
                alt={selectedOrgData.name} 
                className="h-10 object-contain rounded"
              />
            )}
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-sky-500 to-blue-900 bg-clip-text text-transparent">
                Support Dashboard
              </h1>
              <p className="text-slate-600 text-sm mt-1">Manage tickets across all organisations</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <OrgSwitcher 
              organizations={organizations}
              selectedOrg={selectedOrg}
              onSelect={setSelectedOrg}
            />
            <Button 
              onClick={() => setCreateOpen(true)}
              className="bg-gradient-to-r from-sky-500 to-blue-900 hover:from-sky-600 hover:to-blue-950 shadow-lg shadow-sky-500/30"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Ticket
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatsCard title="Open Tickets" value={stats.open} icon={Ticket} color="sky" />
          <StatsCard title="Pending" value={stats.pending} icon={Clock} color="amber" />
          <StatsCard title="Resolved" value={stats.resolved} icon={CheckCircle} color="emerald" />
          <StatsCard title="Urgent" value={stats.urgent} icon={AlertTriangle} color="rose" />
        </div>

        {/* View Toggle */}
        <div className="flex items-center justify-between mb-4">
          <Tabs value={viewMode} onValueChange={setViewMode}>
            <TabsList className="bg-white/70 backdrop-blur-sm border border-slate-200/50 shadow-sm">
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="inactive">Inactive</TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
            </TabsList>
          </Tabs>
          <span className="text-sm text-slate-500">
            {filteredTickets.length} ticket{filteredTickets.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Filters */}
        <TicketFilters 
          filters={filters}
          setFilters={setFilters}
          organizations={organizations}
          showOrgFilter={selectedOrg === "all"}
        />

        {/* Ticket List */}
        <div className="mt-6 space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="text-center py-12 bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-200/50 shadow-sm">
              <Ticket className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No tickets found</p>
            </div>
          ) : (
            filteredTickets.map(ticket => (
              <TicketCard key={ticket.id} ticket={ticket} />
            ))
          )}
        </div>

        <CreateTicketDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          onSubmit={handleCreateTicket}
          organizations={organizations}
        />
      </div>
    </div>
  );
}