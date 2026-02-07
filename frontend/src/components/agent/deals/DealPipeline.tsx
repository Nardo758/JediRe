import { useState, useEffect, useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Deal, DealStage, Client, DealFormData } from '@/types';
import { Plus, Loader2 } from 'lucide-react';
import DealCard from './DealCard';
import DealDetailModal from './DealDetailModal';
import DealForm from './DealForm';
import DealFilters, { DealFiltersState } from './DealFilters';

interface DealPipelineProps {
  apiBaseUrl?: string;
}

const stageConfig: Record<DealStage, { label: string; color: string }> = {
  lead: { label: 'Lead', color: 'bg-gray-100 border-gray-300' },
  qualified: { label: 'Qualified', color: 'bg-blue-100 border-blue-300' },
  under_contract: { label: 'Under Contract', color: 'bg-yellow-100 border-yellow-300' },
  closed: { label: 'Closed', color: 'bg-green-100 border-green-300' },
  lost: { label: 'Lost', color: 'bg-red-100 border-red-300' },
};

const stageOrder: DealStage[] = ['lead', 'qualified', 'under_contract', 'closed', 'lost'];

function SortableDealCard({ deal, onClick }: { deal: Deal; onClick: (deal: Deal) => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: deal.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <DealCard deal={deal} onClick={onClick} isDragging={isDragging} />
    </div>
  );
}

