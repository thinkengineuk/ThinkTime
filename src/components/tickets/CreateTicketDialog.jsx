import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, AlertTriangle } from "lucide-react";
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
  const [validationError, setValidationError] = useState("");
  const [form, setForm] = useState({
    subject: "",
    description: "",
    priority: "medium",
    category: "general",
    request_type: "tech",
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

  // Get the selected client's profile to check their service_types
  const selectedClientProfile = clientMode === "existing" 
    ? clientUsers.find(u => u.email === form.client_email) 
    : null;

  const selectedOrg = organizations?.find(o => o.id === form.organization_id);
  const isCogsOrg = selectedOrg?.name?.toLowerCase().includes("cogs");

  // Determine if marketing is allowed for the selected client
  const clientAllowsMarketing = isCogsOrg 
    ? false 
    : clientMode === "new" 
      ? true  // new clients: allow selection, validate after
      : (selectedClientProfile?.service_types || []).includes("marketing");

  const handleClientSelect = (email) => {
    const selectedClient = clientUsers.find(u => u.email === email);
    const clientServiceTypes = selectedClient?.service_types || ["tech"];
    // If current request_type is marketing but client doesn't support it, reset to tech
    const newRequestType = form.request_type === "marketing" && !clientServiceTypes.includes("marketing")
      ? "tech"
      : form.request_type;
    setValidationError("");
    setForm({
      ...form,
      client_email: email,
      client_name: selectedClient ? (selectedClient.display_full_name || selectedClient.full_name) : "",
      request_type: newRequestType
    });
  };

  const handleRequestTypeChange = (v) => {
    setValidationError("");
    if (v === "marketing" && !clientAllowsMarketing && clientMode === "existing" && form.client_email) {
      const clientName = selectedClientProfile?.display_full_name || selectedClientProfile?.full_name || form.client_email;
      setValidationError(`${clientName} does not have marketing services. Please select Tech or choose a different client.`);
      return;
    }
    setForm({ ...form, request_type: v });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate client service type before submitting
    if (!isClient && clientMode === "existing" && form.client_email && selectedClientProfile) {
      const clientServiceTypes = selectedClientProfile.service_types || ["tech"];
      if (!clientServiceTypes.includes(form.request_type)) {
        const clientName = selectedClientProfile.display_full_name || selectedClientProfile.full_name || form.client_email;
        setValidationError(`${clientName} does not receive ${form.request_type} services. Please change the request type or select a different client.`);
        return;
      }
    }

    setLoading(true);
    await onSubmit({ ...form, request_type: isCogsOrg ? "tech" : form.request_type, attachments });
    setLoading(false);
    setValidationError("");
    setForm({
      subject: "",
      description: "",
      priority: "medium",
      category: "general",
      request_type: "tech",
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

          {!isClient && form.organization_id && (
            <div className="space-y-2">
              <Label>Request Type</Label>
              <Select
                value={isCogsOrg ? "tech" : form.request_type}
                onValueChange={handleRequestTypeChange}
                disabled={isCogsOrg}
              >
                <SelectTrigger className={isCogsOrg ? "opacity-60" : ""}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tech">Tech</SelectItem>
                  {!isCogsOrg && (
                    <SelectItem value="marketing" disabled={!clientAllowsMarketing && clientMode === "existing" && !!form.client_email}>
                      Marketing{!clientAllowsMarketing && clientMode === "existing" && form.client_email ? " (not available for selected client)" : ""}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              {isCogsOrg && (
                <p className="text-xs text-slate-500">Cogs AI tickets are always classified as Tech.</p>
              )}
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
                  onValueChange={handleClientSelect}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clientUsers.map(client => (
                      <SelectItem key={client.email} value={client.email}>
                        {client.display_full_name || client.full_name} ({client.email}){getOrgName(client.organization_id)}
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
                     assigned_agent_name: selectedAgent ? (selectedAgent.display_full_name || selectedAgent.full_name) : ""
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
                      {agent.display_full_name || agent.full_name} ({agent.email}){getOrgName(agent.organization_id)}
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

          {validationError && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

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