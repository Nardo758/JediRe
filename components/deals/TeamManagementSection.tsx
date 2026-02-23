'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { 
  Dialog, DialogContent, DialogDescription, DialogFooter, 
  DialogHeader, DialogTitle, DialogTrigger 
} from '@/components/ui/dialog';
import { 
  Loader2, Users, CheckSquare, MessageSquare, Activity, 
  Plus, Mail, Phone, Building2, Edit2, Trash2, UserPlus 
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface TeamManagementProps {
  dealId: string;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  role: string;
  specialization?: string;
  status: string;
  permissions: any;
  created_at: string;
}

interface Task {
  id: string;
  title: string;
  description?: string;
  category?: string;
  assigned_to_id?: string;
  assigned_to_name?: string;
  priority: string;
  status: string;
  due_date?: string;
  progress_percent: number;
  estimated_hours?: number;
  actual_hours?: number;
}

interface Comment {
  id: string;
  author_name: string;
  content: string;
  context_type: string;
  created_at: string;
}

interface ActivityItem {
  id: string;
  user_name: string;
  title: string;
  created_at: string;
}

interface TeamStats {
  total_members: number;
  active_members: number;
  total_tasks: number;
  completed_tasks: number;
  overdue_tasks: number;
  unread_comments: number;
}

interface TeamData {
  members?: TeamMember[];
  tasks?: Task[];
  activity?: ActivityItem[];
  stats?: TeamStats;
}

export function TeamManagementSection({ dealId }: TeamManagementProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<TeamData>({});
  const [activeTab, setActiveTab] = useState('overview');
  
  // Dialog states
  const [memberDialog, setMemberDialog] = useState(false);
  const [taskDialog, setTaskDialog] = useState(false);
  
  // Form states
  const [memberForm, setMemberForm] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    role: 'analyst',
    specialization: '',
  });
  
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    category: 'due-diligence',
    assigned_to_id: '',
    assigned_to_name: '',
    priority: 'medium',
    due_date: '',
    estimated_hours: '',
  });

  useEffect(() => {
    fetchTeamData();
  }, [dealId]);

  const fetchTeamData = async () => {
    try {
      const response = await fetch(`/api/properties/${dealId}/team`);
      if (response.ok) {
        const result = await response.json();
        setData(result);
      }
    } catch (error) {
      console.error('Error fetching team data:', error);
    } finally {
      setLoading(false);
    }
  };

  const inviteMember = async () => {
    try {
      const response = await fetch(`/api/properties/${dealId}/team`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'member', data: memberForm }),
      });

      if (!response.ok) throw new Error('Failed to invite');

      await fetchTeamData();
      toast({ title: 'Team member invited', description: `Invitation sent to ${memberForm.email}` });
      setMemberDialog(false);
      setMemberForm({
        name: '',
        email: '',
        phone: '',
        company: '',
        role: 'analyst',
        specialization: '',
      });
    } catch (error) {
      toast({ 
        title: 'Invite Failed', 
        description: 'Could not send invitation',
        variant: 'destructive'
      });
    }
  };

  const createTask = async () => {
    try {
      const response = await fetch(`/api/properties/${dealId}/team`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          type: 'task', 
          data: {
            ...taskForm,
            estimated_hours: taskForm.estimated_hours ? parseFloat(taskForm.estimated_hours) : null,
          }
        }),
      });

      if (!response.ok) throw new Error('Failed to create');

      await fetchTeamData();
      toast({ title: 'Task created' });
      setTaskDialog(false);
      setTaskForm({
        title: '',
        description: '',
        category: 'due-diligence',
        assigned_to_id: '',
        assigned_to_name: '',
        priority: 'medium',
        due_date: '',
        estimated_hours: '',
      });
    } catch (error) {
      toast({ 
        title: 'Task Creation Failed',
        variant: 'destructive'
      });
    }
  };

  const updateTaskStatus = async (taskId: string, status: string, progressPercent?: number) => {
    try {
      const response = await fetch(`/api/properties/${dealId}/team`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          type: 'task', 
          itemId: taskId, 
          data: { 
            status,
            progress_percent: progressPercent 
          }
        }),
      });

      if (!response.ok) throw new Error('Failed to update');

      await fetchTeamData();
      toast({ title: 'Task updated' });
    } catch (error) {
      toast({ 
        title: 'Update Failed',
        variant: 'destructive'
      });
    }
  };

  const removeMember = async (memberId: string) => {
    try {
      const response = await fetch(`/api/properties/${dealId}/team?type=member&itemId=${memberId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to remove');

      await fetchTeamData();
      toast({ title: 'Team member removed' });
    } catch (error) {
      toast({ 
        title: 'Remove Failed',
        variant: 'destructive'
      });
    }
  };

  const deleteTask = async (taskId: string) => {
    try {
      const response = await fetch(`/api/properties/${dealId}/team?type=task&itemId=${taskId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete');

      await fetchTeamData();
      toast({ title: 'Task deleted' });
    } catch (error) {
      toast({ 
        title: 'Delete Failed',
        variant: 'destructive'
      });
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'destructive';
      case 'high': return 'default';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'outline';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'default';
      case 'in-progress': return 'secondary';
      case 'review': return 'secondary';
      case 'todo': return 'outline';
      case 'cancelled': return 'destructive';
      default: return 'outline';
    }
  };

  const getMemberStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'default';
      case 'pending': return 'secondary';
      case 'inactive': return 'outline';
      case 'removed': return 'destructive';
      default: return 'outline';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const isOverdue = (dateString?: string) => {
    if (!dateString) return false;
    return new Date(dateString) < new Date();
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Team Management</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Team Management
            </CardTitle>
            <CardDescription>
              Collaborate with your team on this deal
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Dialog open={memberDialog} onOpenChange={setMemberDialog}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Invite Member
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invite Team Member</DialogTitle>
                  <DialogDescription>
                    Send an invitation to join this deal
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Name *</Label>
                    <Input
                      value={memberForm.name}
                      onChange={(e) => setMemberForm({ ...memberForm, name: e.target.value })}
                      placeholder="John Smith"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email *</Label>
                    <Input
                      type="email"
                      value={memberForm.email}
                      onChange={(e) => setMemberForm({ ...memberForm, email: e.target.value })}
                      placeholder="john@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input
                      value={memberForm.phone}
                      onChange={(e) => setMemberForm({ ...memberForm, phone: e.target.value })}
                      placeholder="(555) 123-4567"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Company</Label>
                    <Input
                      value={memberForm.company}
                      onChange={(e) => setMemberForm({ ...memberForm, company: e.target.value })}
                      placeholder="ABC Capital"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Role *</Label>
                    <Select
                      value={memberForm.role}
                      onValueChange={(value) => setMemberForm({ ...memberForm, role: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="owner">Owner</SelectItem>
                        <SelectItem value="partner">Partner/Co-Investor</SelectItem>
                        <SelectItem value="analyst">Financial Analyst</SelectItem>
                        <SelectItem value="architect">Architect/Designer</SelectItem>
                        <SelectItem value="contractor">General Contractor</SelectItem>
                        <SelectItem value="consultant">Consultant/Advisor</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Specialization</Label>
                    <Input
                      value={memberForm.specialization}
                      onChange={(e) => setMemberForm({ ...memberForm, specialization: e.target.value })}
                      placeholder="e.g., Financial Modeling"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setMemberDialog(false)}>Cancel</Button>
                  <Button 
                    onClick={inviteMember}
                    disabled={!memberForm.name || !memberForm.email}
                  >
                    Send Invitation
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview" className="flex items-center gap-1">
              <Activity className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="members" className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              Members ({data.stats?.active_members || 0})
            </TabsTrigger>
            <TabsTrigger value="tasks" className="flex items-center gap-1">
              <CheckSquare className="h-4 w-4" />
              Tasks ({data.stats?.total_tasks || 0})
            </TabsTrigger>
            <TabsTrigger value="activity" className="flex items-center gap-1">
              <MessageSquare className="h-4 w-4" />
              Activity
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4 mt-4">
            {/* Team Stats */}
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-3xl font-bold">{data.stats?.active_members || 0}</p>
                    <p className="text-sm text-muted-foreground">Active Members</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-3xl font-bold">{data.stats?.completed_tasks || 0}/{data.stats?.total_tasks || 0}</p>
                    <p className="text-sm text-muted-foreground">Tasks Completed</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-destructive">{data.stats?.overdue_tasks || 0}</p>
                    <p className="text-sm text-muted-foreground">Overdue Tasks</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recent Activity */}
            <div>
              <h3 className="text-lg font-semibold mb-3">Recent Activity</h3>
              <div className="space-y-2">
                {data.activity?.slice(0, 5).map((item) => (
                  <div key={item.id} className="flex items-start gap-3 p-3 border rounded-lg">
                    <Activity className="h-4 w-4 mt-1 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.user_name} • {formatDateTime(item.created_at)}
                      </p>
                    </div>
                  </div>
                ))}
                {(!data.activity || data.activity.length === 0) && (
                  <p className="text-center text-muted-foreground py-4">No activity yet</p>
                )}
              </div>
            </div>

            {/* Urgent Tasks */}
            {data.tasks && data.tasks.filter(t => t.priority === 'urgent' && t.status !== 'completed').length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Badge variant="destructive">Urgent</Badge>
                  Tasks Requiring Attention
                </h3>
                <div className="space-y-2">
                  {data.tasks.filter(t => t.priority === 'urgent' && t.status !== 'completed').map((task) => (
                    <div key={task.id} className="p-3 border border-destructive/50 rounded-lg">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-semibold">{task.title}</h4>
                          <p className="text-sm text-muted-foreground">
                            Assigned to: {task.assigned_to_name || 'Unassigned'}
                            {task.due_date && ` • Due: ${formatDate(task.due_date)}`}
                          </p>
                        </div>
                        <Badge variant={getStatusColor(task.status)}>{task.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          {/* Members Tab */}
          <TabsContent value="members" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              {data.members?.map((member) => (
                <Card key={member.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-semibold">{member.name}</h4>
                        <p className="text-sm text-muted-foreground">{member.role}</p>
                        {member.specialization && (
                          <p className="text-xs text-muted-foreground">{member.specialization}</p>
                        )}
                      </div>
                      <Badge variant={getMemberStatusColor(member.status)}>{member.status}</Badge>
                    </div>
                    
                    {member.company && (
                      <div className="flex items-center gap-2 text-sm mb-1">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        {member.company}
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2 text-sm mb-1">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      {member.email}
                    </div>
                    
                    {member.phone && (
                      <div className="flex items-center gap-2 text-sm mb-3">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        {member.phone}
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-3 border-t">
                      <Button variant="outline" size="sm" className="flex-1">
                        <Edit2 className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => removeMember(member.id)}
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Remove
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {(!data.members || data.members.length === 0) && (
                <p className="text-center text-muted-foreground py-8 col-span-2">
                  No team members yet. Click "Invite Member" to get started.
                </p>
              )}
            </div>
          </TabsContent>

          {/* Tasks Tab */}
          <TabsContent value="tasks" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Select defaultValue="all">
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Tasks</SelectItem>
                    <SelectItem value="todo">To Do</SelectItem>
                    <SelectItem value="in-progress">In Progress</SelectItem>
                    <SelectItem value="review">In Review</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <Dialog open={taskDialog} onOpenChange={setTaskDialog}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Task
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Create Task</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Title *</Label>
                      <Input
                        value={taskForm.title}
                        onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                        placeholder="Task title..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Textarea
                        value={taskForm.description}
                        onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                        placeholder="Task description..."
                        rows={3}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Category</Label>
                        <Select
                          value={taskForm.category}
                          onValueChange={(value) => setTaskForm({ ...taskForm, category: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="due-diligence">Due Diligence</SelectItem>
                            <SelectItem value="design">Design</SelectItem>
                            <SelectItem value="financial">Financial</SelectItem>
                            <SelectItem value="legal">Legal</SelectItem>
                            <SelectItem value="construction">Construction</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Priority</Label>
                        <Select
                          value={taskForm.priority}
                          onValueChange={(value) => setTaskForm({ ...taskForm, priority: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="urgent">Urgent</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Assign To</Label>
                        <Select
                          value={taskForm.assigned_to_id}
                          onValueChange={(value) => {
                            const member = data.members?.find(m => m.id === value);
                            setTaskForm({ 
                              ...taskForm, 
                              assigned_to_id: value,
                              assigned_to_name: member?.name || ''
                            });
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select member" />
                          </SelectTrigger>
                          <SelectContent>
                            {data.members?.map((member) => (
                              <SelectItem key={member.id} value={member.id}>
                                {member.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Due Date</Label>
                        <Input
                          type="date"
                          value={taskForm.due_date}
                          onChange={(e) => setTaskForm({ ...taskForm, due_date: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Estimated Hours</Label>
                      <Input
                        type="number"
                        step="0.5"
                        value={taskForm.estimated_hours}
                        onChange={(e) => setTaskForm({ ...taskForm, estimated_hours: e.target.value })}
                        placeholder="e.g., 8"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setTaskDialog(false)}>Cancel</Button>
                    <Button 
                      onClick={createTask}
                      disabled={!taskForm.title}
                    >
                      Create Task
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <div className="space-y-3">
              {data.tasks?.map((task) => (
                <Card key={task.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold">{task.title}</h4>
                          <Badge variant={getPriorityColor(task.priority)}>{task.priority}</Badge>
                          <Badge variant={getStatusColor(task.status)}>{task.status}</Badge>
                        </div>
                        {task.description && (
                          <p className="text-sm text-muted-foreground mb-2">{task.description}</p>
                        )}
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          {task.assigned_to_name && (
                            <span>Assigned: {task.assigned_to_name}</span>
                          )}
                          {task.due_date && (
                            <span className={isOverdue(task.due_date) ? 'text-destructive font-medium' : ''}>
                              Due: {formatDate(task.due_date)}
                              {isOverdue(task.due_date) && ' (OVERDUE)'}
                            </span>
                          )}
                          {task.category && (
                            <span>Category: {task.category}</span>
                          )}
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => deleteTask(task.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>Progress</span>
                        <span>{task.progress_percent}%</span>
                      </div>
                      <Progress value={task.progress_percent} />
                    </div>

                    {/* Quick Actions */}
                    <div className="flex items-center gap-2 mt-4">
                      {task.status === 'todo' && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => updateTaskStatus(task.id, 'in-progress', 25)}
                        >
                          Start Task
                        </Button>
                      )}
                      {task.status === 'in-progress' && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => updateTaskStatus(task.id, 'review', 90)}
                        >
                          Submit for Review
                        </Button>
                      )}
                      {(task.status === 'review' || task.status === 'in-progress') && (
                        <Button 
                          size="sm"
                          onClick={() => updateTaskStatus(task.id, 'completed', 100)}
                        >
                          Mark Complete
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
              {(!data.tasks || data.tasks.length === 0) && (
                <p className="text-center text-muted-foreground py-8">
                  No tasks yet. Click "Create Task" to get started.
                </p>
              )}
            </div>
          </TabsContent>

          {/* Activity Tab */}
          <TabsContent value="activity" className="space-y-4 mt-4">
            <div className="space-y-2">
              {data.activity?.map((item) => (
                <div key={item.id} className="flex items-start gap-3 p-3 border-l-2 border-primary/20 rounded">
                  <Activity className="h-4 w-4 mt-1 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.user_name} • {formatDateTime(item.created_at)}
                    </p>
                  </div>
                </div>
              ))}
              {(!data.activity || data.activity.length === 0) && (
                <p className="text-center text-muted-foreground py-8">
                  No activity yet.
                </p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
