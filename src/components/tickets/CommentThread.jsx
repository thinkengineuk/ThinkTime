import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow, format } from "date-fns";
import { Lock, Mail, Globe, Link as LinkIcon, Image, FileText } from "lucide-react";

export default function CommentThread({ comments, currentUserEmail }) {
  const getInitials = (name) => {
    if (!name) return "?";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  return (
    <div className="space-y-4">
      {comments.map((comment) => {
        const isCurrentUser = comment.author_email === currentUserEmail;
        const isAgent = comment.author_role === "agent";
        const isInternal = comment.is_internal;

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
                    {comment.author_name || comment.author_email}
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
                </div>

                <div 
                  className="mt-2 text-slate-700 prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: comment.body }}
                />

                {comment.attachments?.length > 0 && (
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