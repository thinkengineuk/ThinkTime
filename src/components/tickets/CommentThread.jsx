import { useState, useEffect } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatDistanceToNow } from "date-fns";
import { Lock, Mail, Globe, Link as LinkIcon, Image, FileText, Pencil, Trash2, Check, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

const EDIT_WINDOW_MS = 30000;

function CountdownBadge({ createdAt, onExpire }) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    const update = () => {
      const elapsed = Date.now() - new Date(createdAt).getTime();
      const left = Math.max(0, EDIT_WINDOW_MS - elapsed);
      setRemaining(Math.ceil(left / 1000));
      if (left === 0 && onExpire) onExpire();
    };
    update();
    const interval = setInterval(update, 500);
    return () => clearInterval(interval);
  }, [createdAt, onExpire]);

  if (remaining === 0) return null;

  return (
    <span className="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full font-medium">
      {remaining}s
    </span>
  );
}

export default function CommentThread({ comments, currentUserEmail, isAdmin, onCommentUpdated, onCommentDeleted }) {
  const [editingId, setEditingId] = useState(null);
  const [editBody, setEditBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [expiredIds, setExpiredIds] = useState(new Set());

  const { data: userProfiles = [] } = useQuery({
    queryKey: ["userProfiles"],
    queryFn: () => base44.entities.UserProfile.list()
  });

  const getInitials = (name) => {
    if (!name) return "?";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const formatBodyWithMentions = (body) => {
    return body.replace(/@([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
      '<span style="font-weight: 700; color: #2563eb;">@$1</span>'
    );
  };

  const isInEditWindow = (comment) => {
    if (expiredIds.has(comment.id)) return false;
    const elapsed = Date.now() - new Date(comment.created_date).getTime();
    return elapsed < EDIT_WINDOW_MS;
  };

  const canEditOrDelete = (comment) => {
    return comment.author_email === currentUserEmail && isInEditWindow(comment);
  };

  const handleEdit = (comment) => {
    setEditingId(comment.id);
    setEditBody(comment.body);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditBody("");
  };

  const handleSaveEdit = async (comment) => {
    if (!editBody.trim()) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const updated = await base44.entities.Comment.update(comment.id, {
        body: editBody,
        // Reset the scheduled_at so the delayed notification re-fires from this edit
        notification_scheduled_at: now,
        notification_sent: false
      });
      setEditingId(null);
      setEditBody("");
      if (onCommentUpdated) onCommentUpdated(comment.id, editBody, now);
      toast.success("Comment updated");
    } catch (e) {
      toast.error("Failed to update comment");
    }
    setSaving(false);
  };

  const handleDelete = async (comment) => {
    try {
      await base44.entities.Comment.delete(comment.id);
      if (onCommentDeleted) onCommentDeleted(comment.id);
      toast.success("Comment deleted");
    } catch (e) {
      toast.error("Failed to delete comment");
    }
  };

  return (
    <div className="space-y-4">
      {comments.map((comment) => {
        const isCurrentUser = comment.author_email === currentUserEmail;
        const isAgent = comment.author_role === "agent";
        const isInternal = comment.is_internal;
        const canAct = canEditOrDelete(comment);
        const isEditing = editingId === comment.id;

        return (
          <div
            key={comment.id}
            className={`relative ${isInternal ? 'bg-amber-50 border-amber-200' : isAgent ? 'bg-blue-50/50 border-blue-100' : 'bg-white border-slate-100'} border rounded-xl p-4`}
          >
            {isInternal && (
              <div className="absolute top-3 right-3">
                <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200 text-xs">
                  <Lock className="w-3 h-3 mr-1" />
                  Internal Note
                </Badge>
              </div>
            )}

            <div className="flex items-start gap-3">
              <Avatar className={`w-10 h-10 ${isAgent ? 'ring-2 ring-blue-200' : ''}`}>
                <AvatarFallback className={isAgent ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-600'}>
                  {getInitials(comment.author_name || comment.author_email)}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-slate-900">
                    {userProfiles.find(p => p.email === comment.author_email)?.display_full_name || comment.author_name || comment.author_email}
                  </span>
                  {isAgent && (
                    <Badge variant="secondary" className="bg-blue-100 text-blue-700 text-xs">
                      Agent
                    </Badge>
                  )}
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    {comment.source === 'email' ? <Mail className="w-3 h-3" /> : <Globe className="w-3 h-3" />}
                    {formatDistanceToNow(new Date(comment.created_date), { addSuffix: true })}
                  </span>
                  {canAct && !isEditing && (
                    <CountdownBadge
                      createdAt={comment.created_date}
                      onExpire={() => setExpiredIds(prev => new Set([...prev, comment.id]))}
                    />
                  )}
                </div>

                {isEditing ? (
                  <div className="mt-2 space-y-2">
                    <Textarea
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                      rows={3}
                      className="resize-none bg-white border-slate-200 text-sm"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleSaveEdit(comment)} disabled={saving || !editBody.trim()} className="bg-blue-600 hover:bg-blue-700 h-7 text-xs px-3">
                        <Check className="w-3 h-3 mr-1" /> Save
                      </Button>
                      <Button size="sm" variant="ghost" onClick={handleCancelEdit} className="h-7 text-xs px-3">
                        <X className="w-3 h-3 mr-1" /> Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    className="mt-2 text-slate-700 prose prose-sm max-w-none whitespace-pre-wrap"
                    dangerouslySetInnerHTML={{ __html: formatBodyWithMentions(comment.body).replace(/\n/g, '<br/>') }}
                  />
                )}

                {comment.attachments?.length > 0 && !isEditing && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {comment.attachments.map((att, idx) => (
                      <a
                        key={idx}
                        href={att.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-xs bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 border border-blue-200 px-2.5 py-1.5 rounded-lg text-blue-700 font-medium transition-all hover:shadow-sm"
                      >
                        {att.type === "link" ? (
                          <LinkIcon className="w-3.5 h-3.5" />
                        ) : att.name.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                          <Image className="w-3.5 h-3.5" />
                        ) : (
                          <FileText className="w-3.5 h-3.5" />
                        )}
                        {att.name}
                      </a>
                    ))}
                  </div>
                )}

                {canAct && !isEditing && (
                  <div className="flex gap-1 mt-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleEdit(comment)}
                      className="h-6 text-xs px-2 text-slate-500 hover:text-blue-600"
                    >
                      <Pencil className="w-3 h-3 mr-1" /> Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(comment)}
                      className="h-6 text-xs px-2 text-slate-500 hover:text-red-600"
                    >
                      <Trash2 className="w-3 h-3 mr-1" /> Delete
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {comments.length === 0 && (
        <div className="text-center py-8 text-slate-400">
          No comments yet
        </div>
      )}
    </div>
  );
}