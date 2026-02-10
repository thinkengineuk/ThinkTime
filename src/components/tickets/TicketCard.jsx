import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StatusBadge, PriorityBadge } from "./TicketStatusBadge";
import { Clock } from "lucide-react";
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

  const { data: user } = useQuery({
    queryKey: ["currentUser"],
    queryFn: () => base44.auth.me()
  });

  const isAgent = user?.user_type === "agent" || user?.user_type === "super_admin" || user?.role === "admin";

  const { data: userProfiles = [] } = useQuery({
    queryKey: ["userProfiles"],
    queryFn: () => base44.entities.UserProfile.list(),
    enabled: !!user && isAgent,
  });

  const { data: clientUserProfile } = useQuery({
    queryKey: ["clientUserProfile", user?.id],
    queryFn: () => base44.entities.UserProfile.filter({ user_id: user.id }).then(res => res[0]),
    enabled: !!user && !isAgent,
  });

  const effectiveUserProfiles = isAgent ? userProfiles : (clientUserProfile ? [clientUserProfile] : []);

  const clientProfile = effectiveUserProfiles.find(p => p.email === ticket.client_email);
  const clientDisplayName = clientProfile?.display_full_name || ticket.client_name || ticket.client_email;

  const getInitials = (name) => {
    if (!name) return "?";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  return (
    <Link to={createPageUrl(`TicketDetail?id=${ticket.id}`)}>
      <Card className="p-3 sm:p-4 hover:shadow-lg transition-all duration-200 cursor-pointer group bg-white/70 backdrop-blur-sm border border-slate-200/50"
            style={{ borderLeftColor: organization?.branding_color || '#8B5CF6', borderLeftWidth: '3px' }}>
        <div className="hidden lg:flex items-center gap-4">
          <div className="flex items-center gap-2 w-[180px] flex-shrink-0">
            <span className="text-xs font-mono text-slate-600 font-semibold whitespace-nowrap">
              {ticket.display_id}
            </span>
            <StatusBadge status={ticket.status} />
            <PriorityBadge priority={ticket.priority} />
          </div>
          
          <div className="flex-1 min-w-0 max-w-[280px]">
            <h3 className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
              {ticket.subject}
            </h3>
          </div>
          
          <div className="flex items-center gap-2 w-[160px] flex-shrink-0">
            <Avatar className="w-7 h-7 flex-shrink-0">
              <AvatarFallback className="bg-slate-100 text-slate-600 text-[10px]">
                {getInitials(clientDisplayName)}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm text-slate-600 truncate">{clientDisplayName}</span>
          </div>
          
          <div className="flex items-center gap-2 w-[160px] flex-shrink-0">
            {ticket.assigned_agent_email ? (
              (() => {
                const assignedAgentProfile = effectiveUserProfiles.find(p => p.email === ticket.assigned_agent_email);
                const displayName = assignedAgentProfile?.display_full_name || assignedAgentProfile?.full_name || ticket.assigned_agent_name;
                if (!displayName) return <span className="text-sm text-slate-400">Unassigned</span>;
                return (
                  <>
                    <Avatar className="w-7 h-7 flex-shrink-0">
                      <AvatarFallback className="bg-blue-100 text-blue-600 text-[10px]">
                        {getInitials(displayName)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm text-slate-600 truncate">{displayName}</span>
                  </>
                );
              })()
            ) : (
              <span className="text-sm text-slate-400">Unassigned</span>
            )}
          </div>
          
          <div className="flex items-center gap-1.5 text-xs text-slate-500 w-[120px] flex-shrink-0 justify-end">
            <Clock className="w-3.5 h-3.5" />
            <span className="whitespace-nowrap">
              {formatDistanceToNow(new Date(ticket.last_activity || ticket.created_date), { addSuffix: true })}
            </span>
          </div>
        </div>

        <div className="lg:hidden space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono text-slate-600 font-semibold">
                  {ticket.display_id}
                </span>
                <StatusBadge status={ticket.status} />
                <PriorityBadge priority={ticket.priority} />
              </div>
              <h3 className="font-semibold text-slate-900 text-sm line-clamp-2 group-hover:text-blue-600 transition-colors">
                {ticket.subject}
              </h3>
            </div>
          </div>
          
          <div className="flex items-center justify-between text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <Avatar className="w-6 h-6 flex-shrink-0">
                <AvatarFallback className="bg-slate-100 text-slate-600 text-[9px]">
                  {getInitials(clientDisplayName)}
                </AvatarFallback>
              </Avatar>
              <span className="truncate max-w-[120px]">{clientDisplayName}</span>
            </div>
            
            <div className="flex items-center gap-1.5">
              <Clock className="w-3 h-3" />
              <span className="whitespace-nowrap">
                {formatDistanceToNow(new Date(ticket.last_activity || ticket.created_date), { addSuffix: true })}
              </span>
            </div>
          </div>

          {ticket.assigned_agent_email && (() => {
            const assignedAgentProfile = effectiveUserProfiles.find(p => p.email === ticket.assigned_agent_email);
            const displayName = assignedAgentProfile?.display_full_name || assignedAgentProfile?.full_name || ticket.assigned_agent_name;
            if (!displayName) return null;
            return (
              <div className="flex items-center gap-2 text-xs text-slate-600 pt-1 border-t border-slate-100">
                <Avatar className="w-5 h-5 flex-shrink-0">
                  <AvatarFallback className="bg-blue-100 text-blue-600 text-[9px]">
                    {getInitials(displayName)}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate">{displayName}</span>
              </div>
            );
          })()}
        </div>
      </Card>
    </Link>
  );
}