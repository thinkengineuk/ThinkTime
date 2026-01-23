import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import AttachmentUploader from "./AttachmentUploader";
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Input } from "@/components/ui/input";

export default function CreateTicketDialog({ 
  open, 
  onOpenChange, 
  onSubmit, 
  organizations,
  defaultOrgId,
  isClient = false,
  clientEmail = ""
}) {
  const [loading, setLoading] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [form, setForm] = useState({
    subject: "",
    description: "",
    priority: "medium",
    category: "general",
    organization_id: defaultOrgId || "",
    client_email: clientEmail,
    client_name: "",
    assigned_agent_email: "",
    assigned_agent_name: ""
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ["allUsersForTicketCreation"],
    queryFn: () => base44.entities.User.list(),
    enabled: !isClient
  });

  const clientUsers = allUsers.filter(user => user.user_type === "client");
  const agentUsers = allUsers.filter(user => user.user_type === "agent" || user.user_type === "super_admin" || user.role === "admin");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    await onSubmit({ ...form, attachments });
    setLoading(false);
    setForm({
      subject: "",
      description: "",
      priority: "medium",
      category: "general",
      organization_id: defaultOrgId || "",
      client_email: clientEmail,
      client_name: "",
      assigned_agent_email: "",
      assigned_agent_name: ""
    });
    setAttachments([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-xl">Create New Ticket</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {!isClient && organizations?.length > 0 && (
            <div className="space-y-2">
              <Label>Organisation</Label>
              <Select 
                value={form.organization_id} 
                onValueChange={(v) => setForm({ ...form, organization_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select organisation" />
                </SelectTrigger>
                <SelectContent>
                  {organizations.map(org => (
                    <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {!isClient && (
            <div className="space-y-2">
              <Label>Client *</Label>
              <Select
                required
                value={form.client_email}
                onValueChange={(email) => {
                  const selectedClient = clientUsers.find(user => user.email === email);
                  setForm({
                    ...form,
                    client_email: email,
                    client_name: selectedClient ? selectedClient.full_name : ""
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent>
                  {clientUsers.map(client => (
                    <SelectItem key={client.email} value={client.email}>
                      {client.full_name || client.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {!isClient && (
            <div className="space-y-2">
              <Label>Assigned Agent</Label>
              <Select
                value={form.assigned_agent_email}
                onValueChange={(email) => {
                  const selectedAgent = agentUsers.find(user => user.email === email);
                  setForm({
                    ...form,
                    assigned_agent_email: email,
                    assigned_agent_name: selectedAgent ? selectedAgent.full_name : ""
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select agent (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Unassigned</SelectItem>
                  {agentUsers.map(agent => (
                    <SelectItem key={agent.email} value={agent.email}>
                      {agent.full_name || agent.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Subject *</Label>
            <Input
              required
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              placeholder="Brief description of the issue"
            />
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Provide details about your request..."
              rows={4}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="technical">Technical</SelectItem>
                  <SelectItem value="billing">Billing</SelectItem>
                  <SelectItem value="feature_request">Feature Request</SelectItem>
                  <SelectItem value="bug_report">Bug Report</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Attachments</Label>
            <AttachmentUploader 
              attachments={attachments}
              onAttachmentsChange={setAttachments}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Ticket
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}