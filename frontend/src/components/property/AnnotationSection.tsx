import { useState } from 'react';
import { MessageSquare, Send } from 'lucide-react';
import { Annotation } from '@/types';
import { formatDistanceToNow } from 'date-fns';

interface AnnotationSectionProps {
  propertyId: string;
  annotations: Annotation[];
}

export default function AnnotationSection({ propertyId, annotations }: AnnotationSectionProps) {
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setIsSubmitting(true);
    try {
      // API call would go here
      // await propertyAPI.addAnnotation(propertyId, newComment, 'comment');
      setNewComment('');
    } catch (error) {
      console.error('Failed to add annotation:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <MessageSquare className="w-5 h-5 text-gray-600" />
        <h3 className="text-lg font-bold text-gray-900">Comments & Notes</h3>
      </div>

      {/* Add Comment Form */}
      <form onSubmit={handleSubmit} className="card">
        <div className="flex gap-2">
          <input
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment or note..."
            className="input flex-1"
            disabled={isSubmitting}
          />
          <button
            type="submit"
            disabled={!newComment.trim() || isSubmitting}
            className="btn btn-primary px-3"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>

      {/* Annotations List */}
      {annotations.length > 0 ? (
        <div className="space-y-3">
          {annotations.map((annotation) => (
            <div key={annotation.id} className="card bg-gray-50">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-primary-500 text-white rounded-full flex items-center justify-center font-semibold text-sm">
                  {annotation.userName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-sm text-gray-900">
                      {annotation.userName}
                    </span>
                    <span className="text-xs text-gray-500">
                      {formatDistanceToNow(new Date(annotation.createdAt), { addSuffix: true })}
                    </span>
                    <span className={`badge badge-${
                      annotation.type === 'comment' ? 'info' :
                      annotation.type === 'note' ? 'warning' : 'danger'
                    } text-xs`}>
                      {annotation.type}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700">{annotation.text}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card bg-gray-50 text-center py-8">
          <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No comments yet. Be the first to add one!</p>
        </div>
      )}
    </div>
  );
}
