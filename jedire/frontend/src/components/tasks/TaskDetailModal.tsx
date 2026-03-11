import React, { useState } from 'react';
import { Task, PRIORITY_CONFIG, STATUS_CONFIG, CATEGORY_LABELS, TaskStatus } from '../../types/task.types';
import { tasksService } from '../../services/tasks.service';

interface TaskDetailModalProps {
  task: Task;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
  task,
  isOpen,
  onClose,
  onUpdate,
}) => {
  const [editMode, setEditMode] = useState(false);
  const [editedTask, setEditedTask] = useState(task);
  const [newComment, setNewComment] = useState('');

  if (!isOpen) return null;

  const handleSave = () => {
    tasksService.updateTask(task.id, editedTask);
    setEditMode(false);
    onUpdate();
  };

  const handleStatusChange = (status: TaskStatus) => {
    const updates: Partial<Task> = { status };
    if (status === 'complete') {
      updates.completedAt = new Date().toISOString();
    }
    tasksService.updateTask(task.id, updates);
    onUpdate();
  };

  const handleAddComment = () => {
    if (!newComment.trim()) return;
    
    const comment = {
      id: `comment-${Date.now()}`,
      taskId: task.id,
      userId: 'user-1',
      userName: 'Leon D',
      comment: newComment,
      createdAt: new Date().toISOString(),
    };

    tasksService.updateTask(task.id, {
      comments: [...(task.comments || []), comment],
    });
    
    setNewComment('');
    onUpdate();
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatDateShort = (date: string) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-blue-50 to-purple-50">
          <div className="flex-1">
            {editMode ? (
              <input
                type="text"
                value={editedTask.name}
                onChange={(e) => setEditedTask({ ...editedTask, name: e.target.value })}
                className="text-xl font-bold text-gray-900 border border-gray-300 rounded px-2 py-1 w-full"
              />
            ) : (
              <h2 className="text-xl font-bold text-gray-900">{task.name}</h2>
            )}
            <div className="flex items-center gap-3 mt-2">
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                  PRIORITY_CONFIG[task.priority].color
                }`}
              >
                {PRIORITY_CONFIG[task.priority].icon} {PRIORITY_CONFIG[task.priority].label}
              </span>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                  STATUS_CONFIG[task.status].color
                }`}
              >
                {STATUS_CONFIG[task.status].label}
              </span>
              <span className="text-xs text-gray-600">
                {CATEGORY_LABELS[task.category]}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-2"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-3 gap-6">
            {/* Main Content - Left 2/3 */}
            <div className="col-span-2 space-y-6">
              {/* Description */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Description</h3>
                {editMode ? (
                  <textarea
                    value={editedTask.description || ''}
                    onChange={(e) => setEditedTask({ ...editedTask, description: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 min-h-[100px]"
                  />
                ) : (
                  <p className="text-gray-600">{task.description || 'No description provided.'}</p>
                )}
              </div>

              {/* Blocked Reason */}
              {task.status === 'blocked' && task.blockedReason && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-red-700 mb-2 flex items-center gap-2">
                    <span>🚧</span>
                    <span>Blocked</span>
                  </h3>
                  <p className="text-sm text-red-600">{task.blockedReason}</p>
                </div>
              )}

              {/* Comments */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Comments</h3>
                <div className="space-y-3 mb-4">
                  {task.comments.length === 0 ? (
                    <p className="text-sm text-gray-400">No comments yet</p>
                  ) : (
                    task.comments.map((comment) => (
                      <div key={comment.id} className="bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-900">{comment.userName}</span>
                          <span className="text-xs text-gray-500">{formatDate(comment.createdAt)}</span>
                        </div>
                        <p className="text-sm text-gray-700">{comment.comment}</p>
                      </div>
                    ))
                  )}
                </div>
                
                {/* Add Comment */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddComment()}
                    placeholder="Add a comment..."
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <button
                    onClick={handleAddComment}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Attachments */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Attachments</h3>
                {task.attachments.length === 0 ? (
                  <p className="text-sm text-gray-400">No attachments</p>
                ) : (
                  <div className="space-y-2">
                    {task.attachments.map((attachment) => (
                      <div
                        key={attachment.id}
                        className="flex items-center justify-between bg-gray-50 rounded-lg p-3 hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8 4a3 3 0 00-3 3v4a5 5 0 0010 0V7a1 1 0 112 0v4a7 7 0 11-14 0V7a5 5 0 0110 0v4a3 3 0 11-6 0V7a1 1 0 012 0v4a1 1 0 102 0V7a3 3 0 00-3-3z" clipRule="evenodd" />
                          </svg>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{attachment.filename}</p>
                            <p className="text-xs text-gray-500">{formatDateShort(attachment.uploadedAt)}</p>
                          </div>
                        </div>
                        <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                          Download
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar - Right 1/3 */}
            <div className="space-y-6">
              {/* Quick Actions */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Quick Actions</h3>
                <div className="space-y-2">
                  {task.status !== 'complete' && (
                    <button
                      onClick={() => handleStatusChange('complete')}
                      className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                    >
                      ✅ Mark Complete
                    </button>
                  )}
                  {task.status !== 'in_progress' && task.status !== 'complete' && (
                    <button
                      onClick={() => handleStatusChange('in_progress')}
                      className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                    >
                      📝 Start Progress
                    </button>
                  )}
                  {!editMode ? (
                    <button
                      onClick={() => setEditMode(true)}
                      className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium"
                    >
                      ✏️ Edit Task
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={handleSave}
                        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                      >
                        💾 Save Changes
                      </button>
                      <button
                        onClick={() => {
                          setEditMode(false);
                          setEditedTask(task);
                        }}
                        className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium"
                      >
                        ✖️ Cancel
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Details */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Details</h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <span className="text-gray-500">Linked to:</span>
                    <p className="text-gray-900 font-medium mt-1">{task.linkedEntity.name}</p>
                    <p className="text-xs text-gray-500 capitalize">{task.linkedEntity.type}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Assigned to:</span>
                    <p className="text-gray-900 font-medium mt-1">{task.assignedTo.name}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Due date:</span>
                    <p className="text-gray-900 font-medium mt-1">
                      {task.dueDate ? formatDateShort(task.dueDate) : 'No due date'}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">Created:</span>
                    <p className="text-gray-900 font-medium mt-1">{formatDateShort(task.createdAt)}</p>
                  </div>
                  {task.completedAt && (
                    <div>
                      <span className="text-gray-500">Completed:</span>
                      <p className="text-gray-900 font-medium mt-1">{formatDateShort(task.completedAt)}</p>
                    </div>
                  )}
                  <div>
                    <span className="text-gray-500">Source:</span>
                    <p className="text-gray-900 font-medium mt-1 capitalize">{task.source.type.replace('-', ' ')}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
