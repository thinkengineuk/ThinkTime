import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  Building2, 
  Plus, 
  Trash2, 
  Edit2, 
  Save,
  Loader2,
  Users,
  Palette
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function Settings() {
  const [editingOrg, setEditingOrg] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    name: "",
    prefix: "",
    domain: "",
    support_email: "",
    branding_color: "#3B82F6"
  });

  const { data: organizations = [], isLoading } = useQuery({
    queryKey: ["organizations"],
    queryFn: () => base44.entities.Organization.list()
  });

  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => base44.entities.User.list()
  });

  const createOrg = useMutation({
    mutationFn: (data) => base44.entities.Organization.create({ ...data, ticket_counter: 0 }),
    onSuccess: () => {
      queryClient.invalidateQueries(["organizations"]);
      setDialogOpen(false);
      resetForm();
    }
  });

  const updateOrg = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Organization.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(["organizations"]);
      setDialogOpen(false);
      setEditingOrg(null);
      resetForm();
    }
  });

  const deleteOrg = useMutation({
    mutationFn: (id) => base44.entities.Organization.delete(id),
    onSuccess: () => queryClient.invalidateQueries(["organizations"])
  });

  const resetForm = () => {
    setForm({
      name: "",
      prefix: "",
      domain: "",
      support_email: "",
      branding_color: "#3B82F6"
    });
  };

  const handleEdit = (org) => {
    setEditingOrg(org);
    setForm({
      name: org.name,
      prefix: org.prefix,
      domain: org.domain || "",
      support_email: org.support_email || "",
      branding_color: org.branding_color || "#3B82F6"
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (editingOrg) {
      updateOrg.mutate({ id: editingOrg.id, data: form });
    } else {
      createOrg.mutate(form);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
          <p className="text-slate-500 mt-1">Manage organizations and system configuration</p>
        </div>

        <Tabs defaultValue="organizations">
          <TabsList className="bg-white border mb-6">
            <TabsTrigger value="organizations">
              <Building2 className="w-4 h-4 mr-2" />
              Organizations
            </TabsTrigger>
            <TabsTrigger value="team">
              <Users className="w-4 h-4 mr-2" />
              Team
            </TabsTrigger>
          </TabsList>

          <TabsContent value="organizations">
            <div className="flex justify-end mb-4">
              <Button onClick={() => { resetForm(); setEditingOrg(null); setDialogOpen(true); }}>
                <Plus className="w-4 h-4 mr-2" />
                Add Organization
              </Button>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
              </div>
            ) : organizations.length === 0 ? (
              <Card className="p-12 text-center">
                <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 mb-4">No organizations yet</p>
                <Button onClick={() => setDialogOpen(true)}>
                  Create your first organization
                </Button>
              </Card>
            ) : (
              <div className="space-y-4">
                {organizations.map(org => (
                  <Card key={org.id} className="overflow-hidden">
                    <div 
                      className="h-2"
                      style={{ backgroundColor: org.branding_color || "#3B82F6" }}
                    />
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                          <div 
                            className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg"
                            style={{ backgroundColor: org.branding_color || "#3B82F6" }}
                          >
                            {org.prefix}
                          </div>
                          <div>
                            <h3 className="font-semibold text-slate-900">{org.name}</h3>
                            <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
                              {org.domain && <span>{org.domain}</span>}
                              {org.support_email && <span>{org.support_email}</span>}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">
                            {org.ticket_counter || 0} tickets
                          </Badge>
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(org)}>
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => deleteOrg.mutate(org.id)}
                            className="text-red-500 hover:text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="team">
            <Card>
              <CardHeader>
                <CardTitle>Team Members</CardTitle>
                <CardDescription>Manage agents and administrators</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {users.map(member => (
                    <div key={member.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-medium">
                          {(member.full_name || member.email).split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{member.full_name || member.email}</p>
                          <p className="text-xs text-slate-500">{member.email}</p>
                        </div>
                      </div>
                      <Badge variant={member.user_type === "super_admin" ? "default" : "outline"}>
                        {member.user_type || member.role}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Organization Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-[450px]">
            <DialogHeader>
              <DialogTitle>{editingOrg ? "Edit Organization" : "Add Organization"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Name *</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="ThinkEngine"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Prefix *</Label>
                  <Input
                    value={form.prefix}
                    onChange={(e) => setForm({ ...form, prefix: e.target.value.toUpperCase() })}
                    placeholder="TE"
                    maxLength={3}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Email Domain</Label>
                <Input
                  value={form.domain}
                  onChange={(e) => setForm({ ...form, domain: e.target.value })}
                  placeholder="@thinkengine.co"
                />
              </div>

              <div className="space-y-2">
                <Label>Support Email</Label>
                <Input
                  value={form.support_email}
                  onChange={(e) => setForm({ ...form, support_email: e.target.value })}
                  placeholder="support@thinkengine.co"
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Palette className="w-4 h-4" />
                  Brand Color
                </Label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={form.branding_color}
                    onChange={(e) => setForm({ ...form, branding_color: e.target.value })}
                    className="w-12 h-10 rounded cursor-pointer"
                  />
                  <Input
                    value={form.branding_color}
                    onChange={(e) => setForm({ ...form, branding_color: e.target.value })}
                    className="flex-1"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={!form.name || !form.prefix}>
                  <Save className="w-4 h-4 mr-2" />
                  {editingOrg ? "Update" : "Create"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}