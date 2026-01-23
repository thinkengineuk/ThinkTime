import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Paperclip, Link as LinkIcon, Loader2, Image, FileText } from "lucide-react";

export default function AttachmentUploader({ attachments = [], onAttachmentsChange }) {
  const [uploading, setUploading] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [showLinkInput, setShowLinkInput] = useState(false);

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploading(true);
    const newAttachments = [];

    for (const file of files) {
      try {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        newAttachments.push({
          name: file.name,
          url: file_url,
          type: "file"
        });
      } catch (error) {
        console.error("Upload failed:", error);
      }
    }

    onAttachmentsChange([...attachments, ...newAttachments]);
    setUploading(false);
    e.target.value = "";
  };

  const handleAddLink = () => {
    if (!linkUrl.trim()) return;
    
    const urlObject = {
      name: linkUrl.length > 50 ? linkUrl.substring(0, 47) + "..." : linkUrl,
      url: linkUrl.startsWith("http") ? linkUrl : `https://${linkUrl}`,
      type: "link"
    };
    
    onAttachmentsChange([...attachments, urlObject]);
    setLinkUrl("");
    setShowLinkInput(false);
  };

  const removeAttachment = (index) => {
    onAttachmentsChange(attachments.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <label className="cursor-pointer">
          <input
            type="file"
            multiple
            onChange={handleFileUpload}
            className="hidden"
            accept="image/*,video/*,.pdf,.doc,.docx,.txt"
            disabled={uploading}
          />
          <Button type="button" variant="outline" size="sm" disabled={uploading} asChild>
            <span>
              {uploading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Paperclip className="w-4 h-4 mr-2" />
              )}
              Attach Files
            </span>
          </Button>
        </label>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowLinkInput(!showLinkInput)}
        >
          <LinkIcon className="w-4 h-4 mr-2" />
          Add Link
        </Button>
      </div>

      {showLinkInput && (
        <div className="flex gap-2">
          <Input
            placeholder="https://example.com"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddLink())}
          />
          <Button type="button" size="sm" onClick={handleAddLink}>
            Add
          </Button>
        </div>
      )}

      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {attachments.map((att, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg px-3 py-1.5 text-sm group hover:shadow-md transition-all"
            >
              {att.type === "link" ? (
                <LinkIcon className="w-3.5 h-3.5 text-blue-600" />
              ) : att.name.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                <Image className="w-3.5 h-3.5 text-blue-600" />
              ) : (
                <FileText className="w-3.5 h-3.5 text-blue-600" />
              )}
              <span className="text-slate-700 max-w-[200px] truncate">{att.name}</span>
              <button
                type="button"
                onClick={() => removeAttachment(idx)}
                className="ml-1 text-slate-400 hover:text-red-600 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}