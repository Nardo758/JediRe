import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../services/api.client';
import { MessageSquare, Send, CheckCircle, Reply, ChevronDown, ChevronRight } from 'lucide-react';

interface Comment {
  id: string;
  deal_id: string;
  context_type: string;
  author_id: string;
  author_name: string;
  content: string;
  module_anchor: string | null;
  parent_comment_id: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
  replies: Comment[];
}

interface CommentThreadProps {
  dealId: string;
  moduleAnchor?: string;
  showResolved?: boolean;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function CommentBubble({
  comment,
  dealId,
  onReply,
  onResolve,
  depth = 0,
}: {
  comment: Comment;
  dealId: string;
  onReply: (commentId: string) => void;
  onResolve: (commentId: string) => void;
  depth?: number;
}) {
  const [showReplies, setShowReplies] = useState(true);
  const isResolved = !!comment.resolved_at;
  const hasReplies = comment.replies && comment.replies.length > 0;

  return (
    <div className={depth > 0 ? 'ml-6 border-l-2 border-slate-100 pl-3' : ''}>
      <div className={`py-2 ${isResolved ? 'opacity-60' : ''}`}>
        <div className="flex items-start gap-2">
          <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[9px] font-bold text-slate-500 flex-shrink-0 mt-0.5">
            {comment.author_name.split(/[@.\s]/).filter(Boolean).map(s => s[0]).join('').toUpperCase().slice(0, 2)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-700">{comment.author_name}</span>
              <span className="text-[10px] text-slate-400">{timeAgo(comment.created_at)}</span>
              {isResolved && (
                <span className="text-[9px] font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                  <CheckCircle size={8} /> Resolved
                </span>
              )}
            </div>
            <p className="text-xs text-slate-600 mt-0.5 whitespace-pre-wrap">{comment.content}</p>
            {depth === 0 && !isResolved && (
              <div className="flex items-center gap-3 mt-1">
                <button
                  onClick={() => onReply(comment.id)}
                  className="text-[10px] text-slate-400 hover:text-blue-600 flex items-center gap-0.5"
                >
                  <Reply size={10} /> Reply
                </button>
                <button
                  onClick={() => onResolve(comment.id)}
                  className="text-[10px] text-slate-400 hover:text-green-600 flex items-center gap-0.5"
                >
                  <CheckCircle size={10} /> Resolve
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {hasReplies && (
        <>
          <button
            onClick={() => setShowReplies(!showReplies)}
            className="text-[10px] text-slate-400 hover:text-slate-600 flex items-center gap-0.5 ml-8 mb-1"
          >
            {showReplies ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
            {comment.replies.length} {comment.replies.length === 1 ? 'reply' : 'replies'}
          </button>
          {showReplies && comment.replies.map((reply) => (
            <CommentBubble
              key={reply.id}
              comment={reply}
              dealId={dealId}
              onReply={onReply}
              onResolve={onResolve}
              depth={depth + 1}
            />
          ))}
        </>
      )}
    </div>
  );
}

export function CommentThread({ dealId, moduleAnchor, showResolved = false }: CommentThreadProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newContent, setNewContent] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showResolvedToggle, setShowResolvedToggle] = useState(showResolved);

  const fetchComments = useCallback(async () => {
    try {
      setLoading(true);
      let url = `/api/v1/deals/${dealId}/comments?include_resolved=${showResolvedToggle}`;
      if (moduleAnchor) url += `&module_anchor=${encodeURIComponent(moduleAnchor)}`;
      const response = await apiClient.get(url) as any;
      setComments(response?.data || []);
    } catch (err) {
      console.error('Failed to fetch comments:', err);
    } finally {
      setLoading(false);
    }
  }, [dealId, moduleAnchor, showResolvedToggle]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  useEffect(() => {
    const win = window as any;
    const socket = win.__jediSocket;
    if (!socket) return;

    const handleNewComment = (data: any) => {
      if (data.dealId === dealId) {
        fetchComments();
      }
    };

    const handleResolved = (data: any) => {
      if (data.dealId === dealId) {
        fetchComments();
      }
    };

    socket.on('deal:new_comment', handleNewComment);
    socket.on('deal:comment_resolved', handleResolved);

    return () => {
      socket.off('deal:new_comment', handleNewComment);
      socket.off('deal:comment_resolved', handleResolved);
    };
  }, [dealId, fetchComments]);

  const handleSubmit = async () => {
    if (!newContent.trim()) return;
    setSubmitting(true);
    try {
      const payload: any = {
        content: newContent,
      };
      if (moduleAnchor) payload.module_anchor = moduleAnchor;
      if (replyingTo) payload.parent_comment_id = replyingTo;

      const response = await apiClient.post(`/api/v1/deals/${dealId}/comments`, payload) as any;

      const win = window as any;
      const socket = win.__jediSocket;
      if (socket) {
        socket.emit('deal:comment_added', {
          dealId,
          comment: response?.data,
        });
      }

      setNewContent('');
      setReplyingTo(null);
      fetchComments();
    } catch (err) {
      console.error('Failed to submit comment:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResolve = async (commentId: string) => {
    try {
      await apiClient.post(`/api/v1/deals/${dealId}/comments/${commentId}/resolve`);

      const win = window as any;
      const socket = win.__jediSocket;
      if (socket) {
        socket.emit('deal:comment_resolved', { dealId, commentId, resolvedBy: 'me' });
      }

      fetchComments();
    } catch (err) {
      console.error('Failed to resolve comment:', err);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare size={14} className="text-slate-500" />
          <span className="text-sm font-semibold text-slate-700">Comments</span>
          {moduleAnchor && (
            <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded capitalize">
              {moduleAnchor.replace(/-/g, ' ')}
            </span>
          )}
          <span className="text-xs bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full font-medium">
            {comments.length}
          </span>
        </div>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={showResolvedToggle}
            onChange={(e) => setShowResolvedToggle(e.target.checked)}
            className="w-3 h-3 rounded border-slate-300"
          />
          <span className="text-[10px] text-slate-500">Show resolved</span>
        </label>
      </div>

      <div className="max-h-[400px] overflow-y-auto">
        {loading && comments.length === 0 ? (
          <div className="p-4">
            <div className="animate-pulse space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="flex gap-2">
                  <div className="w-6 h-6 bg-slate-200 rounded-full" />
                  <div className="flex-1">
                    <div className="h-3 bg-slate-200 rounded w-3/4 mb-1" />
                    <div className="h-8 bg-slate-200 rounded" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : comments.length === 0 ? (
          <div className="p-6 text-center">
            <MessageSquare size={20} className="text-slate-300 mx-auto mb-1" />
            <p className="text-xs text-slate-500">No comments yet</p>
          </div>
        ) : (
          <div className="px-4 py-2 divide-y divide-slate-100">
            {comments.map((comment) => (
              <CommentBubble
                key={comment.id}
                comment={comment}
                dealId={dealId}
                onReply={(id) => setReplyingTo(id)}
                onResolve={handleResolve}
              />
            ))}
          </div>
        )}
      </div>

      <div className="p-3 border-t border-slate-200 bg-slate-50">
        {replyingTo && (
          <div className="text-[10px] text-blue-600 mb-1 flex items-center gap-1">
            <Reply size={10} />
            Replying to comment
            <button onClick={() => setReplyingTo(null)} className="text-slate-400 hover:text-slate-600 ml-1">&times;</button>
          </div>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
            placeholder={replyingTo ? 'Write a reply...' : 'Add a comment...'}
            className="flex-1 text-xs px-3 py-1.5 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            onClick={handleSubmit}
            disabled={submitting || !newContent.trim()}
            className="px-2.5 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            <Send size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}