export default function DealPipeline({ apiBaseUrl = '/api/agent' }: DealPipelineProps) {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  
  const [filters, setFilters] = useState<DealFiltersState>({
    stages: [],
    dealTypes: [],
    priorities: [],
    sortBy: 'date',
    sortOrder: 'desc',
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Fetch deals
  const fetchDeals = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${apiBaseUrl}/deals`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch deals');
      }
      
      const data = await response.json();
      setDeals(data.deals || data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load deals');
      console.error('Error fetching deals:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch clients
  const fetchClients = async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/clients`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setClients(data.clients || data);
      }
    } catch (err) {
      console.error('Error fetching clients:', err);
    }
  };

  useEffect(() => {
    fetchDeals();
    fetchClients();
  }, []);

  // Filter and sort deals
  const filteredDeals = useMemo(() => {
    let filtered = [...deals];

    // Apply filters
    if (filters.dealTypes.length > 0) {
      filtered = filtered.filter(deal => filters.dealTypes.includes(deal.dealType));
    }
    if (filters.priorities.length > 0) {
      filtered = filtered.filter(deal => filters.priorities.includes(deal.priority));
    }
    if (filters.clientId) {
      filtered = filtered.filter(deal => deal.clientId === filters.clientId);
    }
    if (filters.dateFrom) {
      filtered = filtered.filter(deal => 
        !deal.expectedCloseDate || deal.expectedCloseDate >= filters.dateFrom!
      );
    }
    if (filters.dateTo) {
      filtered = filtered.filter(deal => 
        !deal.expectedCloseDate || deal.expectedCloseDate <= filters.dateTo!
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (filters.sortBy) {
        case 'value':
          comparison = a.dealValue - b.dealValue;
          break;
        case 'date':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'priority':
          const priorityOrder = { high: 3, medium: 2, low: 1 };
          comparison = priorityOrder[a.priority] - priorityOrder[b.priority];
          break;
      }

      return filters.sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [deals, filters]);

  // Group deals by stage
  const dealsByStage = useMemo(() => {
    const grouped: Record<DealStage, Deal[]> = {
      lead: [],
      qualified: [],
      under_contract: [],
      closed: [],
      lost: [],
    };

    filteredDeals.forEach(deal => {
      grouped[deal.stage].push(deal);
    });

    return grouped;
  }, [filteredDeals]);

  // Calculate stage totals
  const stageTotals = useMemo(() => {
    return Object.entries(dealsByStage).reduce((acc, [stage, deals]) => {
      acc[stage as DealStage] = {
        count: deals.length,
        value: deals.reduce((sum, deal) => sum + deal.dealValue, 0),
      };
      return acc;
    }, {} as Record<DealStage, { count: number; value: number }>);
  }, [dealsByStage]);

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  };

  // Handle drag end
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);

    if (!over) return;

    const dealId = active.id as string;
    const newStage = over.id as DealStage;
    const deal = deals.find(d => d.id === dealId);

    if (!deal || deal.stage === newStage) return;

    // Optimistic update
    setDeals(prev =>
      prev.map(d =>
        d.id === dealId ? { ...d, stage: newStage, daysInStage: 0 } : d
      )
    );

    // Update on server
    try {
      const response = await fetch(`${apiBaseUrl}/deals/${dealId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify({ stage: newStage }),
      });

      if (!response.ok) {
        throw new Error('Failed to update deal');
      }

      const updatedDeal = await response.json();
      setDeals(prev =>
        prev.map(d => (d.id === dealId ? updatedDeal : d))
      );
    } catch (err) {
      console.error('Error updating deal:', err);
      // Revert optimistic update
      setDeals(prev =>
        prev.map(d => (d.id === dealId ? deal : d))
      );
    }
  };

  // Handle create deal
  const handleCreateDeal = async (formData: DealFormData) => {
    try {
      const response = await fetch(`${apiBaseUrl}/deals`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Failed to create deal');
      }

      const newDeal = await response.json();
      setDeals(prev => [...prev, newDeal]);
      setShowAddForm(false);
    } catch (err) {
      console.error('Error creating deal:', err);
      throw err;
    }
  };

  // Handle update deal
  const handleUpdateDeal = async (formData: DealFormData) => {
    if (!editingDeal) return;

    try {
      const response = await fetch(`${apiBaseUrl}/deals/${editingDeal.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Failed to update deal');
      }

      const updatedDeal = await response.json();
      setDeals(prev =>
        prev.map(d => (d.id === editingDeal.id ? updatedDeal : d))
      );
      setEditingDeal(null);
      if (selectedDeal?.id === editingDeal.id) {
        setSelectedDeal(updatedDeal);
      }
    } catch (err) {
      console.error('Error updating deal:', err);
      throw err;
    }
  };

  // Handle update stage
  const handleUpdateStage = async (dealId: string, newStage: DealStage) => {
    const deal = deals.find(d => d.id === dealId);
    if (!deal || deal.stage === newStage) return;

    // Optimistic update
    setDeals(prev =>
      prev.map(d =>
        d.id === dealId ? { ...d, stage: newStage, daysInStage: 0 } : d
      )
    );

    try {
      const response = await fetch(`${apiBaseUrl}/deals/${dealId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify({ stage: newStage }),
      });

      if (!response.ok) {
        throw new Error('Failed to update deal');
      }

      const updatedDeal = await response.json();
      setDeals(prev =>
        prev.map(d => (d.id === dealId ? updatedDeal : d))
      );
      if (selectedDeal?.id === dealId) {
        setSelectedDeal(updatedDeal);
      }
    } catch (err) {
      console.error('Error updating deal:', err);
      // Revert optimistic update
      setDeals(prev =>
        prev.map(d => (d.id === dealId ? deal : d))
      );
    }
  };

  // Handle archive
  const handleArchive = async (dealId: string) => {
    if (!confirm('Are you sure you want to archive this deal?')) return;

    try {
      const response = await fetch(`${apiBaseUrl}/deals/${dealId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to archive deal');
      }

      setDeals(prev => prev.filter(d => d.id !== dealId));
      setSelectedDeal(null);
    } catch (err) {
      console.error('Error archiving deal:', err);
    }
  };

  // Handle add note
  const handleAddNote = async (dealId: string, note: string) => {
    try {
      const response = await fetch(`${apiBaseUrl}/deals/${dealId}/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify({ note }),
      });

      if (!response.ok) {
        throw new Error('Failed to add note');
      }

      // Refresh the deal to get updated activities
      const dealResponse = await fetch(`${apiBaseUrl}/deals/${dealId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });

      if (dealResponse.ok) {
        const updatedDeal = await dealResponse.json();
        setDeals(prev =>
          prev.map(d => (d.id === dealId ? updatedDeal : d))
        );
        if (selectedDeal?.id === dealId) {
          setSelectedDeal(updatedDeal);
        }
      }
    } catch (err) {
      console.error('Error adding note:', err);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
      notation: 'compact',
    }).format(amount);
  };

  const activeDeal = activeDragId ? deals.find(d => d.id === activeDragId) : null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={fetchDeals}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900">Deal Pipeline</h1>
          <button
            onClick={() => setShowAddForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Deal
          </button>
        </div>

        {/* Filters */}
        <DealFilters filters={filters} onChange={setFilters} clients={clients} />
      </div>

      {/* Pipeline */}
      <div className="flex-1 overflow-x-auto p-6">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 h-full min-w-max">
            {stageOrder.map(stage => {
              const config = stageConfig[stage];
              const stageDeals = dealsByStage[stage];
              const totals = stageTotals[stage];

              return (
                <div key={stage} className="flex-shrink-0 w-80 flex flex-col">
                  {/* Column Header */}
                  <div className={`${config.color} rounded-t-lg border-2 border-b-0 px-4 py-3`}>
                    <div className="flex items-center justify-between mb-1">
                      <h2 className="font-bold text-gray-900">{config.label}</h2>
                      <span className="bg-white px-2 py-0.5 rounded-full text-xs font-semibold">
                        {totals.count}
                      </span>
                    </div>
                    <div className="text-sm font-semibold text-gray-700">
                      {formatCurrency(totals.value)}
                    </div>
                  </div>

                  {/* Column Content */}
                  <SortableContext
                    id={stage}
                    items={stageDeals.map(d => d.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="flex-1 bg-gray-100 border-2 border-t-0 border-gray-300 rounded-b-lg p-4 overflow-y-auto space-y-3">
                      {stageDeals.map(deal => (
                        <SortableDealCard
                          key={deal.id}
                          deal={deal}
                          onClick={setSelectedDeal}
                        />
                      ))}
                      {stageDeals.length === 0 && (
                        <div className="text-center text-gray-400 text-sm py-8">
                          No deals in this stage
                        </div>
                      )}
                    </div>
                  </SortableContext>
                </div>
              );
            })}
          </div>

          <DragOverlay>
            {activeDeal ? (
              <div className="rotate-3 scale-105">
                <DealCard deal={activeDeal} onClick={() => {}} isDragging />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Modals */}
      {selectedDeal && (
        <DealDetailModal
          deal={selectedDeal}
          onClose={() => setSelectedDeal(null)}
          onEdit={(deal) => {
            setEditingDeal(deal);
            setSelectedDeal(null);
          }}
          onUpdateStage={handleUpdateStage}
          onArchive={handleArchive}
          onAddNote={handleAddNote}
        />
      )}

      {(showAddForm || editingDeal) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <DealForm
            deal={editingDeal || undefined}
            clients={clients}
            onSubmit={editingDeal ? handleUpdateDeal : handleCreateDeal}
            onCancel={() => {
              setShowAddForm(false);
              setEditingDeal(null);
            }}
          />
        </div>
      )}
    </div>
  );
}
