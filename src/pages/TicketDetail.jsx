import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { 
  ArrowLeft, 
  User, 
  Calendar, 
  Building2, 
  Tag,
  RefreshCw,
  Mail,
  Loader2,
  Trash
} from "lucide-react";
import { format } from "date-fns";
import { StatusBadge, PriorityBadge } from "@/components/tickets/TicketStatusBadge";
import CommentThread from "@/components/tickets/CommentThread";
import ReplyComposer from "@/components/tickets/ReplyComposer";
import TimeTracker from "@/components/tickets/TimeTracker";
import { toast } from "sonner";

export default function TicketDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const ticketId = urlParams.get("id");
  const queryClient = useQueryClient();
  const [resending, setResending] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const navigate = useNavigate();

  const { data: user } = useQuery({
    queryKey: ["currentUser"],
    queryFn: () => base44.auth.me()
  });

  const isAgent = user?.user_type === "agent" || user?.user_type === "super_admin" || user?.role === "admin";

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
    queryFn: () => base44.entities.Comment.filter({ ticket_id: ticketId }, "-created_date"),
    enabled: !!ticketId
  });

  const { data: agents = [] } = useQuery({
    queryKey: ["agents"],
    queryFn: async () => {
      const profiles = await base44.entities.UserProfile.list();
      return profiles.filter(p => ["agent", "super_admin", "admin"].includes(p.user_type));
    },
    enabled: !!user && isAgent
  });

  const { data: userProfiles = [] } = useQuery({
    queryKey: ["userProfiles"],
    queryFn: () => base44.entities.UserProfile.list(),
    enabled: !!user && isAgent,
  });

  const { data: clientUserProfile } = useQuery({
    queryKey: ["clientUserProfile", user?.id],
    queryFn: () => base44.entities.UserProfile.filter({ user_id: user.id }).then(res => res[0] || null),
    enabled: !!user && !isAgent,
  });

  const effectiveUserProfiles = isAgent ? userProfiles : (clientUserProfile ? [clientUserProfile] : []);
  const currentUserProfile = effectiveUserProfiles.find(p => p.user_id === user?.id);
  const currentUserDisplayName = currentUserProfile?.display_full_name || user?.full_name;

  const { data: organizations = [] } = useQuery({
    queryKey: ["organizations"],
    queryFn: () => base44.entities.Organization.list()
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ["allUsers"],
    queryFn: () => base44.entities.UserProfile.list(),
    enabled: !!user && isAgent
  });

  const { data: timeLogs = [] } = useQuery({
    queryKey: ["timeLogs", ticketId],
    queryFn: () => base44.entities.TimeLog.filter({ ticket_id: ticketId }, "-created_date"),
    enabled: !!ticketId && isAgent
  });

  useEffect(() => {
    if (!isLoading && !ticket && ticketId && user) {
      console.log("Ticket not found or unauthorized", { ticketId, userEmail: user?.email });
      toast.error("Ticket not found or you don't have access.");
      if (user?.user_type === "client" || (!user?.user_type && user?.role === "user")) {
        navigate(createPageUrl("ClientPortal"));
      } else {
        navigate(createPageUrl("Dashboard"));
      }
    }
  }, [isLoading, ticket, ticketId, user, navigate]);

  const getOrgName = (orgId) => {
    const org = organizations.find(o => o.id === orgId);
    return org ? ` (${org.name})` : '';
  };

  const clientUsers = allUsers.filter(u => {
    return u.user_type !== "agent" && u.user_type !== "super_admin";
  });

  const allUsersForWatchers = allUsers;

  const updateTicket = useMutation({
    mutationFn: (data) => base44.entities.Ticket.update(ticketId, { 
      ...data, 
      last_activity: new Date().toISOString() 
    }),
    onSuccess: () => queryClient.invalidateQueries(["ticket", ticketId])
  });

  const deleteTicket = useMutation({
    mutationFn: async () => {
      await base44.entities.Ticket.delete(ticketId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["clientTickets"]);
      queryClient.invalidateQueries(["tickets"]);
      toast.success("Ticket deleted successfully!");
      window.location.replace(createPageUrl("Dashboard"));
    },
    onError: (error) => {
      console.error("Error deleting ticket:", error);
      toast.error("Failed to delete ticket. Please try again.");
    }
  });

  const addComment = useMutation({
    mutationFn: async (data) => {
      const scheduledAt = new Date().toISOString();
      const authorRole = user.user_type === "client" ? "client" : "agent";

      const comment = await base44.entities.Comment.create({
        ticket_id: ticketId,
        ticket_display_id: ticket.display_id,
        author_email: user.email,
        author_name: currentUserDisplayName,
        author_role: authorRole,
        body: data.body,
        is_internal: data.isInternal,
        source: "web",
        attachments: data.attachments || [],
        notification_scheduled_at: scheduledAt,
        notification_sent: false
      });

      // Only schedule delayed notification for non-internal comments
      if (!data.isInternal) {
        // Fire-and-forget: the function waits 30s then sends the email
        base44.functions.invoke('scheduleCommentNotification', {
          commentId: comment.id,
          ticketId: ticket.id,
          scheduledAt,
          isPending: ticket.status === 'pending',
          authorRole,
          authorName: currentUserDisplayName
        });
      }

      if (data.body.includes('@')) {
        await base44.functions.invoke('handleMentionNotifications', {
          ticketId,
          commentId: comment.id,
          commentBody: data.body,
          authorName: currentUserDisplayName
        });
      }

      return comment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["comments", ticketId]);
      queryClient.invalidateQueries(["notifications"]);
      base44.entities.Ticket.update(ticketId, { last_activity: new Date().toISOString() });
    }
  });

  const addTimeLog = useMutation({
    mutationFn: async (data) => {
      const timeLog = await base44.entities.TimeLog.create({
        ticket_id: ticketId,
        ticket_display_id: ticket.display_id,
        user_email: user.email,
        user_name: currentUserDisplayName,
        organization_id: ticket.organization_id,
        client_email: ticket.client_email,
        client_name: ticket.client_name,
        start_time: data.start_time.toISOString(),
        end_time: data.end_time.toISOString(),
        suggested_minutes: data.suggested_minutes,
        actual_minutes: data.actual_minutes,
        is_manually_edited: data.is_manually_edited,
        edit_reason: data.edit_reason,
        notes: data.notes
      });
      toast.success(`${data.actual_minutes} minutes logged`);
      return timeLog;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["timeLogs", ticketId]);
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

  if (!ticket && !isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-500">Ticket not found or access denied.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <Link 
          to={createPageUrl(isAgent ? "Dashboard" : "ClientPortal")}
          className="inline-flex items-center text-sm text-slate-500 hover:text-slate-700 mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to {isAgent ? "Dashboard" : "My Tickets"}
        </Link>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
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

            {isAgent && (
              <TimeTracker 
                onSubmit={(data) => addTimeLog.mutate(data)}
                ticketId={ticketId}
                isAgent={isAgent}
              />
            )}

            {isAgent && timeLogs.length > 0 && (
              <Card className="p-6 bg-white/70 backdrop-blur-sm border-slate-200/50 shadow-sm">
                <h2 className="font-semibold text-slate-900 mb-4">Logged Time</h2>
                <div className="space-y-4">
                  {Object.entries(timeLogs.reduce((acc, log) => {
                    const userKey = log.user_email;
                    if (!acc[userKey]) {
                      acc[userKey] = { user_name: log.user_name, total_minutes: 0, logs: [] };
                    }
                    acc[userKey].total_minutes += log.actual_minutes;
                    acc[userKey].logs.push(log);
                    return acc;
                  }, {})).map(([userEmail, { user_name, total_minutes, logs }]) => (
                    <div key={userEmail} className="border-b border-slate-100 pb-4 last:border-b-0 last:pb-0">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium text-slate-700">{user_name}</h3>
                        <span className="text-sm font-semibold text-slate-900">
                          {Math.floor(total_minutes / 60)}h {total_minutes % 60}m
                        </span>
                      </div>
                      <div className="mt-2 space-y-1.5">
                        {logs.map((log, idx) => (
                          <div key={idx} className="text-sm text-slate-600 flex items-start justify-between gap-2">
                            <span className="flex-1">
                              {format(new Date(log.created_date), "MMM d, h:mm a")} - {log.actual_minutes} min
                              {log.notes && <span className="text-slate-500"> • {log.notes}</span>}
                            </span>
                            {log.is_manually_edited && (
                              <Badge variant="outline" className="text-xs">Edited</Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            <Card className="p-6 bg-white/70 backdrop-blur-sm border-slate-200/50 shadow-sm">
              <h2 className="font-semibold text-slate-900 mb-4">Conversation</h2>
              
              <div className="mb-6">
                <ReplyComposer 
                  onSubmit={(data) => addComment.mutate(data)}
                  isAgent={isAgent}
                  ticketStatus={ticket.status}
                  ticketParticipants={(() => {
                    const participants = [];
                    
                    if (ticket.client_email) {
                      const clientProfile = effectiveUserProfiles.find(p => p.email === ticket.client_email);
                      participants.push({
                        email: ticket.client_email,
                        name: clientProfile?.display_full_name || ticket.client_name
                      });
                    }
                    
                    if (ticket.assigned_agent_email) {
                      const agentProfile = effectiveUserProfiles.find(p => p.email === ticket.assigned_agent_email);
                      participants.push({
                        email: ticket.assigned_agent_email,
                        name: agentProfile?.display_full_name || ticket.assigned_agent_name
                      });
                    }
                    
                    if (ticket.watchers) {
                      ticket.watchers.forEach(w => {
                        const watcherProfile = effectiveUserProfiles.find(p => p.email === w.email);
                        participants.push({
                          email: w.email,
                          name: watcherProfile?.display_full_name || w.name
                        });
                      });
                    }
                    
                    if (allUsers) {
                      const admins = allUsers.filter(u => u.user_type === 'super_admin' || u.role === 'admin');
                      admins.forEach(admin => {
                        const adminProfile = effectiveUserProfiles.find(p => p.user_id === admin.id);
                        if (adminProfile && !participants.some(p => p.email === admin.email)) {
                          participants.push({
                            email: admin.email,
                            name: adminProfile.display_full_name || admin.full_name
                          });
                        }
                      });
                    }
                    
                    return participants;
                  })()}
                />
              </div>

              <CommentThread
                comments={comments}
                currentUserEmail={user?.email}
                isAdmin={user?.role === "admin" || user?.user_type === "super_admin"}
                onCommentUpdated={(id, newBody, newScheduledAt) => {
                  // Re-schedule the notification for the edited comment
                  const comment = comments.find(c => c.id === id);
                  if (comment && !comment.is_internal) {
                    base44.functions.invoke('scheduleCommentNotification', {
                      commentId: id,
                      ticketId: ticket.id,
                      scheduledAt: newScheduledAt,
                      isPending: ticket.status === 'pending',
                      authorRole: comment.author_role,
                      authorName: comment.author_name
                    });
                  }
                  queryClient.invalidateQueries(["comments", ticketId]);
                }}
                onCommentDeleted={() => {
                  queryClient.invalidateQueries(["comments", ticketId]);
                }}
              />
            </Card>
          </div>

          <div className="space-y-6">
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
                      <SelectItem value="pending">Pending (with client for review)</SelectItem>
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

                  {(user?.role === "admin" || user?.user_type === "super_admin") && (
                    <Select 
                      value={ticket.assigned_agent_email || ""} 
                      onValueChange={async (v) => {
                        const agent = agents.find(a => a.email === v);
                        const oldAssignedEmail = ticket.assigned_agent_email;
                        
                        const updateData = v === "" ? {
                          assigned_agent_email: null,
                          assigned_agent_name: null
                        } : {
                          assigned_agent_email: v,
                          assigned_agent_name: agent?.display_full_name || agent?.full_name || v
                        };
                        
                        await updateTicket.mutateAsync(updateData);

                        if (v && v !== "" && v !== oldAssignedEmail) {
                          await base44.functions.invoke('sendAgentAssignmentNotification', {
                            ticketId: ticket.id,
                            displayId: ticket.display_id,
                            subject: ticket.subject,
                            agent_email: v,
                            agent_name: agent?.display_full_name || agent?.full_name || v,
                            client_name: ticket.client_name,
                            client_email: ticket.client_email,
                            priority: ticket.priority,
                            category: ticket.category,
                            description: ticket.description
                          });
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Assign engineer..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={null}>Unassigned</SelectItem>
                        {agents.map(agent => (
                          <SelectItem key={agent.id} value={agent.email}>
                            {agent.display_full_name || agent.full_name} ({agent.email}){getOrgName(agent.organization_id)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

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

                  {(user?.role === "admin" || user?.user_type === "super_admin") && (
                    <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" className="w-full">
                          <Trash className="w-4 h-4 mr-2" /> Delete Ticket
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete ticket {ticket.display_id} and all related comments.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteTicket.mutate()}>
                            Continue
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </Card>
            )}

            <Card className="p-4 bg-white/70 backdrop-blur-sm border-slate-200/50 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Details</h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2 text-slate-600">
                  <User className="w-4 h-4 text-slate-400" />
                  <span>{effectiveUserProfiles.find(p => p.email === ticket.client_email)?.display_full_name || ticket.client_name || ticket.client_email}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <Mail className="w-4 h-4 text-slate-400" />
                  <span>{ticket.client_email}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <Building2 className="w-4 h-4 text-slate-400" />
                  <span>{ticket.organization_prefix === 'CA' ? 'Cogs' : ticket.organization_prefix === 'TE' ? 'ThinkEngine' : ticket.organization_prefix}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <Tag className="w-4 h-4 text-slate-400" />
                  <Badge variant="outline">{ticket.category}</Badge>
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span>{format(new Date(ticket.created_date), "MMM d, yyyy 'at' h:mm a")}</span>
                </div>

                {(user?.role === "admin" || user?.user_type === "super_admin") && (
                  <div className="pt-3 border-t border-slate-200">
                    <label className="text-xs text-slate-500 block mb-2">Link to Client</label>
                    <Select
                      value={ticket.client_email || ""}
                      onValueChange={async (newClientEmail) => {
                        if (!newClientEmail) return;
                        
                        const client = clientUsers.find(c => c.email === newClientEmail);
                        if (client) {
                          const displayName = client.display_full_name || client.full_name;
                          await updateTicket.mutateAsync({
                            client_email: client.email,
                            client_name: displayName
                          });
                          
                          await base44.functions.invoke('sendTicketLinkedNotification', {
                            displayId: ticket.display_id,
                            subject: ticket.subject,
                            client_email: client.email,
                            client_name: displayName
                          });
                          
                          toast.success(`Ticket linked to ${displayName}`);
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select client..." />
                      </SelectTrigger>
                      <SelectContent>
                        {clientUsers.map(client => (
                          <SelectItem key={client.id} value={client.email}>
                            {client.display_full_name || client.full_name} ({client.email})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="pt-3 border-t border-slate-200">
                  <label className="text-xs text-slate-500 block mb-2">
                    Watchers {ticket.watchers?.length > 0 && `(${ticket.watchers.length}/5)`}
                  </label>
                  
                  {(user?.role === "admin" || user?.user_type === "super_admin") && (
                    <Select
                      value=""
                      onValueChange={async (watcherEmail) => {
                        if (!watcherEmail) return;
                        
                        const watcher = allUsersForWatchers.find(c => c.email === watcherEmail);
                        const watcherDisplayName = watcher?.display_full_name || watcher?.full_name;
                        
                        if (watcher) {
                          const currentWatchers = ticket.watchers || [];
                          
                          if (currentWatchers.length >= 5) {
                            toast.error("Maximum 5 watchers allowed per ticket");
                            return;
                          }
                          
                          const isAlreadyWatcher = currentWatchers.some(w => w.email === watcherEmail);
                          
                          if (isAlreadyWatcher) {
                            toast.error("This user is already a watcher");
                            return;
                          }
                          
                          await updateTicket.mutateAsync({
                            watchers: [...currentWatchers, { email: watcher.email, name: watcherDisplayName }]
                          });
                          
                          await base44.functions.invoke('sendWatcherAddedNotification', {
                            displayId: ticket.display_id,
                            subject: ticket.subject,
                            watcher_email: watcher.email,
                            watcher_name: watcherDisplayName,
                            client_name: ticket.client_name
                          });
                          
                          toast.success(`Added ${watcherDisplayName} as watcher`);
                        }
                      }}
                      disabled={ticket.watchers?.length >= 5}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={ticket.watchers?.length >= 5 ? "Maximum reached" : "Add watcher..."} />
                      </SelectTrigger>
                      <SelectContent>
                        {allUsersForWatchers
                          .filter(c => c.email !== ticket.client_email)
                          .map(u => (
                            <SelectItem key={u.id} value={u.email}>
                              {u.display_full_name || u.full_name} ({u.email})
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  )}
                  
                  {ticket.watchers?.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {ticket.watchers.map((watcher, idx) => {
                        const watcherProfile = effectiveUserProfiles.find(p => p.email === watcher.email);
                        const displayName = watcherProfile?.display_full_name || watcher.name;
                        return (
                          <div key={idx} className="flex items-center justify-between text-xs bg-slate-50 px-2 py-1.5 rounded">
                            <span className="text-slate-700">{displayName}</span>
                            {(user?.role === "admin" || user?.user_type === "super_admin") && (
                              <button
                                onClick={async () => {
                                  const newWatchers = ticket.watchers.filter(w => w.email !== watcher.email);
                                  await updateTicket.mutateAsync({ watchers: newWatchers });
                                  toast.success(`Removed ${displayName} from watchers`);
                                }}
                                className="text-red-500 hover:text-red-700"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  
                  {!ticket.watchers?.length && (
                    <p className="text-xs text-slate-400 mt-2">No watchers on this ticket</p>
                  )}
                </div>
              </div>
            </Card>

            {ticket.assigned_agent_email && (() => {
              const assignedAgentProfile = effectiveUserProfiles.find(p => p.email === ticket.assigned_agent_email);
              const displayName = assignedAgentProfile?.display_full_name || assignedAgentProfile?.full_name || ticket.assigned_agent_name;
              if (!displayName) return null;
              return (
                <Card className="p-4 bg-white/70 backdrop-blur-sm border-slate-200/50 shadow-sm">
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">Assigned Engineer</h3>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-medium">
                      {displayName.split(" ").map(n => n[0]).join("").slice(0, 2)}
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{displayName}</p>
                      <p className="text-xs text-slate-500">{ticket.assigned_agent_email}</p>
                    </div>
                  </div>
                </Card>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}