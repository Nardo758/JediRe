# Agent Dashboard Integration Guide

## Quick Start

### 1. Import Components

```tsx
import { 
  AgentDashboard, 
  ClientList,
  ClientCard,
  ClientFilters,
  AddClientForm
} from '@/components/agent';
```

### 2. Set Up Routes

Add to your React Router configuration:

```tsx
// App.tsx or routes/index.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AgentDashboard, ClientList } from '@/components/agent';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Agent Dashboard */}
        <Route path="/agent" element={<AgentDashboard />} />
        
        {/* Client Management */}
        <Route path="/agent/clients" element={<ClientList />} />
        
        {/* Add more routes as needed */}
      </Routes>
    </BrowserRouter>
  );
}
```

### 3. Configure Environment

Create or update `.env` file:

```bash
VITE_API_URL=http://localhost:8000
```

### 4. Verify Dependencies

Ensure these packages are installed:

```bash
npm install react react-dom react-router-dom
npm install axios lucide-react
npm install tailwindcss autoprefixer postcss
```

All dependencies should already be in `package.json`.

---

## Backend API Implementation

### Required Endpoints

#### 1. Dashboard Stats
```typescript
GET /api/agent/stats

Response: {
  totalClients: 156,
  activeDeals: 23,
  pendingLeads: 8,
  commissionYTD: 487500,
  monthlyStats: {
    newClients: 12,
    closedDeals: 4,
    totalRevenue: 65000
  }
}
```

#### 2. Recent Activity
```typescript
GET /api/agent/activity?limit=10

Response: [
  {
    id: "act_123",
    type: "client_added",
    description: "Added new client: John Doe",
    timestamp: "2026-02-04T10:30:00Z",
    relatedEntityId: "client_456",
    relatedEntityType: "client"
  }
]
```

#### 3. List Clients (with filters)
```typescript
GET /api/agent/clients?page=1&limit=20&status[]=active&type[]=buyer&search=john

Response: {
  clients: [
    {
      id: "client_123",
      name: "John Doe",
      email: "john@example.com",
      phone: "+1 555-123-4567",
      type: "buyer",
      status: "active",
      dateAdded: "2026-01-15T09:00:00Z",
      lastContact: "2026-02-03T14:30:00Z",
      assignedAgent: "agent_789",
      notes: "Looking for 3BR in downtown",
      dealsCount: 2,
      totalValue: 850000
    }
  ],
  total: 156
}
```

#### 4. Get Single Client
```typescript
GET /api/agent/clients/:id

Response: {
  id: "client_123",
  name: "John Doe",
  email: "john@example.com",
  phone: "+1 555-123-4567",
  type: "buyer",
  status: "active",
  dateAdded: "2026-01-15T09:00:00Z",
  lastContact: "2026-02-03T14:30:00Z",
  assignedAgent: "agent_789",
  notes: "Looking for 3BR in downtown",
  dealsCount: 2,
  totalValue: 850000
}
```

#### 5. Create Client
```typescript
POST /api/agent/clients

Request Body: {
  name: "John Doe",
  email: "john@example.com",
  phone: "+1 555-123-4567",
  type: "buyer",
  status: "active",
  notes: "Referred by Jane Smith"
}

Response: {
  id: "client_123",
  name: "John Doe",
  email: "john@example.com",
  phone: "+1 555-123-4567",
  type: "buyer",
  status: "active",
  dateAdded: "2026-02-04T15:45:00Z",
  lastContact: "2026-02-04T15:45:00Z",
  notes: "Referred by Jane Smith",
  dealsCount: 0,
  totalValue: 0
}
```

#### 6. Update Client
```typescript
PUT /api/agent/clients/:id

Request Body: {
  name: "John Smith",
  phone: "+1 555-999-8888",
  status: "inactive"
}

Response: {
  id: "client_123",
  name: "John Smith",
  email: "john@example.com",
  phone: "+1 555-999-8888",
  type: "buyer",
  status: "inactive",
  dateAdded: "2026-01-15T09:00:00Z",
  lastContact: "2026-02-03T14:30:00Z",
  notes: "Referred by Jane Smith",
  dealsCount: 2,
  totalValue: 850000
}
```

#### 7. Delete Client
```typescript
DELETE /api/agent/clients/:id

Response: {
  success: true,
  message: "Client deleted successfully"
}
```

---

## Example Python/Flask Backend

