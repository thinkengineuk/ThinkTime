import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  ArrowLeft, 
  User, 
  Calendar, 
  Building2, 
  Tag,
  RefreshCw,
  Mail,
  Loader2
} from "lucide-react";
import { format } from "date-fns";
import { StatusBadge, PriorityBadge } from "@/components/tickets/TicketStatusBadge";
import CommentThread from "@/components/tickets/CommentThread";
import ReplyComposer from "@/components/tickets/ReplyComposer";

export default function TicketDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const ticketId = urlParams.get("id");
  const queryClient = useQueryClient();
  const [resending, setResending] = useState(false);

  const { data: user } = useQuery({
    queryKey: ["currentUser"],
    queryFn: () => base44.auth.me()
  });

  const { data: ticket, isLoading } = useQuery({
    queryKey: ["ticket", ticketId],
    queryFn: async () => {
      const tickets = await base44.entities.Ticket.filter({ id: ticketId });
      return tickets[0];
    },
    enabled: !!ticketId
  });

  const { data: comments = [] } = useQuery({
    queryKey: ["comments", ticketId],
    queryFn: () => base44.entities.Comment.filter({ ticket_id: ticketId }, "created_date"),
    enabled: !!ticketId
  });

  const { data: agents = [] } = useQuery({
    queryKey: ["agents"],
    queryFn: async () => {
      const users = await base44.entities.User.list();
      return users.filter(u => u.user_type === "agent" || u.user_type === "super_admin");
    }
  });

  const updateTicket = useMutation({
    mutationFn: (data) => base44.entities.Ticket.update(ticketId, { 
      ...data, 
      last_activity: new Date().toISOString() 
    }),
    onSuccess: () => queryClient.invalidateQueries(["ticket", ticketId])
  });

  const addComment = useMutation({
    mutationFn: async (data) => {
      const comment = await base44.entities.Comment.create({
        ticket_id: ticketId,
        ticket_display_id: ticket.display_id,
        author_email: user.email,
        author_name: user.full_name,
        author_role: user.user_type === "client" ? "client" : "agent",
        body: data.body,
        is_internal: data.isInternal,
        source: "web",
        attachments: data.attachments || []
      });

      // Send email notification if not internal
      if (!data.isInternal) {
        if (isAgent) {
          // Agent replied, notify client
          await base44.functions.invoke('sendTicketReplyNotification', {
            ticketId,
            displayId: ticket.display_id,
            subject: ticket.subject,
            client_email: ticket.client_email,
            client_name: ticket.client_name,
            agent_name: user.full_name,
            reply_body: data.body
          });
        } else {
          // Client replied, notify agent or admin
          await base44.functions.invoke('sendClientReplyNotification', {
            ticketId,
            displayId: ticket.display_id,
            subject: ticket.subject,
            client_name: user.full_name,
            assigned_agent_email: ticket.assigned_agent_email,
            reply_body: data.body
          });
        }
      }

      return comment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["comments", ticketId]);
      base44.entities.Ticket.update(ticketId, { last_activity: new Date().toISOString() });
    }
  });

  const handleResendEmail = async () => {
    setResending(true);
    const lastAgentComment = [...comments].reverse().find(c => c.author_role === "agent" && !c.is_internal);
    if (lastAgentComment && ticket) {
      await base44.integrations.Core.SendEmail({
        to: ticket.client_email,
        subject: `Re: [${ticket.display_id}] ${ticket.subject}`,
        body: lastAgentComment.body
      });
    }
    setResending(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-500">Ticket not found</p>
      </div>
    );
  }

  const isAgent = user?.user_type === "agent" || user?.user_type === "super_admin" || user?.role === "admin";

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Back Button */}
        <Link 
          to={createPageUrl("Dashboard")}
          className="inline-flex items-center text-sm text-slate-500 hover:text-slate-700 mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Dashboard
        </Link>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Ticket Header */}
            <Card className="p-6 bg-white/70 backdrop-blur-sm border-slate-200/50 shadow-sm">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-mono text-slate-400 bg-slate-100 px-2 py-1 rounded">
                      {ticket.display_id}
                    </span>
                    <StatusBadge status={ticket.status} />
                    <PriorityBadge priority={ticket.priority} />
                  </div>
                  <h1 className="text-xl font-bold text-slate-900">{ticket.subject}</h1>
                </div>
              </div>

              {ticket.attachments?.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium text-slate-600 mb-2">Attachments:</p>
                  <div className="flex flex-wrap gap-2">
                    {ticket.attachments.map((att, idx) => (
                      <a 
                        key={idx}
                        href={att.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-xs bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 border border-blue-200 px-2.5 py-1.5 rounded-lg text-blue-700 font-medium transition-all hover:shadow-sm"
                      >
                        {att.name}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </Card>

            {/* Comments */}
            <Card className="p-6 bg-white/70 backdrop-blur-sm border-slate-200/50 shadow-sm">
              <h2 className="font-semibold text-slate-900 mb-4">Conversation</h2>
              <CommentThread comments={comments} currentUserEmail={user?.email} />
            </Card>

            {/* Reply */}
            <ReplyComposer 
              onSubmit={(data) => addComment.mutate(data)}
              isAgent={isAgent}
              ticketStatus={ticket.status}
            />
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Actions */}
            {isAgent && (
              <Card className="p-4 bg-white/70 backdrop-blur-sm border-slate-200/50 shadow-sm">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Actions</h3>
                <div className="space-y-3">
                  <Select 
                    value={ticket.status} 
                    onValueChange={(v) => updateTicket.mutate({ status: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select 
                    value={ticket.priority} 
                    onValueChange={(v) => updateTicket.mutate({ priority: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low Priority</SelectItem>
                      <SelectItem value="medium">Medium Priority</SelectItem>
                      <SelectItem value="high">High Priority</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select 
                    value={ticket.assigned_agent_email || ""} 
                    onValueChange={(v) => {
                      const agent = agents.find(a => a.email === v);
                      updateTicket.mutate({ 
                        assigned_agent_email: v,
                        assigned_agent_name: agent?.full_name || v
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Assign agent..." />
                    </SelectTrigger>
                    <SelectContent>
                      {agents.map(agent => (
                        <SelectItem key={agent.id} value={agent.email}>
                          {agent.full_name || agent.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={handleResendEmail}
                    disabled={resending}
                  >
                    {resending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4 mr-2" />
                    )}
                    Resend Last Email
                  </Button>
                </div>
              </Card>
            )}

            {/* Details */}
            <Card className="p-4 bg-white/70 backdrop-blur-sm border-slate-200/50 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Details</h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2 text-slate-600">
                  <User className="w-4 h-4 text-slate-400" />
                  <span>{ticket.client_name || ticket.client_email}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <Mail className="w-4 h-4 text-slate-400" />
                  <span>{ticket.client_email}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <Building2 className="w-4 h-4 text-slate-400" />
                  <span>{ticket.organization_prefix}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <Tag className="w-4 h-4 text-slate-400" />
                  <Badge variant="outline">{ticket.category}</Badge>
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span>{format(new Date(ticket.created_date), "MMM d, yyyy 'at' h:mm a")}</span>
                </div>
              </div>
            </Card>

            {/* Assigned Agent */}
            {ticket.assigned_agent_name && (
              <Card className="p-4 bg-white/70 backdrop-blur-sm border-slate-200/50 shadow-sm">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Assigned To</h3>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-medium">
                    {ticket.assigned_agent_name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">{ticket.assigned_agent_name}</p>
                    <p className="text-xs text-slate-500">{ticket.assigned_agent_email}</p>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}