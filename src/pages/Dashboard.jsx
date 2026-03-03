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
    queryFn: () => base44.auth.me(),
    onSuccess: (data) => {
      console.log("Current User:", data);
    },
    onError: (error) => {
      console.error("Error fetching current user:", error);
    }
  });

  const { data: organizations = [] } = useQuery({
    queryKey: ["organizations"],
    queryFn: () => base44.entities.Organization.list(),
    onSuccess: (data) => {
      console.log("Organizations:", data);
    },
    onError: (error) => {
      console.error("Error fetching organizations:", error);
    }
  });

  const { data: tickets = [], isLoading, refetch } = useQuery({
    queryKey: ["tickets", selectedOrg, user?.email],
    queryFn: async () => {
      console.log("Fetching tickets for selectedOrg:", selectedOrg);
      
      const isAgent = user?.user_type === "agent";
      const isSuperAdmin = user?.user_type === "super_admin" || user?.role === "admin";
      
      let fetchedTickets;
      
      if (selectedOrg === "all") {
        fetchedTickets = await base44.entities.Ticket.list();
      } else {
        fetchedTickets = await base44.entities.Ticket.filter({ organization_id: selectedOrg });
      }
      
      // Filter tickets for agents - they should see tickets assigned to them or where they are a watcher
      if (isAgent && !isSuperAdmin) {
        fetchedTickets = fetchedTickets.filter(ticket => 
          ticket.assigned_agent_email === user.email || 
          (ticket.watchers && ticket.watchers.some(watcher => watcher.email === user.email))
        );
      }
      
      console.log("Fetched tickets:", fetchedTickets);
      return fetchedTickets.sort((a, b) => new Date(b.last_activity) - new Date(a.last_activity));
    },
    enabled: !!user,
    onSuccess: (data) => {
      console.log("Tickets query successful:", data);
    },
    onError: (error) => {
      console.error("Error fetching tickets:", error);
    }
  });

  const handleCreateTicket = async (formData) => {
    try {
      const org = organizations.find(o => o.id === formData.organization_id);
      if (!org) return;

      // Generate unique ticket ID atomically via backend function
      const { data: ticketIdData } = await base44.functions.invoke('generateTicketId', {
        organization_id: formData.organization_id
      });
      const displayId = ticketIdData.display_id;

      // Check if we need to create a new client user
      const allUsers = await base44.entities.User.list();
      const existingClient = allUsers.find(u => u.email === formData.client_email);
      
      if (!existingClient && formData.client_email && formData.client_name) {
        // Create placeholder user for new client
        await base44.entities.User.create({
          email: formData.client_email,
          full_name: formData.client_name,
          user_type: "client",
          organization_id: formData.organization_id,
          role: "user"
        });
        console.log(`✅ Created placeholder user for: ${formData.client_email}`);
      }

      // Auto-assign to karla@thinkengine.co if no agent specified
      let assignedAgentEmail = formData.assigned_agent_email || null;
      let assignedAgentName = formData.assigned_agent_name || null;
      
      if (!assignedAgentEmail || assignedAgentEmail === "") {
        assignedAgentEmail = "karla@thinkengine.co";
        const userProfiles = await base44.entities.UserProfile.list();
        const karlaProfile = userProfiles.find(p => p.email === "karla@thinkengine.co");
        assignedAgentName = karlaProfile?.display_full_name || karlaProfile?.full_name || "Karla Abbott";
      }

      const ticketData = {
        subject: formData.subject,
        description: formData.description,
        priority: formData.priority,
        category: formData.category,
        organization_id: formData.organization_id,
        client_email: formData.client_email,
        client_name: formData.client_name,
        assigned_agent_email: assignedAgentEmail,
        assigned_agent_name: assignedAgentName,
        display_id: displayId,
        organization_prefix: org.prefix,
        last_activity: new Date().toISOString(),
        status: "open",
        attachments: formData.attachments || []
      };

      const newTicket = await base44.entities.Ticket.create(ticketData);

      // Create initial comment with description and attachments
      if (formData.description || formData.attachments?.length > 0) {
        await base44.entities.Comment.create({
          ticket_id: newTicket.id,
          ticket_display_id: displayId,
          author_email: user.email,
          author_name: user.full_name,
          author_role: "agent",
          body: formData.description || "New ticket created",
          is_internal: false,
          source: "web",
          attachments: formData.attachments || []
        });
      }

      // Send notification to client
      await base44.functions.invoke('sendTicketReplyNotification', {
        ticketId: newTicket.id,
        displayId,
        subject: formData.subject,
        client_email: formData.client_email,
        client_name: formData.client_name,
        agent_name: user.full_name,
        reply_body: formData.description || "Your ticket has been created and assigned to our team."
      });

      // Send notification to assigned agent
      if (assignedAgentEmail) {
        await base44.functions.invoke('sendAgentAssignmentNotification', {
          ticketId: newTicket.id,
          displayId,
          subject: formData.subject,
          agent_email: assignedAgentEmail,
          agent_name: assignedAgentName,
          client_name: formData.client_name,
          client_email: formData.client_email,
          priority: formData.priority,
          category: formData.category,
          description: formData.description
        });
      }

      // Send notification to super admins
      await base44.functions.invoke('sendNewTicketNotification', {
        ticketId: newTicket.id,
        displayId,
        subject: formData.subject,
        description: formData.description,
        priority: formData.priority,
        category: formData.category,
        client_name: formData.client_name,
        client_email: formData.client_email,
        assigned_agent_email: assignedAgentEmail
      });

      console.log(`✅ New ticket created: ${displayId} (ID=${newTicket.id}, Org=${org.name}, Status=${newTicket.status})`);
      
      // Reset filters to ensure new ticket is visible
      setSelectedOrg("all");
      setViewMode("active");
      setFilters({
        status: "all",
        priority: "all",
        organization: "all",
        search: ""
      });
      
      refetch();
    } catch (error) {
      console.error("Error creating ticket:", error);
      throw error;
    }
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

  console.log("Filtered tickets for display:", filteredTickets);
  console.log("View mode:", viewMode, "Filters:", filters);

  const stats = {
    open: tickets.filter(t => t.status === "open").length,
    pending: tickets.filter(t => t.status === "pending").length,
    resolved: tickets.filter(t => t.status === "resolved").length,
    urgent: tickets.filter(t => t.priority === "urgent" && ["open", "pending"].includes(t.status)).length
  };

  const selectedOrgData = organizations.find(o => o.id === selectedOrg);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex flex-col gap-4 mb-8">
          <div className="flex items-center gap-3">
            {selectedOrgData?.logo_url && (
              <img 
                src={selectedOrgData.logo_url} 
                alt={selectedOrgData.name} 
                className="h-8 sm:h-10 object-contain rounded"
              />
            )}
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-sky-500 to-blue-900 bg-clip-text text-transparent">
                Support Dashboard
              </h1>
              <p className="text-slate-600 text-xs sm:text-sm mt-1">Manage tickets across all organisations</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 overflow-x-auto">
              <OrgSwitcher 
                organizations={organizations}
                selectedOrg={selectedOrg}
                onSelect={setSelectedOrg}
              />
            </div>
            <Button 
              onClick={() => setCreateOpen(true)}
              className="bg-gradient-to-r from-sky-500 to-blue-900 hover:from-sky-600 hover:to-blue-950 shadow-lg shadow-sky-500/30 whitespace-nowrap"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Ticket
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatsCard title="Open Tickets" value={stats.open} icon={Ticket} color="sky" />
          <StatsCard title="Pending (with client to review)" value={stats.pending} icon={Clock} color="amber" />
          <StatsCard title="Closed" value={stats.resolved} icon={CheckCircle} color="emerald" />
          <StatsCard title="Urgent" value={stats.urgent} icon={AlertTriangle} color="rose" />
        </div>

        {/* View Toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <Tabs value={viewMode} onValueChange={setViewMode} className="w-full sm:w-auto">
            <TabsList className="bg-white/70 backdrop-blur-sm border border-slate-200/50 shadow-sm w-full sm:w-auto">
              <TabsTrigger value="active" className="flex-1 sm:flex-none">Active</TabsTrigger>
              <TabsTrigger value="inactive" className="flex-1 sm:flex-none">Inactive</TabsTrigger>
              <TabsTrigger value="all" className="flex-1 sm:flex-none">All</TabsTrigger>
            </TabsList>
          </Tabs>
          <span className="text-sm text-slate-500 text-right">
            {filteredTickets.length} ticket{filteredTickets.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Filters */}
        <TicketFilters 
          filters={filters}
          setFilters={setFilters}
          organizations={organizations}
          tickets={tickets}
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
              <p className="text-xs text-slate-400 mt-2">Check console for errors</p>
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
  );
}