```python
from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime

app = Flask(__name__)
CORS(app)

# Mock database (replace with real database)
clients_db = {}

@app.route('/api/agent/stats', methods=['GET'])
def get_stats():
    return jsonify({
        'totalClients': len(clients_db),
        'activeDeals': 23,
        'pendingLeads': 8,
        'commissionYTD': 487500,
        'monthlyStats': {
            'newClients': 12,
            'closedDeals': 4,
            'totalRevenue': 65000
        }
    })

@app.route('/api/agent/clients', methods=['GET'])
def list_clients():
    page = int(request.args.get('page', 1))
    limit = int(request.args.get('limit', 20))
    search = request.args.get('search', '')
    status_filter = request.args.getlist('status[]')
    type_filter = request.args.getlist('type[]')
    
    # Filter clients
    filtered = list(clients_db.values())
    
    if search:
        filtered = [c for c in filtered if search.lower() in c['name'].lower() 
                   or search.lower() in c['email'].lower()]
    
    if status_filter:
        filtered = [c for c in filtered if c['status'] in status_filter]
    
    if type_filter:
        filtered = [c for c in filtered if c['type'] in type_filter]
    
    # Paginate
    start = (page - 1) * limit
    end = start + limit
    paginated = filtered[start:end]
    
    return jsonify({
        'clients': paginated,
        'total': len(filtered)
    })

@app.route('/api/agent/clients/<client_id>', methods=['GET'])
def get_client(client_id):
    if client_id not in clients_db:
        return jsonify({'error': 'Client not found'}), 404
    return jsonify(clients_db[client_id])

@app.route('/api/agent/clients', methods=['POST'])
def create_client():
    data = request.json
    client_id = f"client_{len(clients_db) + 1}"
    
    client = {
        'id': client_id,
        'name': data['name'],
        'email': data['email'],
        'phone': data['phone'],
        'type': data['type'],
        'status': data['status'],
        'dateAdded': datetime.now().isoformat(),
        'lastContact': datetime.now().isoformat(),
        'notes': data.get('notes', ''),
        'dealsCount': 0,
        'totalValue': 0
    }
    
    clients_db[client_id] = client
    return jsonify(client), 201

@app.route('/api/agent/clients/<client_id>', methods=['PUT'])
def update_client(client_id):
    if client_id not in clients_db:
        return jsonify({'error': 'Client not found'}), 404
    
    data = request.json
    client = clients_db[client_id]
    
    # Update fields
    for key in ['name', 'email', 'phone', 'type', 'status', 'notes']:
        if key in data:
            client[key] = data[key]
    
    return jsonify(client)

@app.route('/api/agent/clients/<client_id>', methods=['DELETE'])
def delete_client(client_id):
    if client_id not in clients_db:
        return jsonify({'error': 'Client not found'}), 404
    
    del clients_db[client_id]
    return jsonify({'success': True})

if __name__ == '__main__':
    app.run(debug=True, port=8000)
```

---

## Testing Without Backend (Mock Mode)

### Option 1: Mock Service Worker

Install MSW:
```bash
npm install msw --save-dev
```

Create mock handlers:
```tsx
// src/mocks/handlers.ts
import { rest } from 'msw';

export const handlers = [
  rest.get('/api/agent/stats', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        totalClients: 156,
        activeDeals: 23,
        pendingLeads: 8,
        commissionYTD: 487500,
        monthlyStats: {
          newClients: 12,
          closedDeals: 4,
          totalRevenue: 65000
        }
      })
    );
  }),
  
  rest.get('/api/agent/clients', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        clients: [
          {
            id: 'client_1',
            name: 'John Doe',
            email: 'john@example.com',
            phone: '+1 555-123-4567',
            type: 'buyer',
            status: 'active',
            dateAdded: '2026-01-15T09:00:00Z',
            lastContact: '2026-02-03T14:30:00Z',
            dealsCount: 2,
            totalValue: 850000
          }
        ],
        total: 1
      })
    );
  })
];
```

### Option 2: Temporary Mock Data in API Service

Modify `agentApi.ts`:
```tsx
export const agentAPI = {
  getStats: async (): Promise<AgentStats> => {
    // TODO: Replace with real API call when backend is ready
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          totalClients: 156,
          activeDeals: 23,
          pendingLeads: 8,
          commissionYTD: 487500,
          monthlyStats: {
            newClients: 12,
            closedDeals: 4,
            totalRevenue: 65000
          }
        });
      }, 500);
    });
  }
};
```

---

## Database Schema

### PostgreSQL Example

