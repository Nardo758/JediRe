import React, { useState, useEffect } from 'react';
import {
  Loader2, Users, Plus, CheckCircle, Clock, AlertCircle,
  Save, Trash2, MessageSquare, ChevronDown, ChevronRight,
  UserPlus, ClipboardList, X
} from 'lucide-react';
import { apiClient } from '../../../services/api.client';

interface TeamManagementSectionProps {
  deal?: any;
  dealId?: string;
  onUpdate?: () => void;
  onBack?: () => void;
}

interface TeamMember {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  role: string;
  title?: string;
  company?: string;
  permissions?: { read: boolean; write: boolean; admin: boolean };
  status: string;
  created_at: string;
}

interface Task {
  id: string;
  title: string;
  description?: string;
  assigned_to?: string;
  assigned_to_name?: string;
  status: string;
  priority: string;
  due_date?: string;
  tags?: string[];
  completed_at?: string;
  created_at: string;
}

interface Comment {
  id: string;
  author_name: string;
  content: string;
  created_at: string;
}

type ActiveView = 'members' | 'tasks';

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-gray-100 text-gray-600 border-gray-200',
  medium: 'bg-blue-50 text-blue-700 border-blue-200',
  high: 'bg-orange-50 text-orange-700 border-orange-200',
  urgent: 'bg-red-50 text-red-700 border-red-200',
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  pending: <Clock size={14} className="text-gray-400" />,
  in_progress: <Loader2 size={14} className="text-blue-500 animate-spin" />,
  completed: <CheckCircle size={14} className="text-green-500" />,
  cancelled: <X size={14} className="text-red-400" />,
};

const ROLE_OPTIONS = ['Owner', 'Lead Analyst', 'Reviewer', 'External Advisor', 'Developer', 'Broker', 'Attorney', 'Lender'];

