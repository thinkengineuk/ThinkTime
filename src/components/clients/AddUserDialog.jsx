import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";

export default function AddUserDialog({ open, onOpenChange, organizations, onAdd, isSaving, existingProfileEmails = [] }) {
  const [form, setForm] = useState({
    full_name: "",
    display_full_name: "",
    email: "",
    user_type: "client",
    organization_id: "",
    user_id: ""
  });

  // Fetch all Base44 users
  const { data: allUsers = [] } = useQuery({
    queryKey: ["allBase44Users"],
    queryFn: () => base44.entities.User.list(),
    enabled: open
  });

  // Users without a UserProfile yet
  const unassignedUsers = allUsers.filter(u => !existingProfileEmails.includes(u.email));

  const handleSelectUser = (userId) => {
    const user = allUsers.find(u => u.id === userId);
    if (user) {
      setForm(f => ({
        ...f,
        user_id: user.id,
        email: user.email,
        full_name: user.full_name || "",
        display_full_name: user.full_name || ""
      }));
    }
  };

  const handleSubmit = () => {
    if (!form.email || !form.full_name) return;
    onAdd(form);
    setForm({ full_name: "", email: "", user_type: "client", organization_id: "" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add User Profile</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {unassignedUsers.length > 0 && (
            <div className="space-y-1">
              <Label>Select Existing User</Label>
              <Select onValueChange={handleSelectUser}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick a user to pre-fill…" />
                </SelectTrigger>
                <SelectContent>
                  {unassignedUsers.map(u => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.full_name ? `${u.full_name} (${u.email})` : u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-400">Only users without a profile are listed.</p>
            </div>
          )}
          <div className="space-y-1">
            <Label>Full Name *</Label>
            <Input
              placeholder="e.g. Adam Paterson"
              value={form.full_name}
              onChange={(e) => setForm(f => ({ ...f, full_name: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label>Email *</Label>
            <Input
              placeholder="e.g. adam@example.com"
              value={form.email}
              onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label>User Type</Label>
            <Select value={form.user_type} onValueChange={(v) => setForm(f => ({ ...f, user_type: v }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="client">Client</SelectItem>
                <SelectItem value="agent">Engineer</SelectItem>
                <SelectItem value="super_admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Organisation</Label>
            <Select value={form.organization_id} onValueChange={(v) => setForm(f => ({ ...f, organization_id: v }))}>
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
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={isSaving || !form.email || !form.full_name}
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Add User
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}