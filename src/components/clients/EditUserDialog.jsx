import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function EditUserDialog({ 
  open, 
  onOpenChange, 
  user, 
  organizations,
  onSave,
  onDelete,
  isSaving,
  isDeleting
}) {
  const [formData, setFormData] = useState({
    full_name: "",
    display_full_name: "",
    company_name: "",
    organization_id: "",
    user_type: "client"
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData({
        full_name: user.full_name || "",
        display_full_name: user.display_full_name || user.full_name || "",
        company_name: user.company_name || "",
        organization_id: user.organization_id || "",
        user_type: user.user_type || "client"
      });
    }
  }, [user]);

  const handleSave = () => {
    onSave(user.id, formData);
  };

  const handleDelete = () => {
    onDelete(user.id);
    setShowDeleteConfirm(false);
  };

  if (!user) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={user.email} disabled className="bg-slate-50" />
            </div>

            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                placeholder="Enter full name"
              />
            </div>

            <div className="space-y-2">
              <Label>User Full Name</Label>
              <Input
                value={formData.display_full_name}
                onChange={(e) => setFormData({ ...formData, display_full_name: e.target.value })}
                placeholder="Enter user full name"
              />
            </div>

            <div className="space-y-2">
              <Label>Company Name</Label>
              <Input
                value={formData.company_name}
                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                placeholder="Enter company name"
              />
            </div>

            <div className="space-y-2">
              <Label>Organization</Label>
              <Select
                value={formData.organization_id}
                onValueChange={(value) => setFormData({ ...formData, organization_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select organization" />
                </SelectTrigger>
                <SelectContent>
                  {organizations.map(org => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>User Type</Label>
              <Select
                value={formData.user_type}
                onValueChange={(value) => setFormData({ ...formData, user_type: value })}
              >
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
          </div>

          <DialogFooter className="flex justify-between">
            <Button
              variant="destructive"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isSaving || isDeleting}
            >
              {isDeleting ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Delete User
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving || isDeleting}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving || isDeleting}>
                {isSaving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Save Changes
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{user.email}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}