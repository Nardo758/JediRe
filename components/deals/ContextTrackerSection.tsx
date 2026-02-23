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
import { 
  Dialog, DialogContent, DialogDescription, DialogFooter, 
  DialogHeader, DialogTitle, DialogTrigger 
} from '@/components/ui/dialog';
import { 
  Loader2, FileText, Activity, Users, FolderOpen, Calendar, 
  CheckCircle2, AlertTriangle, Plus, Pin, Edit2, Trash2, Search 
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface ContextTrackerProps {
  dealId: string;
}

interface Note {
  id: string;
  title?: string;
  content: string;
  tags?: string[];
  pinned: boolean;
  author_name: string;
  created_at: string;
}

interface Contact {
  id: string;
  name: string;
  role: string;
  company?: string;
  email?: string;
  phone?: string;
  is_primary: boolean;
}

interface ActivityItem {
  id: string;
  title: string;
  activity_type: string;
  created_at: string;
  user_name?: string;
}

interface KeyDate {
  id: string;
  title: string;
  date: string;
  date_type: string;
  status: string;
}

interface Decision {
  id: string;
  title: string;
  status: string;
  decision_date?: string;
  decided_by?: string[];
}

interface Risk {
  id: string;
  title: string;
  severity: string;
  status: string;
  impact: string;
  likelihood: string;
}

interface ContextData {
  notes?: Note[];
  activity?: ActivityItem[];
  contacts?: Contact[];
  dates?: KeyDate[];
  decisions?: Decision[];
  risks?: Risk[];
}

export function ContextTrackerSection({ dealId }: ContextTrackerProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ContextData>({});
  const [activeTab, setActiveTab] = useState('notes');
  
  // Dialog states
  const [noteDialog, setNoteDialog] = useState(false);
  const [contactDialog, setContactDialog] = useState(false);
  const [dateDialog, setDateDialog] = useState(false);
  const [decisionDialog, setDecisionDialog] = useState(false);
  const [riskDialog, setRiskDialog] = useState(false);

  // Form states
  const [noteForm, setNoteForm] = useState({ title: '', content: '', tags: '' });
  const [contactForm, setContactForm] = useState({ name: '', role: '', company: '', email: '', phone: '' });
  const [dateForm, setDateForm] = useState({ title: '', date: '', date_type: 'deadline', description: '' });
  const [decisionForm, setDecisionForm] = useState({ title: '', status: 'pending', rationale: '' });
  const [riskForm, setRiskForm] = useState({ 
    title: '', 
    description: '', 
    impact: 'medium', 
    likelihood: 'medium',
    mitigation_strategy: ''
  });

  useEffect(() => {
    fetchContextData();
  }, [dealId]);

  const fetchContextData = async () => {
    try {
      const response = await fetch(`/api/properties/${dealId}/context`);
      if (response.ok) {
        const result = await response.json();
        setData(result);
      }
    } catch (error) {
      console.error('Error fetching context data:', error);
    } finally {
      setLoading(false);
    }
  };

  const createItem = async (type: string, itemData: any) => {
    try {
      const response = await fetch(`/api/properties/${dealId}/context`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          type, 
          data: {
            ...itemData,
            author_id: 'user-123', // TODO: Get from auth
            author_name: 'Current User'
          }
        }),
      });

      if (!response.ok) throw new Error('Failed to create');

      await fetchContextData();
      toast({ title: `${type.charAt(0).toUpperCase() + type.slice(1)} created successfully` });
      
      // Close dialog and reset form
      switch(type) {
        case 'note':
          setNoteDialog(false);
          setNoteForm({ title: '', content: '', tags: '' });
          break;
        case 'contact':
          setContactDialog(false);
          setContactForm({ name: '', role: '', company: '', email: '', phone: '' });
          break;
        case 'date':
          setDateDialog(false);
          setDateForm({ title: '', date: '', date_type: 'deadline', description: '' });
          break;
        case 'decision':
          setDecisionDialog(false);
          setDecisionForm({ title: '', status: 'pending', rationale: '' });
          break;
        case 'risk':
          setRiskDialog(false);
          setRiskForm({ title: '', description: '', impact: 'medium', likelihood: 'medium', mitigation_strategy: '' });
          break;
      }
    } catch (error) {
      toast({ 
        title: 'Creation Failed', 
        description: 'Could not create item',
        variant: 'destructive'
      });
    }
  };

  const deleteItem = async (type: string, itemId: string) => {
    try {
      const response = await fetch(`/api/properties/${dealId}/context?type=${type}&itemId=${itemId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete');

      await fetchContextData();
      toast({ title: `${type.charAt(0).toUpperCase() + type.slice(1)} deleted` });
    } catch (error) {
      toast({ 
        title: 'Delete Failed',
        variant: 'destructive'
      });
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      case 'low': return 'default';
      default: return 'outline';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'default';
      case 'completed': return 'default';
      case 'active': return 'default';
      case 'upcoming': return 'secondary';
      case 'pending': return 'secondary';
      case 'rejected': return 'destructive';
      case 'missed': return 'destructive';
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

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Context Tracker</CardTitle>
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
              <FileText className="h-5 w-5" />
              Context Tracker
            </CardTitle>
            <CardDescription>
              All deal activity, decisions, and context in one place
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-8">
            <TabsTrigger value="notes" className="flex items-center gap-1">
              <FileText className="h-4 w-4" />
              Notes
            </TabsTrigger>
            <TabsTrigger value="activity" className="flex items-center gap-1">
              <Activity className="h-4 w-4" />
              Activity
            </TabsTrigger>
            <TabsTrigger value="contacts" className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              Contacts
            </TabsTrigger>
            <TabsTrigger value="documents" className="flex items-center gap-1">
              <FolderOpen className="h-4 w-4" />
              Docs
            </TabsTrigger>
            <TabsTrigger value="dates" className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              Dates
            </TabsTrigger>
            <TabsTrigger value="decisions" className="flex items-center gap-1">
              <CheckCircle2 className="h-4 w-4" />
              Decisions
            </TabsTrigger>
            <TabsTrigger value="risks" className="flex items-center gap-1">
              <AlertTriangle className="h-4 w-4" />
              Risks
            </TabsTrigger>
            <TabsTrigger value="financials" className="flex items-center gap-1">
              💰
              Finance
            </TabsTrigger>
          </TabsList>

          {/* Notes Tab */}
          <TabsContent value="notes" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Input placeholder="🔍 Search notes..." className="w-64" />
              </div>
              <Dialog open={noteDialog} onOpenChange={setNoteDialog}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Note
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Note</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Title (optional)</Label>
                      <Input
                        value={noteForm.title}
                        onChange={(e) => setNoteForm({ ...noteForm, title: e.target.value })}
                        placeholder="Note title..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Content</Label>
                      <Textarea
                        value={noteForm.content}
                        onChange={(e) => setNoteForm({ ...noteForm, content: e.target.value })}
                        placeholder="Type your note here..."
                        rows={6}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Tags (comma-separated)</Label>
                      <Input
                        value={noteForm.tags}
                        onChange={(e) => setNoteForm({ ...noteForm, tags: e.target.value })}
                        placeholder="e.g., seller-meeting, pricing, timeline"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setNoteDialog(false)}>Cancel</Button>
                    <Button 
                      onClick={() => createItem('note', {
                        ...noteForm,
                        tags: noteForm.tags.split(',').map(t => t.trim()).filter(Boolean)
                      })}
                      disabled={!noteForm.content}
                    >
                      Create Note
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <div className="space-y-3">
              {data.notes?.map((note) => (
                <div key={note.id} className="p-4 border rounded-lg">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      {note.title && <h4 className="font-semibold">{note.title}</h4>}
                      <p className="text-sm text-muted-foreground">
                        {formatDateTime(note.created_at)} • {note.author_name}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {note.pinned && <Pin className="h-4 w-4 text-primary" />}
                      <Button variant="ghost" size="sm">
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => deleteItem('note', note.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                  {note.tags && note.tags.length > 0 && (
                    <div className="flex gap-2 mt-3">
                      {note.tags.map((tag, i) => (
                        <Badge key={i} variant="outline">{tag}</Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {(!data.notes || data.notes.length === 0) && (
                <p className="text-center text-muted-foreground py-8">
                  No notes yet. Click "Add Note" to get started.
                </p>
              )}
            </div>
          </TabsContent>

          {/* Activity Tab */}
          <TabsContent value="activity" className="space-y-4 mt-4">
            <div className="space-y-2">
              {data.activity?.map((item) => (
                <div key={item.id} className="flex items-start gap-3 p-3 border-l-2 border-primary/20">
                  <Activity className="h-4 w-4 mt-1 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(item.created_at)}
                      {item.user_name && ` • ${item.user_name}`}
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

          {/* Contacts Tab */}
          <TabsContent value="contacts" className="space-y-4 mt-4">
            <div className="flex justify-end">
              <Dialog open={contactDialog} onOpenChange={setContactDialog}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Contact
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Contact</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Name *</Label>
                      <Input
                        value={contactForm.name}
                        onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Role *</Label>
                      <Input
                        value={contactForm.role}
                        onChange={(e) => setContactForm({ ...contactForm, role: e.target.value })}
                        placeholder="e.g., Seller, Broker, Lender"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Company</Label>
                      <Input
                        value={contactForm.company}
                        onChange={(e) => setContactForm({ ...contactForm, company: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input
                        type="email"
                        value={contactForm.email}
                        onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Phone</Label>
                      <Input
                        value={contactForm.phone}
                        onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setContactDialog(false)}>Cancel</Button>
                    <Button 
                      onClick={() => createItem('contact', contactForm)}
                      disabled={!contactForm.name || !contactForm.role}
                    >
                      Create Contact
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {data.contacts?.map((contact) => (
                <div key={contact.id} className="p-4 border rounded-lg">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="font-semibold">{contact.name}</h4>
                      <p className="text-sm text-muted-foreground">{contact.role}</p>
                      {contact.company && <p className="text-sm">{contact.company}</p>}
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => deleteItem('contact', contact.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  {contact.email && <p className="text-sm">📧 {contact.email}</p>}
                  {contact.phone && <p className="text-sm">📱 {contact.phone}</p>}
                </div>
              ))}
              {(!data.contacts || data.contacts.length === 0) && (
                <p className="text-center text-muted-foreground py-8 col-span-2">
                  No contacts yet. Click "Add Contact" to get started.
                </p>
              )}
            </div>
          </TabsContent>

          {/* Documents Tab */}
          <TabsContent value="documents" className="space-y-4 mt-4">
            <p className="text-center text-muted-foreground py-8">
              Document management integration (API support ready)
            </p>
          </TabsContent>

          {/* Dates Tab */}
          <TabsContent value="dates" className="space-y-4 mt-4">
            <div className="flex justify-end">
              <Dialog open={dateDialog} onOpenChange={setDateDialog}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Date
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Key Date</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Title *</Label>
                      <Input
                        value={dateForm.title}
                        onChange={(e) => setDateForm({ ...dateForm, title: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Date *</Label>
                      <Input
                        type="date"
                        value={dateForm.date}
                        onChange={(e) => setDateForm({ ...dateForm, date: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Type</Label>
                      <Select
                        value={dateForm.date_type}
                        onValueChange={(value) => setDateForm({ ...dateForm, date_type: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="deadline">Deadline</SelectItem>
                          <SelectItem value="milestone">Milestone</SelectItem>
                          <SelectItem value="scheduled">Scheduled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Textarea
                        value={dateForm.description}
                        onChange={(e) => setDateForm({ ...dateForm, description: e.target.value })}
                        rows={3}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setDateDialog(false)}>Cancel</Button>
                    <Button 
                      onClick={() => createItem('date', dateForm)}
                      disabled={!dateForm.title || !dateForm.date}
                    >
                      Create Date
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <div className="space-y-2">
              {data.dates?.map((date) => (
                <div key={date.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <h4 className="font-semibold">{date.title}</h4>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(date.date)} • {date.date_type}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={getStatusColor(date.status)}>{date.status}</Badge>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => deleteItem('date', date.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {(!data.dates || data.dates.length === 0) && (
                <p className="text-center text-muted-foreground py-8">
                  No key dates yet. Click "Add Date" to get started.
                </p>
              )}
            </div>
          </TabsContent>

          {/* Decisions Tab */}
          <TabsContent value="decisions" className="space-y-4 mt-4">
            <div className="flex justify-end">
              <Dialog open={decisionDialog} onOpenChange={setDecisionDialog}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Log Decision
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Log Decision</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Title *</Label>
                      <Input
                        value={decisionForm.title}
                        onChange={(e) => setDecisionForm({ ...decisionForm, title: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select
                        value={decisionForm.status}
                        onValueChange={(value) => setDecisionForm({ ...decisionForm, status: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="approved">Approved</SelectItem>
                          <SelectItem value="rejected">Rejected</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="tabled">Tabled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Rationale</Label>
                      <Textarea
                        value={decisionForm.rationale}
                        onChange={(e) => setDecisionForm({ ...decisionForm, rationale: e.target.value })}
                        rows={4}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setDecisionDialog(false)}>Cancel</Button>
                    <Button 
                      onClick={() => createItem('decision', decisionForm)}
                      disabled={!decisionForm.title}
                    >
                      Log Decision
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <div className="space-y-2">
              {data.decisions?.map((decision) => (
                <div key={decision.id} className="p-4 border rounded-lg">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={getStatusColor(decision.status)}>{decision.status}</Badge>
                        <h4 className="font-semibold">{decision.title}</h4>
                      </div>
                      {decision.decision_date && (
                        <p className="text-sm text-muted-foreground">
                          {formatDate(decision.decision_date)}
                        </p>
                      )}
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => deleteItem('decision', decision.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {(!data.decisions || data.decisions.length === 0) && (
                <p className="text-center text-muted-foreground py-8">
                  No decisions logged yet. Click "Log Decision" to get started.
                </p>
              )}
            </div>
          </TabsContent>

          {/* Risks Tab */}
          <TabsContent value="risks" className="space-y-4 mt-4">
            <div className="flex justify-end">
              <Dialog open={riskDialog} onOpenChange={setRiskDialog}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Risk
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Risk</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Title *</Label>
                      <Input
                        value={riskForm.title}
                        onChange={(e) => setRiskForm({ ...riskForm, title: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Textarea
                        value={riskForm.description}
                        onChange={(e) => setRiskForm({ ...riskForm, description: e.target.value })}
                        rows={3}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Impact</Label>
                        <Select
                          value={riskForm.impact}
                          onValueChange={(value) => setRiskForm({ ...riskForm, impact: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Likelihood</Label>
                        <Select
                          value={riskForm.likelihood}
                          onValueChange={(value) => setRiskForm({ ...riskForm, likelihood: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Mitigation Strategy</Label>
                      <Textarea
                        value={riskForm.mitigation_strategy}
                        onChange={(e) => setRiskForm({ ...riskForm, mitigation_strategy: e.target.value })}
                        rows={3}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setRiskDialog(false)}>Cancel</Button>
                    <Button 
                      onClick={() => createItem('risk', riskForm)}
                      disabled={!riskForm.title}
                    >
                      Add Risk
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <div className="space-y-2">
              {data.risks?.map((risk) => (
                <div key={risk.id} className="p-4 border rounded-lg">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={getSeverityColor(risk.severity)}>{risk.severity} RISK</Badge>
                        <Badge variant="outline">{risk.status}</Badge>
                      </div>
                      <h4 className="font-semibold">{risk.title}</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        Impact: {risk.impact} | Likelihood: {risk.likelihood}
                      </p>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => deleteItem('risk', risk.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {(!data.risks || data.risks.length === 0) && (
                <p className="text-center text-muted-foreground py-8">
                  No risks identified yet. Click "Add Risk" to get started.
                </p>
              )}
            </div>
          </TabsContent>

          {/* Financials Tab */}
          <TabsContent value="financials" className="space-y-4 mt-4">
            <p className="text-center text-muted-foreground py-8">
              Financial summary pulls from Financial Modeling module
            </p>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