export function TeamManagementSection({ deal, dealId: propDealId }: TeamManagementSectionProps) {
  const resolvedDealId = propDealId || deal?.id;
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<ActiveView>('members');
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [taskComments, setTaskComments] = useState<Record<string, Comment[]>>({});
  const [newComment, setNewComment] = useState('');

  const [newMember, setNewMember] = useState({ name: '', email: '', role: 'Reviewer', title: '', company: '' });
  const [newTask, setNewTask] = useState({ title: '', description: '', assigned_to: '', assigned_to_name: '', priority: 'medium', due_date: '' });

  useEffect(() => {
    if (resolvedDealId) {
      Promise.all([fetchMembers(), fetchTasks()]).finally(() => setLoading(false));
    }
  }, [resolvedDealId]);

  const fetchMembers = async () => {
    try {
      const res = await apiClient.get(`/api/v1/deals/${resolvedDealId}/team/members`);
      setMembers(res.data || []);
    } catch (error) {
      console.error('Error fetching members:', error);
    }
  };

  const fetchTasks = async () => {
    try {
      const res = await apiClient.get(`/api/v1/deals/${resolvedDealId}/team/tasks`);
      setTasks(res.data || []);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    }
  };

  const addMember = async () => {
    if (!newMember.name.trim()) return;
    try {
      const res = await apiClient.post(`/api/v1/deals/${resolvedDealId}/team/members`, newMember);
      setMembers(prev => [...prev, res.data]);
      setNewMember({ name: '', email: '', role: 'Reviewer', title: '', company: '' });
      setShowAddMember(false);
    } catch (error) {
      console.error('Error adding member:', error);
    }
  };

  const removeMember = async (memberId: string) => {
    try {
      await apiClient.delete(`/api/v1/deals/${resolvedDealId}/team/members/${memberId}`);
      setMembers(prev => prev.filter(m => m.id !== memberId));
    } catch (error) {
      console.error('Error removing member:', error);
    }
  };

  const addTask = async () => {
    if (!newTask.title.trim()) return;
    try {
      const payload = {
        ...newTask,
        assigned_to: newTask.assigned_to || null,
        assigned_to_name: newTask.assigned_to_name || null,
        due_date: newTask.due_date || null,
      };
      const res = await apiClient.post(`/api/v1/deals/${resolvedDealId}/team/tasks`, payload);
      setTasks(prev => [res.data, ...prev]);
      setNewTask({ title: '', description: '', assigned_to: '', assigned_to_name: '', priority: 'medium', due_date: '' });
      setShowAddTask(false);
    } catch (error) {
      console.error('Error adding task:', error);
    }
  };

  const updateTaskStatus = async (taskId: string, status: string) => {
    try {
      const res = await apiClient.put(`/api/v1/deals/${resolvedDealId}/team/tasks/${taskId}`, { status });
      setTasks(prev => prev.map(t => t.id === taskId ? res.data : t));
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  const deleteTask = async (taskId: string) => {
    try {
      await apiClient.delete(`/api/v1/deals/${resolvedDealId}/team/tasks/${taskId}`);
      setTasks(prev => prev.filter(t => t.id !== taskId));
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

  const fetchComments = async (taskId: string) => {
    try {
      const res = await apiClient.get(`/api/v1/deals/${resolvedDealId}/team/tasks/${taskId}/comments`);
      setTaskComments(prev => ({ ...prev, [taskId]: res.data || [] }));
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  };

  const addComment = async (taskId: string) => {
    if (!newComment.trim()) return;
    try {
      const res = await apiClient.post(`/api/v1/deals/${resolvedDealId}/team/tasks/${taskId}/comments`, {
        author_name: 'You',
        content: newComment,
      });
      setTaskComments(prev => ({
        ...prev,
        [taskId]: [...(prev[taskId] || []), res.data],
      }));
      setNewComment('');
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  const toggleTaskExpand = (taskId: string) => {
    if (expandedTask === taskId) {
      setExpandedTask(null);
    } else {
      setExpandedTask(taskId);
      if (!taskComments[taskId]) fetchComments(taskId);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <span className="ml-3 text-gray-500">Loading team data...</span>
      </div>
    );
  }

  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const activeTasks = tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled').length;

  return (
    <div className="space-y-6 p-1">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Users size={22} className="text-blue-500" />
            Team & Collaboration
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {members.length} members | {activeTasks} active tasks | {completedTasks} completed
          </p>
        </div>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        <button
          onClick={() => setActiveView('members')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeView === 'members' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200'
          }`}
        >
          <UserPlus size={16} />
          Team Members ({members.length})
        </button>
        <button
          onClick={() => setActiveView('tasks')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeView === 'tasks' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200'
          }`}
        >
          <ClipboardList size={16} />
          Tasks ({tasks.length})
        </button>
      </div>

      {activeView === 'members' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowAddMember(!showAddMember)}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Plus size={16} />
              Add Member
            </button>
          </div>

          {showAddMember && (
            <div className="bg-white rounded-xl border border-blue-200 p-4 space-y-3 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-900">New Team Member</h3>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Full Name *"
                  value={newMember.name}
                  onChange={(e) => setNewMember(p => ({ ...p, name: e.target.value }))}
                  className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={newMember.email}
                  onChange={(e) => setNewMember(p => ({ ...p, email: e.target.value }))}
                  className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <select
                  value={newMember.role}
                  onChange={(e) => setNewMember(p => ({ ...p, role: e.target.value }))}
                  className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <input
                  type="text"
                  placeholder="Title"
                  value={newMember.title}
                  onChange={(e) => setNewMember(p => ({ ...p, title: e.target.value }))}
                  className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <input
                  type="text"
                  placeholder="Company"
                  value={newMember.company}
                  onChange={(e) => setNewMember(p => ({ ...p, company: e.target.value }))}
                  className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 text-sm col-span-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowAddMember(false)} className="px-3 py-1.5 text-gray-500 hover:text-gray-900 text-sm">Cancel</button>
                <button onClick={addMember} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm">Add</button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {members.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Users size={40} className="mx-auto mb-3 opacity-40" />
                <p>No team members yet. Add your first team member above.</p>
              </div>
            ) : (
              members.map(member => (
                <div key={member.id} className="flex items-center justify-between bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold text-sm">
                      {member.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{member.name}</p>
                      <p className="text-xs text-gray-500">
                        {member.role}{member.title ? ` · ${member.title}` : ''}{member.company ? ` @ ${member.company}` : ''}
                      </p>
                      {member.email && <p className="text-xs text-gray-400">{member.email}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      member.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {member.status}
                    </span>
                    <button
                      onClick={() => removeMember(member.id)}
                      className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeView === 'tasks' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowAddTask(!showAddTask)}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Plus size={16} />
              Add Task
            </button>
          </div>

          {showAddTask && (
            <div className="bg-white rounded-xl border border-blue-200 p-4 space-y-3 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-900">New Task</h3>
              <input
                type="text"
                placeholder="Task title *"
                value={newTask.title}
                onChange={(e) => setNewTask(p => ({ ...p, title: e.target.value }))}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <textarea
                placeholder="Description"
                value={newTask.description}
                onChange={(e) => setNewTask(p => ({ ...p, description: e.target.value }))}
                rows={2}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <div className="grid grid-cols-3 gap-3">
                <select
                  value={newTask.priority}
                  onChange={(e) => setNewTask(p => ({ ...p, priority: e.target.value }))}
                  className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
                <select
                  value={newTask.assigned_to_name}
                  onChange={(e) => {
                    const member = members.find(m => m.name === e.target.value);
                    setNewTask(p => ({ ...p, assigned_to: member?.id || '', assigned_to_name: e.target.value }));
                  }}
                  className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Unassigned</option>
                  {members.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                </select>
                <input
                  type="date"
                  value={newTask.due_date}
                  onChange={(e) => setNewTask(p => ({ ...p, due_date: e.target.value }))}
                  className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowAddTask(false)} className="px-3 py-1.5 text-gray-500 hover:text-gray-900 text-sm">Cancel</button>
                <button onClick={addTask} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm">Create</button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {tasks.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <ClipboardList size={40} className="mx-auto mb-3 opacity-40" />
                <p>No tasks yet. Create your first task above.</p>
              </div>
            ) : (
              tasks.map(task => (
                <div key={task.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-sm transition-shadow">
                  <div className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3 flex-1">
                      <button onClick={() => toggleTaskExpand(task.id)} className="text-gray-400 hover:text-gray-700">
                        {expandedTask === task.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </button>
                      {STATUS_ICONS[task.status] || STATUS_ICONS.pending}
                      <div className="flex-1">
                        <p className={`text-sm font-medium ${task.status === 'completed' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                          {task.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          {task.assigned_to_name && (
                            <span className="text-xs text-gray-500">{task.assigned_to_name}</span>
                          )}
                          {task.due_date && (
                            <span className="text-xs text-gray-400">{new Date(task.due_date).toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs border ${PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium}`}>
                        {task.priority}
                      </span>
                      <select
                        value={task.status}
                        onChange={(e) => updateTaskStatus(task.id, e.target.value)}
                        className="px-2 py-1 bg-white border border-gray-300 rounded text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="pending">Pending</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                      <button onClick={() => deleteTask(task.id)} className="p-1 text-gray-400 hover:text-red-500">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {expandedTask === task.id && (
                    <div className="border-t border-gray-200 p-4 bg-gray-50">
                      {task.description && (
                        <p className="text-sm text-gray-600 mb-3">{task.description}</p>
                      )}
                      <div className="space-y-2">
                        <h4 className="text-xs font-semibold text-gray-500 flex items-center gap-1">
                          <MessageSquare size={12} />
                          Comments ({taskComments[task.id]?.length || 0})
                        </h4>
                        {(taskComments[task.id] || []).map(comment => (
                          <div key={comment.id} className="p-2 bg-white border border-gray-200 rounded-lg">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-medium text-blue-600">{comment.author_name}</span>
                              <span className="text-xs text-gray-400">{new Date(comment.created_at).toLocaleString()}</span>
                            </div>
                            <p className="text-xs text-gray-600">{comment.content}</p>
                          </div>
                        ))}
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Add a comment..."
                            value={expandedTask === task.id ? newComment : ''}
                            onChange={(e) => setNewComment(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && addComment(task.id)}
                            className="flex-1 px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                          <button
                            onClick={() => addComment(task.id)}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs"
                          >
                            Send
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
