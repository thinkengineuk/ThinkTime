import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StatusBadge, PriorityBadge } from "./TicketStatusBadge";
import { Clock, User, Building2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";

export default function TicketCard({ ticket }) {
  const { data: organization } = useQuery({
    queryKey: ["organization", ticket.organization_id],
    queryFn: () => base44.entities.Organization.get(ticket.organization_id),
    enabled: !!ticket.organization_id
  });

  const { data: userProfiles = [] } = useQuery({
    queryKey: ["userProfiles"],
    queryFn: () => base44.entities.UserProfile.list()
  });

  // Get client's display name
  const clientProfile = userProfiles.find(p => p.email === ticket.client_email);
  const clientDisplayName = clientProfile?.display_full_name || ticket.client_name || ticket.client_email;

  // Get assigned agent's display name - always prefer profile data over stored name
  const agentProfile = userProfiles.find(p => p.email === ticket.assigned_agent_email);
  const agentDisplayName = agentProfile?.display_full_name || agentProfile?.full_name;

  const getInitials = (name) => {
    if (!name) return "?";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  return (
    <Link to={createPageUrl(`TicketDetail?id=${ticket.id}`)}>
      <Card className="p-4 hover:shadow-lg transition-all duration-200 cursor-pointer group bg-white/70 backdrop-blur-sm border border-slate-200/50"
            style={{ borderLeftColor: organization?.branding_color || '#8B5CF6', borderLeftWidth: '3px' }}>
        <div className="flex items-center gap-4">
          {/* Ticket ID & Badges */}
          <div className="flex items-center gap-2 w-[180px] flex-shrink-0">
            <span className="text-xs font-mono text-slate-600 font-semibold whitespace-nowrap">
              {ticket.display_id}
            </span>
            <StatusBadge status={ticket.status} />
            <PriorityBadge priority={ticket.priority} />
          </div>
          
          {/* Subject */}
          <div className="flex-1 min-w-0 max-w-[280px]">
            <h3 className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
              {ticket.subject}
            </h3>
          </div>
          
          {/* Client */}
          <div className="flex items-center gap-2 w-[160px] flex-shrink-0">
            <Avatar className="w-7 h-7 flex-shrink-0">
              <AvatarFallback className="bg-slate-100 text-slate-600 text-[10px]">
                {getInitials(clientDisplayName)}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm text-slate-600 truncate">{clientDisplayName}</span>
          </div>
          
          {/* Assigned Engineer */}
          <div className="flex items-center gap-2 w-[160px] flex-shrink-0">
            {agentDisplayName ? (
              <>
                <Avatar className="w-7 h-7 flex-shrink-0">
                  <AvatarFallback className="bg-blue-100 text-blue-600 text-[10px]">
                    {getInitials(agentDisplayName)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm text-slate-600 truncate">{agentDisplayName}</span>
              </>
            ) : (
              <span className="text-sm text-slate-400">Unassigned</span>
            )}
          </div>
          
          {/* Last Activity */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500 w-[120px] flex-shrink-0 justify-end">
            <Clock className="w-3.5 h-3.5" />
            <span className="whitespace-nowrap">
              {formatDistanceToNow(new Date(ticket.last_activity || ticket.created_date), { addSuffix: true })}
            </span>
          </div>
        </div>
      </Card>
    </Link>
  );
}