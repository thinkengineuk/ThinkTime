import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Megaphone, Plus, Send, ExternalLink, Pencil } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

export default function AnnouncementManager() {
  const { data: user } = useQuery({
    queryKey: ["currentUser"],
    queryFn: () => base44.auth.me()
  });

  const isSuperAdminOrAdmin = user?.user_type === "super_admin" || user?.role === "admin";
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    title: "",
    message: "",
    link_url: "",
    link_text: "Learn more",
    target_audience: "all"
  });
  
  const queryClient = useQueryClient();

  const { data: announcements = [] } = useQuery({
    queryKey: ["announcements"],
    queryFn: () => base44.entities.Announcement.list("-created_date")
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Announcement.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(["announcements"]);
      setDialogOpen(false);
      resetForm();
      toast.success("Announcement created! Click 'Publish' to send to users.");
    }
  });

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.Announcement.update(editingId, data),
    onSuccess: () => {
      queryClient.invalidateQueries(["announcements"]);
      setDialogOpen(false);
      resetForm();
      toast.success("Announcement updated!");
    }
  });

  const publishMutation = useMutation({
    mutationFn: (announcementId) => 
      base44.functions.invoke('broadcastAnnouncement', { announcementId }),
    onSuccess: (response) => {
      queryClient.invalidateQueries(["announcements"]);
      toast.success(`Announcement sent to ${response.data.notificationsSent} users!`);
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || "Failed to publish announcement");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Announcement.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(["announcements"]);
      toast.success("Announcement deleted");
    }
  });

  const resetForm = () => {
    setFormData({
      title: "",
      message: "",
      link_url: "",
      link_text: "Learn more",
      target_audience: "all"
    });
    setEditingId(null);
  };

  const handleOpenEdit = (announcement) => {
    setFormData({
      title: announcement.title,
      message: announcement.message,
      link_url: announcement.link_url || "",
      link_text: announcement.link_text || "Learn more",
      target_audience: announcement.target_audience
    });
    setEditingId(announcement.id);
    setDialogOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.message.trim()) return;
    if (editingId) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-slate-900">Platform Updates</h2>
        </div>
        {isSuperAdminOrAdmin && (
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                New Announcement
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Platform Update" : "Create Platform Update"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div>
                <label className="text-sm font-medium text-slate-700">Title</label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., New Feature: Time Tracking"
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">Message</label>
                <Textarea
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder="Describe what's new..."
                  rows={4}
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">Link (Optional)</label>
                <Input
                  value={formData.link_url}
                  onChange={(e) => setFormData({ ...formData, link_url: e.target.value })}
                  placeholder="https://..."
                  className="mt-1"
                />
              </div>

              {formData.link_url && (
                <div>
                  <label className="text-sm font-medium text-slate-700">Link Text</label>
                  <Input
                    value={formData.link_text}
                    onChange={(e) => setFormData({ ...formData, link_text: e.target.value })}
                    placeholder="Learn more"
                    className="mt-1"
                  />
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-slate-700">Target Audience</label>
                <Select 
                  value={formData.target_audience} 
                  onValueChange={(v) => setFormData({ ...formData, target_audience: v })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Users</SelectItem>
                    <SelectItem value="agents">Agents Only</SelectItem>
                    <SelectItem value="clients">Clients Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button type="submit" className="w-full" disabled={createMutation.isPending || updateMutation.isPending}>
                {editingId ? "Update Announcement" : "Create Announcement"}
              </Button>
            </form>
          </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="space-y-3">
        {announcements.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-8">No announcements yet</p>
        ) : (
          announcements.map(announcement => (
            <Card key={announcement.id} className="p-4 bg-slate-50 border-slate-200">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-slate-900">{announcement.title}</h3>
                    {announcement.is_published ? (
                      <Badge className="bg-green-100 text-green-700">Published</Badge>
                    ) : (
                      <Badge variant="outline">Draft</Badge>
                    )}
                    <Badge variant="outline" className="text-xs">
                      {announcement.target_audience === "all" ? "All Users" : 
                       announcement.target_audience === "agents" ? "Agents" : "Clients"}
                    </Badge>
                  </div>
                  <ReactMarkdown className="text-sm prose prose-sm prose-slate max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 mb-2">
                    {announcement.message}
                  </ReactMarkdown>
                  {announcement.link_url && (
                    <a 
                      href={announcement.link_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                    >
                      {announcement.link_text || "Learn more"}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  {announcement.is_published && (
                    <p className="text-xs text-slate-400 mt-2">
                      Published {format(new Date(announcement.published_at), "MMM d, yyyy 'at' h:mm a")}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {isSuperAdminOrAdmin && !announcement.is_published && (
                    <>
                      <Button 
                        size="sm" 
                        onClick={() => handleOpenEdit(announcement)}
                      >
                        <Pencil className="w-3 h-3 mr-1" />
                        Edit
                      </Button>
                      <Button 
                        size="sm" 
                        onClick={() => publishMutation.mutate(announcement.id)}
                        disabled={publishMutation.isPending}
                      >
                        <Send className="w-3 h-3 mr-1" />
                        Publish
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => deleteMutation.mutate(announcement.id)}
                      >
                        Delete
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </Card>
  );
}