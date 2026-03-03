import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Send, Lock, Loader2, AtSign, Clock } from "lucide-react";
import AttachmentUploader from "./AttachmentUploader";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function ReplyComposer({ 
  onSubmit, 
  isAgent = false,
  ticketStatus,
  ticketParticipants = []
}) {
  const [body, setBody] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [detectedNames, setDetectedNames] = useState([]);
  const [showMentionPrompt, setShowMentionPrompt] = useState(false);

  // Detect names in the text
  useEffect(() => {
    if (!body.trim() || ticketParticipants.length === 0) {
      setDetectedNames([]);
      setShowMentionPrompt(false);
      return;
    }

    const detected = [];
    for (const participant of ticketParticipants) {
      const firstName = participant.name.split(' ')[0];
      // Look for first name (case insensitive) not already as @mention
      const regex = new RegExp(`\\b${firstName}\\b(?!@)`, 'gi');
      if (regex.test(body) && !body.includes(`@${firstName}`)) {
        detected.push(participant);
      }
    }

    if (detected.length > 0) {
      setDetectedNames(detected);
      setShowMentionPrompt(true);
    } else {
      setDetectedNames([]);
      setShowMentionPrompt(false);
    }
  }, [body, ticketParticipants]);

  const handleConvertToMentions = () => {
    let updatedBody = body;
    for (const person of detectedNames) {
      const firstName = person.name.split(' ')[0];
      const regex = new RegExp(`\\b${firstName}\\b(?!@)`, 'gi');
      updatedBody = updatedBody.replace(regex, `@${firstName}`);
    }
    setBody(updatedBody);
    setShowMentionPrompt(false);
  };

  const handleSubmit = async () => {
    if (!body.trim()) return;
    setLoading(true);
    await onSubmit({ body, isInternal, attachments });
    setBody("");
    setIsInternal(false);
    setAttachments([]);
    setShowMentionPrompt(false);
    setDetectedNames([]);
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
      {ticketStatus === "pending" && !isInternal && (
        <Alert className="mb-3 bg-orange-50 border-orange-300">
          <Clock className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-sm text-orange-900">
            <strong>Auto-close notice:</strong> This ticket is pending client review. Sending this reply will notify the client that if no response is received within <strong>7 days</strong>, the ticket will be automatically closed.
          </AlertDescription>
        </Alert>
      )}
      {showMentionPrompt && detectedNames.length > 0 && (
        <Alert className="mb-3 bg-blue-50 border-blue-200">
          <AtSign className="h-4 w-4 text-blue-600" />
          <AlertDescription className="flex items-center justify-between">
            <span className="text-sm text-blue-900">
              We detected you mentioned {detectedNames.map(p => p.name.split(' ')[0]).join(', ')}. 
              Convert to @mentions to notify them?
            </span>
            <div className="flex gap-2 ml-2">
              <Button size="sm" variant="ghost" onClick={() => setShowMentionPrompt(false)}>
                Dismiss
              </Button>
              <Button size="sm" onClick={handleConvertToMentions} className="bg-blue-600 hover:bg-blue-700">
                Convert
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={isInternal ? "Add an internal note (not visible to client)..." : "Type your reply... (Use @FirstName to mention someone)"}
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