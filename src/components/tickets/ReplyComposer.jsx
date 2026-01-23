import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Send, Lock, Loader2 } from "lucide-react";
import AttachmentUploader from "./AttachmentUploader";

export default function ReplyComposer({ 
  onSubmit, 
  isAgent = false,
  ticketStatus 
}) {
  const [body, setBody] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [attachments, setAttachments] = useState([]);

  const handleSubmit = async () => {
    if (!body.trim()) return;
    setLoading(true);
    await onSubmit({ body, isInternal, attachments });
    setBody("");
    setIsInternal(false);
    setAttachments([]);
    setLoading(false);
  };

  if (ticketStatus === "closed") {
    return (
      <div className="bg-slate-50 rounded-xl p-4 text-center text-slate-500">
        This ticket is closed. Reopen it to add new replies.
      </div>
    );
  }

  return (
    <div className={`rounded-xl border ${isInternal ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200'} p-4 transition-colors`}>
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={isInternal ? "Add an internal note (not visible to client)..." : "Type your reply..."}
        rows={4}
        className={`resize-none ${isInternal ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-0'}`}
      />

      <div className="mt-3">
        <AttachmentUploader 
          attachments={attachments}
          onAttachmentsChange={setAttachments}
        />
      </div>

      <div className="flex items-center justify-between mt-3">
        {isAgent ? (
          <div className="flex items-center gap-2">
            <Switch
              id="internal"
              checked={isInternal}
              onCheckedChange={setIsInternal}
            />
            <Label htmlFor="internal" className="text-sm text-slate-600 flex items-center gap-1 cursor-pointer">
              <Lock className="w-3 h-3" />
              Internal Note
            </Label>
          </div>
        ) : (
          <div />
        )}

        <Button onClick={handleSubmit} disabled={!body.trim() || loading}>
          {loading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Send className="w-4 h-4 mr-2" />
          )}
          {isInternal ? "Add Note" : "Send Reply"}
        </Button>
      </div>
    </div>
  );
}