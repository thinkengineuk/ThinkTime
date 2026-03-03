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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

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
  const [clientMode, setClientMode] = useState("existing");
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

  const { data: currentUser } = useQuery({
    queryKey: ["currentUser"],
    queryFn: () => base44.auth.me()
  });

  const isAdmin = currentUser?.role === "admin" || currentUser?.user_type === "super_admin";

  const { data: allUsers = [] } = useQuery({
    queryKey: ["allUsersForTicketCreation"],
    queryFn: () => base44.entities.UserProfile.list(),
    enabled: open && !isClient && isAdmin,
    retry: false
  });

  const getOrgName = (orgId) => {
    const org = organizations?.find(o => o.id === orgId);
    return org ? ` (${org.name})` : '';
  };

  const clientUsers = allUsers.filter(user => !user.user_type || user.user_type === "client");
  const agentUsers = allUsers.filter(user => user.user_type === "agent" || user.user_type === "super_admin");

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
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
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
            <div className="space-y-3">
              <Label>Client *</Label>
              <RadioGroup value={clientMode} onValueChange={setClientMode} className="flex gap-4">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="existing" id="existing" />
                  <Label htmlFor="existing" className="font-normal cursor-pointer">Existing Client</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="new" id="new" />
                  <Label htmlFor="new" className="font-normal cursor-pointer">New Client</Label>
                </div>
              </RadioGroup>

              {clientMode === "existing" ? (
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
                        {client.full_name} ({client.email}){getOrgName(client.organization_id)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="space-y-2">
                  <Input
                    required
                    type="email"
                    placeholder="Client email address"
                    value={form.client_email}
                    onChange={(e) => setForm({ ...form, client_email: e.target.value })}
                  />
                  <Input
                    required
                    placeholder="Client name"
                    value={form.client_name}
                    onChange={(e) => setForm({ ...form, client_name: e.target.value })}
                  />
                </div>
              )}
            </div>
          )}

          {!isClient && (
            <div className="space-y-2">
              <Label>Assigned Engineer</Label>
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
                  <SelectValue placeholder="Auto-assign to Karl Abbott" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Auto-assign to Karl Abbott</SelectItem>
                  {agentUsers.map(agent => (
                    <SelectItem key={agent.email} value={agent.email}>
                      {agent.full_name} ({agent.email}){getOrgName(agent.organization_id)}
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