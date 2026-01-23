import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StatusBadge, PriorityBadge } from "./TicketStatusBadge";
import { Clock, User, Building2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function TicketCard({ ticket }) {
  const getInitials = (name) => {
    if (!name) return "?";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  return (
    <Link to={createPageUrl(`TicketDetail?id=${ticket.id}`)}>
      <Card className="p-5 hover:shadow-xl transition-all duration-200 cursor-pointer border-l-4 group bg-white/70 backdrop-blur-sm border-slate-200/50"
            style={{ borderLeftColor: ticket.organization_prefix === 'TE' ? '#3B82F6' : '#8B5CF6' }}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono text-slate-400 bg-slate-50 px-2 py-0.5 rounded">
                {ticket.display_id}
              </span>
              <StatusBadge status={ticket.status} />
              <PriorityBadge priority={ticket.priority} />
            </div>
            
            <h3 className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
              {ticket.subject}
            </h3>
            
            <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
              <div className="flex items-center gap-1">
                <User className="w-3 h-3" />
                <span>{ticket.client_name || ticket.client_email}</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>{formatDistanceToNow(new Date(ticket.last_activity || ticket.created_date), { addSuffix: true })}</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {ticket.assigned_agent_name && (
              <Avatar className="w-8 h-8">
                <AvatarFallback className="bg-blue-100 text-blue-600 text-xs">
                  {getInitials(ticket.assigned_agent_name)}
                </AvatarFallback>
              </Avatar>
            )}
          </div>
        </div>
      </Card>
    </Link>
  );
}