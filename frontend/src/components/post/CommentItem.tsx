import { CornerDownRight, Pen, Trash2, User } from "lucide-react";
import { useState } from "react";
import type { Comment } from "../../api/types";
import { CommentEditor } from "./CommentEditor";

/*
 * Reconstructed from a live capture of the rendered comment list (seeded
 * locally - see PART 1). Two visually distinct comment styles: top-level
 * (w-8 h-8 avatar, p-5 rounded-2xl card) vs. reply (w-7 h-7 avatar, p-4
 * rounded-xl card, indented under a left border). Only one level of
 * nesting was observed (a reply never itself has a "Reply to comment"
 * button) - reproduced as single-level, matching what was actually seen
 * rather than assuming deeper threading exists.
 */

function formatCommentDate(dateStr: string): string {
  const d = new Date(dateStr.replace(" ", "T"));
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${months[d.getMonth()]} ${d.getDate()}, ${String(hours).padStart(2, "0")}:${minutes} ${ampm}`;
}

interface CommentItemProps {
  comment: Comment;
  isReply?: boolean;
  isOwned: boolean;
  authorAvatar: string;
  onReply: (parentId: number, authorName: string, content: string) => Promise<void>;
  onEdit: (commentId: number, content: string) => Promise<void>;
  onDelete: (commentId: number) => Promise<void>;
  children?: React.ReactNode;
}

export function CommentItem({ comment, isReply, isOwned, authorAvatar, onReply, onEdit, onDelete, children }: CommentItemProps) {
  const [showReply, setShowReply] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [replyName, setReplyName] = useState("");
  const [replyContent, setReplyContent] = useState("");
  const [editContent, setEditContent] = useState(comment.content);

  const isAuthor = comment.author_role === "Author";
  const initials = comment.author_name.slice(0, 2);

  async function submitReply(e: React.FormEvent) {
    e.preventDefault();
    if (!replyName.trim() || !replyContent.trim()) return;
    await onReply(comment.id, replyName, replyContent);
    setShowReply(false);
    setReplyName("");
    setReplyContent("");
  }

  async function submitEdit(e: React.FormEvent) {
    e.preventDefault();
    await onEdit(comment.id, editContent);
    setShowEdit(false);
  }

  return (
    <>
      <div
        className={
          isReply
            ? "p-4 rounded-xl bg-[#000000]/5 dark:bg-white/[0.005] border border-card-border/50 flex gap-3"
            : "p-5 rounded-2xl bg-[#000000]/5 dark:bg-white/[0.01] border border-card-border flex gap-4"
        }
      >
        {isAuthor ? (
          <img alt={comment.author_name} className={isReply ? "w-7 h-7 rounded-full object-cover shrink-0" : "w-8 h-8 rounded-full object-cover shrink-0"} src={authorAvatar} />
        ) : (
          <div className={`${isReply ? "w-7 h-7" : "w-8 h-8"} rounded-full bg-card-border text-[10px] font-bold text-ink/50 flex items-center justify-center shrink-0 uppercase`}>
            {initials}
          </div>
        )}
        <div className="flex-1">
          <div className={`flex items-center justify-between gap-2 flex-wrap ${isReply ? "mb-1.5" : "mb-2"}`}>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-ink">{comment.author_name}</span>
              {isAuthor ? (
                <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-400 rounded-full text-[8px] font-semibold tracking-wider uppercase flex items-center gap-0.5">
                  <User size={8} />
                  Author
                </span>
              ) : (
                <span className="px-2 py-0.5 bg-card-border text-ink/40 rounded-full text-[9px] tracking-wider uppercase">{comment.author_role}</span>
              )}
            </div>
            <span className={`text-ink/30 font-mono ${isReply ? "text-[9px]" : "text-[10px]"}`}>{formatCommentDate(comment.created_at)}</span>
          </div>

          {showEdit ? (
            <form onSubmit={submitEdit} className="flex flex-col gap-2 mb-3">
              <CommentEditor value={editContent} onChange={setEditContent} placeholder="Edit your comment..." />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowEdit(false)} className="px-3 py-1.5 border border-card-border hover:border-ink/20 text-[9px] uppercase font-bold tracking-widest rounded-lg text-ink/65 cursor-pointer">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-1.5 bg-[var(--color-accent)] text-[var(--color-bg)] rounded-lg text-[9px] uppercase font-bold tracking-widest hover:opacity-90 transition-opacity cursor-pointer">
                  Save
                </button>
              </div>
            </form>
          ) : (
            <div
              className={`text-xs text-ink/75 leading-relaxed font-light comment-content-html${isReply ? "" : " mb-3"}`}
              dangerouslySetInnerHTML={{ __html: comment.content }}
            />
          )}

          {(!isReply || (isOwned && !showEdit)) && (
            <div className="flex items-center gap-4 mt-2.5 flex-wrap">
              {!isReply && (
                <button
                  onClick={() => setShowReply((v) => !v)}
                  className="text-[10px] tracking-wider uppercase font-semibold text-[var(--color-accent)] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <CornerDownRight size={10} />
                  Reply to comment
                </button>
              )}
              {isOwned && !showEdit && (
                <>
                  <button
                    onClick={() => setShowEdit(true)}
                    className="text-[10px] tracking-wider uppercase font-semibold text-ink/40 hover:text-[var(--color-accent)] hover:underline flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Pen size={10} />
                    Edit
                  </button>
                  <button
                    onClick={() => onDelete(comment.id)}
                    className="text-[10px] tracking-wider uppercase font-semibold text-red-500/60 hover:text-red-400 hover:underline flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Trash2 size={10} />
                    Delete
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {showReply && (
        <div className="pl-6 md:pl-12 mt-2">
          <form onSubmit={submitReply} className="flex flex-col gap-3 bg-[#0a0a0a]/50 dark:bg-white/[0.008] p-4 rounded-xl border border-card-border/85">
            <div className="text-[10px] font-mono text-ink/50 uppercase tracking-widest flex items-center gap-1.5 mb-1">
              <CornerDownRight size={10} className="text-[var(--color-accent)]" />
              <span>Replying to {comment.author_name}</span>
            </div>
            <input
              placeholder="Your display name..."
              required
              value={replyName}
              onChange={(e) => setReplyName(e.target.value)}
              className="bg-[#000000]/5 dark:bg-white/5 border border-card-border rounded-lg px-3 py-2 text-xs text-ink focus:outline-none focus:border-[var(--color-accent)]/50"
              type="text"
            />
            <CommentEditor
              value={replyContent}
              onChange={setReplyContent}
              placeholder="Write your elegant reply here... Use the visual toolbar to format with bold, italic, underline, list blocks, emojis, or attached photos!"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowReply(false)} className="px-3 py-1.5 border border-card-border hover:border-ink/20 text-[9px] uppercase font-bold tracking-widest rounded-lg text-ink/65 cursor-pointer">
                Cancel
              </button>
              <button type="submit" className="px-4 py-1.5 bg-[var(--color-accent)] text-[var(--color-bg)] rounded-lg text-[9px] uppercase font-bold tracking-widest hover:opacity-90 transition-opacity cursor-pointer">
                Send Reply
              </button>
            </div>
          </form>
        </div>
      )}

      {children && <div className="pl-6 md:pl-12 space-y-4 border-l border-card-border/60 ml-4">{children}</div>}
    </>
  );
}