```sql
-- Clients table
CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50),
    type VARCHAR(20) CHECK (type IN ('buyer', 'seller', 'both')),
    status VARCHAR(20) CHECK (status IN ('active', 'inactive', 'archived')),
    assigned_agent_id UUID REFERENCES users(id),
    notes TEXT,
    date_added TIMESTAMP DEFAULT NOW(),
    last_contact TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Deals table
CREATE TABLE deals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    property_address VARCHAR(500),
    deal_type VARCHAR(20) CHECK (deal_type IN ('buy', 'sell', 'lease')),
    status VARCHAR(50),
    value DECIMAL(12, 2),
    commission DECIMAL(12, 2),
    probability INTEGER CHECK (probability >= 0 AND probability <= 100),
    expected_close_date DATE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Leads table
CREATE TABLE leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    source VARCHAR(100),
    message TEXT,
    status VARCHAR(20) CHECK (status IN ('new', 'contacted', 'qualified', 'converted', 'lost')),
    assigned_agent_id UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Activity log table
CREATE TABLE activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID REFERENCES users(id),
    type VARCHAR(50),
    description TEXT,
    related_entity_id UUID,
    related_entity_type VARCHAR(50),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_clients_status ON clients(status);
CREATE INDEX idx_clients_type ON clients(type);
CREATE INDEX idx_clients_agent ON clients(assigned_agent_id);
CREATE INDEX idx_clients_date_added ON clients(date_added);
CREATE INDEX idx_deals_client ON deals(client_id);
CREATE INDEX idx_deals_status ON deals(status);
CREATE INDEX idx_activity_agent ON activity_log(agent_id);
CREATE INDEX idx_activity_created ON activity_log(created_at);
```

---

## Authentication Integration

The components expect authentication to be handled via the axios interceptor in `services/api.ts`:

```tsx
// services/api.ts
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

### Setting Auth Token

After login:
```tsx
// In your login component
const handleLogin = async (email: string, password: string) => {
  const { token, user } = await authAPI.login(email, password);
  localStorage.setItem('auth_token', token);
  localStorage.setItem('user', JSON.stringify(user));
  // Redirect to dashboard
  navigate('/agent');
};
```

### Protected Routes

```tsx
import { Navigate } from 'react-router-dom';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('auth_token');
  
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
}

// Usage
<Route 
  path="/agent" 
  element={
    <ProtectedRoute>
      <AgentDashboard />
    </ProtectedRoute>
  } 
/>
```

---

## Deployment Checklist

### Frontend
- [ ] Set production API URL in `.env.production`
- [ ] Build optimized bundle: `npm run build`
- [ ] Test production build locally: `npm run preview`
- [ ] Deploy to hosting (Vercel, Netlify, etc.)
- [ ] Configure environment variables
- [ ] Set up custom domain (optional)
- [ ] Enable HTTPS

### Backend
- [ ] Deploy API server
- [ ] Set up production database
- [ ] Run database migrations
- [ ] Configure CORS for frontend domain
- [ ] Set up authentication
- [ ] Enable rate limiting
- [ ] Add logging and monitoring
- [ ] Set up backup system

### Testing
- [ ] Test all CRUD operations
- [ ] Test filters and search
- [ ] Test pagination
- [ ] Test form validation
- [ ] Test error scenarios
- [ ] Test mobile responsiveness
- [ ] Test with different user roles
- [ ] Performance testing

---

## Troubleshooting

### Component Not Rendering

**Problem:** Component shows blank screen  
**Solution:** 
1. Check browser console for errors
2. Verify React Router routes are configured
3. Ensure component is imported correctly
4. Check that parent component renders children

### API Calls Failing

**Problem:** Network errors or 404s  
**Solution:**
1. Verify `VITE_API_URL` in `.env`
2. Check backend server is running
3. Verify CORS is configured
4. Check auth token is present
5. Check API endpoint paths match

### TypeScript Errors

**Problem:** Type errors in IDE  
**Solution:**
1. Run `npm install` to ensure all deps installed
2. Restart TypeScript server in IDE
3. Check import paths use `@/` alias correctly
4. Verify all types are exported from `types/agent.ts`

### Styling Issues

**Problem:** Components look unstyled  
**Solution:**
1. Verify Tailwind CSS is configured
2. Check `tailwind.config.js` includes component paths
3. Ensure `index.css` imports Tailwind directives
4. Clear build cache and rebuild

---

## Additional Resources

- [React Router Documentation](https://reactrouter.com)
- [Tailwind CSS Documentation](https://tailwindcss.com)
- [Axios Documentation](https://axios-http.com)
- [Lucide Icons](https://lucide.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs)

---

## Support

For issues or questions:
1. Check this integration guide
2. Review component README.md
3. Check implementation summary
4. Test with mock data first
5. Verify backend API is working

---

**Ready to integrate!** Follow the steps above and you'll have a fully functional agent dashboard connected to your backend API.
