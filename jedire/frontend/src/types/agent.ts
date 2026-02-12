// Agent-specific types for JEDI RE platform

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  type: 'buyer' | 'seller' | 'both';
  status: 'active' | 'inactive' | 'archived';
  dateAdded: string;
  lastContact: string;
  assignedAgent?: string;
  notes?: string;
  dealsCount?: number;
  totalValue?: number;
}

export interface Deal {
  id: string;
  propertyAddress: string;
  clientId: string;
  clientName: string;
  status: 'new' | 'qualified' | 'showing' | 'offer' | 'contract' | 'closed' | 'lost';
  dealType: 'buy' | 'sell' | 'lease';
  value: number;
  commission?: number;
  probability?: number;
  expectedCloseDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Lead {
  id: string;
  source: string;
  name: string;
  email?: string;
  phone?: string;
  message: string;
  status: 'new' | 'contacted' | 'qualified' | 'converted' | 'lost';
  createdAt: string;
  assignedAgent?: string;
}

export interface AgentStats {
  totalClients: number;
  activeDeals: number;
  pendingLeads: number;
  commissionYTD: number;
  monthlyStats: {
    newClients: number;
    closedDeals: number;
    totalRevenue: number;
  };
}

export interface ActivityItem {
  id: string;
  type: 'client_added' | 'deal_updated' | 'lead_created' | 'commission_received' | 'note_added';
  description: string;
  timestamp: string;
  relatedEntityId?: string;
  relatedEntityType?: 'client' | 'deal' | 'lead';
}

export interface ClientFilters {
  status?: ('active' | 'inactive' | 'archived')[];
  type?: ('buyer' | 'seller' | 'both')[];
  dateRange?: {
    start: string;
    end: string;
  };
  search?: string;
  assignedAgent?: string;
}

export interface Commission {
  id: string;
  dealId: string;
  amount: number;
  status: 'pending' | 'received' | 'disputed';
  expectedDate: string;
  receivedDate?: string;
  notes?: string;
}
