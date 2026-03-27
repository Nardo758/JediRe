import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../services/api.client';
import { MessageSquare, Send, CheckCircle, Reply, ChevronDown, ChevronRight } from 'lucide-react';
import { BT } from '@/components/deal/bloomberg-ui';

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
    <div className={depth > 0 ? 'ml-6 pl-3' : ''} style={depth > 0 ? { borderLeft: `2px solid ${BT.border.subtle}` } : {}}>
      <div className="py-2" style={{ opacity: isResolved ? 0.6 : 1 }}>
        <div className="flex items-start gap-2">
          <div
            className="w-6 h-6 flex items-center justify-center flex-shrink-0 mt-0.5"
            style={{ borderRadius: '50%', background: BT.bg.active, fontSize: '9px', fontWeight: 700, color: BT.text.muted, fontFamily: BT.font.mono }}
          >
            {comment.author_name.split(/[@.\s]/).filter(Boolean).map(s => s[0]).join('').toUpperCase().slice(0, 2)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span style={{ fontSize: '10px', fontWeight: 500, color: BT.text.primary, fontFamily: BT.font.mono }}>{comment.author_name}</span>
              <span style={{ fontSize: '9px', color: BT.text.muted, fontFamily: BT.font.label }}>{timeAgo(comment.created_at)}</span>
              {isResolved && (
                <span className="px-1.5 py-0.5 flex items-center gap-0.5" style={{ fontSize: '9px', fontWeight: 500, color: BT.text.green, background: BT.bg.active, borderRadius: '2px' }}>
                  <CheckCircle size={8} /> Resolved
                </span>
              )}
            </div>
            <p className="mt-0.5 whitespace-pre-wrap" style={{ fontSize: '11px', color: BT.text.secondary, fontFamily: BT.font.label }}>{comment.content}</p>
            {depth === 0 && !isResolved && (
              <div className="flex items-center gap-3 mt-1">
                <button
                  onClick={() => onReply(comment.id)}
                  className="flex items-center gap-0.5"
                  style={{ fontSize: '9px', color: BT.text.muted, background: 'transparent', border: 'none', cursor: 'pointer' }}
                >
                  <Reply size={10} /> Reply
                </button>
                <button
                  onClick={() => onResolve(comment.id)}
                  className="flex items-center gap-0.5"
                  style={{ fontSize: '9px', color: BT.text.muted, background: 'transparent', border: 'none', cursor: 'pointer' }}
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
            className="flex items-center gap-0.5 ml-8 mb-1"
            style={{ fontSize: '9px', color: BT.text.muted, background: 'transparent', border: 'none', cursor: 'pointer' }}
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
    <div className="overflow-hidden" style={{ background: BT.bg.panel, borderRadius: 0, border: `1px solid ${BT.border.medium}` }}>
      <div className="px-4 py-2.5 flex items-center justify-between" style={{ background: BT.bg.header, borderBottom: `1px solid ${BT.border.medium}` }}>
        <div className="flex items-center gap-2">
          <MessageSquare size={14} style={{ color: BT.text.muted }} />
          <span style={{ fontSize: '11px', fontWeight: 600, color: BT.text.primary, fontFamily: BT.font.mono }}>Comments</span>
          {moduleAnchor && (
            <span className="px-1.5 py-0.5" style={{ fontSize: '9px', color: BT.text.muted, background: BT.bg.active, borderRadius: '2px', textTransform: 'capitalize', fontFamily: BT.font.label }}>
              {moduleAnchor.replace(/-/g, ' ')}
            </span>
          )}
          <span className="px-1.5 py-0.5" style={{ fontSize: '10px', background: BT.bg.active, color: BT.text.secondary, borderRadius: '2px', fontWeight: 500, fontFamily: BT.font.mono }}>
            {comments.length}
          </span>
        </div>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={showResolvedToggle}
            onChange={(e) => setShowResolvedToggle(e.target.checked)}
            className="w-3 h-3"
            style={{ borderRadius: '2px' }}
          />
          <span style={{ fontSize: '9px', color: BT.text.muted, fontFamily: BT.font.label }}>Show resolved</span>
        </label>
      </div>

      <div className="max-h-[400px] overflow-y-auto">
        {loading && comments.length === 0 ? (
          <div className="p-4">
            <div className="animate-pulse space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="flex gap-2">
                  <div className="w-6 h-6" style={{ borderRadius: '50%', background: BT.bg.active }} />
                  <div className="flex-1">
                    <div className="h-3 w-3/4 mb-1" style={{ background: BT.bg.active, borderRadius: '2px' }} />
                    <div className="h-8" style={{ background: BT.bg.active, borderRadius: '2px' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : comments.length === 0 ? (
          <div className="p-6 text-center">
            <MessageSquare size={20} style={{ color: BT.text.muted }} className="mx-auto mb-1" />
            <p style={{ fontSize: '10px', color: BT.text.muted, fontFamily: BT.font.label }}>No comments yet</p>
          </div>
        ) : (
          <div className="px-4 py-2">
            {comments.map((comment, idx) => (
              <div key={comment.id} style={idx < comments.length - 1 ? { borderBottom: `1px solid ${BT.border.subtle}` } : {}}>
                <CommentBubble
                  comment={comment}
                  dealId={dealId}
                  onReply={(id) => setReplyingTo(id)}
                  onResolve={handleResolve}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-3" style={{ borderTop: `1px solid ${BT.border.medium}`, background: BT.bg.header }}>
        {replyingTo && (
          <div className="mb-1 flex items-center gap-1" style={{ fontSize: '9px', color: BT.text.cyan }}>
            <Reply size={10} />
            Replying to comment
            <button onClick={() => setReplyingTo(null)} style={{ color: BT.text.muted, marginLeft: '4px', background: 'transparent', border: 'none', cursor: 'pointer' }}>&times;</button>
          </div>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
            placeholder={replyingTo ? 'Write a reply...' : 'Add a comment...'}
            className="flex-1 px-3 py-1.5"
            style={{
              fontSize: '11px',
              fontFamily: BT.font.label,
              border: `1px solid ${BT.border.medium}`,
              borderRadius: 0,
              background: BT.bg.input,
              color: BT.text.primary,
              outline: 'none',
            }}
          />
          <button
            onClick={handleSubmit}
            disabled={submitting || !newContent.trim()}
            className="px-2.5 py-1.5 disabled:opacity-50"
            style={{ background: BT.text.cyan, color: BT.bg.terminal, borderRadius: 0, border: 'none', cursor: 'pointer' }}
          >
            <Send size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}
