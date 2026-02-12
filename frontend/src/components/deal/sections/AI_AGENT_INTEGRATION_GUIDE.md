# AI Agent Section - Integration Guide

## Quick Start (2 minutes)

### Step 1: Import the Component

```typescript
import { AIAgentSection } from '@/components/deal/sections';
// or
import { AIAgentSection } from './sections/AIAgentSection';
```

### Step 2: Add to Your Deal Page

```tsx
<AIAgentSection 
  deal={deal} 
  mode="acquisition" // or "performance"
/>
```

That's it! The component is self-contained and fully functional.

---

## Integration Patterns

### Pattern 1: Simple Addition to Existing Deal Page

If you have an existing deal page, just add the section:

```tsx
function DealPage({ dealId }: { dealId: string }) {
  const { deal } = useDeal(dealId);
  
  return (
    <div className="space-y-6">
      {/* Existing sections */}
      <OverviewSection deal={deal} />
      <FinancialSection deal={deal} />
      
      {/* Add AI Agent Section */}
      <AIAgentSection deal={deal} mode="acquisition" />
      
      {/* More sections */}
      <MarketSection deal={deal} />
    </div>
  );
}
```

### Pattern 2: As a Tab in Tabbed Interface

```tsx
function DealPage({ dealId }: { dealId: string }) {
  const [activeTab, setActiveTab] = useState('overview');
  const { deal } = useDeal(dealId);
  
  return (
    <div>
      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tab value="overview">Overview</Tab>
        <Tab value="opus">🤖 Opus AI</Tab>
        <Tab value="financials">Financials</Tab>
      </Tabs>
      
      <TabPanel value="overview">
        <OverviewSection deal={deal} />
      </TabPanel>
      
      <TabPanel value="opus">
        <AIAgentSection deal={deal} mode="acquisition" />
      </TabPanel>
      
      <TabPanel value="financials">
        <FinancialSection deal={deal} />
      </TabPanel>
    </div>
  );
}
```

### Pattern 3: With Mode Switching

```tsx
function DealPage({ dealId }: { dealId: string }) {
  const [mode, setMode] = useState<'acquisition' | 'performance'>('acquisition');
  const { deal } = useDeal(dealId);
  
  // Determine mode automatically based on deal stage
  useEffect(() => {
    if (deal.stage === 'Post-Close' || deal.stage === 'Asset Management') {
      setMode('performance');
    } else {
      setMode('acquisition');
    }
  }, [deal.stage]);
  
  return (
    <div>
      {/* Mode indicator */}
      <div className="mb-4">
        <span className="text-sm text-gray-600">
          Analysis Mode: {mode === 'acquisition' ? '📊 Acquisition' : '📈 Performance'}
        </span>
      </div>
      
      <AIAgentSection deal={deal} mode={mode} />
    </div>
  );
}
```

### Pattern 4: Floating Chat Widget

```tsx
function DealPage({ dealId }: { dealId: string }) {
  const [showOpus, setShowOpus] = useState(false);
  const { deal } = useDeal(dealId);
  
  return (
    <div>
      {/* Main content */}
      <OverviewSection deal={deal} />
      <FinancialSection deal={deal} />
      
      {/* Floating Opus button */}
      <button
        onClick={() => setShowOpus(!showOpus)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-all flex items-center justify-center text-2xl z-50"
      >
        🤖
      </button>
      
      {/* Sliding panel */}
      {showOpus && (
        <div className="fixed top-0 right-0 w-[500px] h-full bg-white shadow-2xl z-40 overflow-y-auto">
          <div className="p-4 border-b flex items-center justify-between">
            <h2 className="font-bold">Opus AI Assistant</h2>
            <button onClick={() => setShowOpus(false)}>✕</button>
          </div>
          <div className="p-4">
            <AIAgentSection deal={deal} mode="acquisition" />
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## Customization Options

### Controlling Loading Behavior

The component handles loading internally, but you can wrap it:

```tsx
<Suspense fallback={<OpusLoadingSkeleton />}>
  <AIAgentSection deal={deal} mode="acquisition" />
</Suspense>
```

### Custom Error Boundary

```tsx
<ErrorBoundary fallback={<OpusErrorState />}>
  <AIAgentSection deal={deal} mode="acquisition" />
</ErrorBoundary>
```

### Styling Overrides

Wrap in a container with custom styles:

```tsx
<div className="my-custom-opus-container">
  <AIAgentSection deal={deal} mode="acquisition" />
</div>

<style>
  .my-custom-opus-container {
    max-width: 1200px;
    margin: 0 auto;
  }
</style>
```

---

## Working with the Service Layer

### Get Current Recommendation

```typescript
import { opusService } from '@/services/opus.service';

const recommendation = await opusService.analyzeAcquisition({
  dealId: deal.id,
  dealData: deal,
  mode: 'acquisition'
});

console.log('Score:', recommendation.score);
console.log('Recommendation:', recommendation.recommendation);
```

### Access Chat History

```typescript
// Get chat history for a deal
const history = opusService.getChatHistory(dealId);
console.log(`${history?.messages.length} messages`);

// Clear chat history
opusService.clearChatHistory(dealId);

// Export chat to file
const exportChat = (dealId: string) => {
  const history = opusService.getChatHistory(dealId);
  if (!history) return;
  
  const text = history.messages
    .map(m => `[${new Date(m.timestamp).toLocaleString()}] ${m.role}:\n${m.content}`)
    .join('\n\n---\n\n');
  
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `opus-chat-${dealId}.txt`;
  a.click();
};
```

### Programmatic Chat

```typescript
// Send a message programmatically
const askOpus = async (question: string) => {
  const history = opusService.getChatHistory(dealId) || {
    dealId,
    messages: [],
    lastUpdated: new Date().toISOString()
  };
  
  const response = await opusService.chat({
    dealId,
    message: question,
    history: history.messages
  });
  
  return response.message.content;
};

// Usage
const answer = await askOpus("What's the biggest risk?");
console.log(answer);
```

---

## Backend Integration Checklist

When Agent 1 completes the backend, integrate with these steps:

### ✅ Step 1: Update Service URLs

In `opus.service.ts`, replace mock implementations:

```typescript
// Before (mock)
return new Promise((resolve) => {
  setTimeout(() => resolve(mockData), 1000);
});

// After (real API)
const response = await apiClient.post('/api/v1/opus/analyze-acquisition', context);
return response.data.data;
```

### ✅ Step 2: Add Streaming Support

```typescript
// Add streaming for chat
async chat(request: OpusChatRequest, onChunk?: (chunk: string) => void) {
  const response = await fetch('/api/v1/opus/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
  });
  
  const reader = response.body?.getReader();
  let content = '';
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    const chunk = new TextDecoder().decode(value);
    content += chunk;
    onChunk?.(chunk); // Call callback for each chunk
  }
  
  return { message: { content, ... }, ... };
}
```

### ✅ Step 3: Update Component for Streaming

```typescript
// In ChatInterface component
const [streamingContent, setStreamingContent] = useState('');

const handleSend = async (text: string) => {
  // ... existing code ...
  
  setStreamingContent('');
  
  const response = await opusService.chat(
    { dealId, message: text, history },
    (chunk) => {
      // Update streaming content in real-time
      setStreamingContent(prev => prev + chunk);
    }
  );
  
  // ... save to history ...
};
```

### ✅ Step 4: Environment Variables

Add to `.env`:

```bash
VITE_API_BASE_URL=http://localhost:3000
ANTHROPIC_API_KEY=sk-ant-...
```

### ✅ Step 5: Error Handling

```typescript
try {
  const recommendation = await opusService.analyzeAcquisition(context);
} catch (error) {
  if (error.code === 'RATE_LIMIT') {
    // Show rate limit message
  } else if (error.code === 'API_ERROR') {
    // Show API error
  } else {
    // Generic error
  }
}
```

---

## Testing

### Manual Testing Checklist

- [ ] Component renders without errors
- [ ] Recommendation card displays with correct score/confidence
- [ ] All insight categories expand/collapse
- [ ] Chat input accepts text
- [ ] Messages send and display correctly
- [ ] Suggested questions work
- [ ] Chat history persists across page reloads
- [ ] Clear history button works
- [ ] Copy to clipboard works
- [ ] Refresh button triggers new analysis
- [ ] Loading states display properly
- [ ] Error states display when appropriate
- [ ] Mode switching works (acquisition vs performance)
- [ ] Responsive on mobile devices

### Unit Test Example

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AIAgentSection } from './AIAgentSection';
import { opusService } from '@/services/opus.service';

jest.mock('@/services/opus.service');

describe('AIAgentSection', () => {
  it('renders recommendation card', async () => {
    const mockDeal = { id: 'test', name: 'Test Deal', ... };
    
    render(<AIAgentSection deal={mockDeal} mode="acquisition" />);
    
    await waitFor(() => {
      expect(screen.getByText('Opus Recommendation')).toBeInTheDocument();
      expect(screen.getByText(/\d+\.\d+\/10/)).toBeInTheDocument();
    });
  });
  
  it('sends chat messages', async () => {
    const mockDeal = { id: 'test', name: 'Test Deal', ... };
    
    render(<AIAgentSection deal={mockDeal} mode="acquisition" />);
    
    const input = screen.getByPlaceholderText(/Ask Opus/);
    const sendButton = screen.getByText('Send');
    
    fireEvent.change(input, { target: { value: 'Test question' } });
    fireEvent.click(sendButton);
    
    await waitFor(() => {
      expect(opusService.chat).toHaveBeenCalled();
    });
  });
});
```

---

## Troubleshooting

### Issue: Component not rendering

**Solution:** Check that deal object has required fields:
```typescript
const deal = {
  id: 'required',
  name: 'required',
  // ... other fields
};
```

### Issue: Chat history not persisting

**Solution:** Check localStorage quota and permissions:
```typescript
// Test localStorage
try {
  localStorage.setItem('test', 'test');
  localStorage.removeItem('test');
} catch (e) {
  console.error('localStorage not available');
}
```

### Issue: Tailwind classes not working

**Solution:** Ensure color classes are whitelisted in `tailwind.config.js`:
```javascript
module.exports = {
  safelist: [
    'bg-green-50', 'bg-red-50', 'bg-blue-50', 'bg-purple-50',
    'border-green-200', 'border-red-200', 'border-blue-200',
    // ... add other dynamic classes
  ]
};
```

### Issue: TypeScript errors

**Solution:** Ensure types are imported:
```typescript
import type { Deal } from '@/types/deal';
import type { OpusRecommendation } from '@/types/opus';
```

---

## Performance Optimization

### Lazy Loading

```typescript
// Lazy load for better performance
const AIAgentSection = lazy(() => import('./sections/AIAgentSection'));

// Use with Suspense
<Suspense fallback={<LoadingSpinner />}>
  <AIAgentSection deal={deal} mode="acquisition" />
</Suspense>
```

### Memoization

```typescript
import { memo } from 'react';

// Prevent unnecessary re-renders
export const AIAgentSection = memo(({ deal, mode }) => {
  // ... component code
}, (prevProps, nextProps) => {
  return prevProps.deal.id === nextProps.deal.id &&
         prevProps.mode === nextProps.mode;
});
```

### Debounced Refresh

```typescript
import { useDebounce } from '@/hooks/useDebounce';

const debouncedRefresh = useDebounce(() => {
  loadRecommendation(true);
}, 500);
```

---

## Security Considerations

### 1. Chat History Privacy

Chat history is stored in localStorage. For sensitive deals:

```typescript
// Option A: Don't persist sensitive chats
if (deal.confidentialityLevel === 'high') {
  // Don't save to localStorage
  // Keep in component state only
}

// Option B: Encrypt before storing
import { encrypt, decrypt } from '@/utils/crypto';

const saveEncryptedHistory = (history: ChatHistory) => {
  const encrypted = encrypt(JSON.stringify(history));
  localStorage.setItem(key, encrypted);
};
```

### 2. API Key Security

Never expose Anthropic API key in frontend:

```typescript
// ❌ NEVER DO THIS
const apiKey = 'sk-ant-...';

// ✅ Always use backend proxy
const response = await apiClient.post('/api/opus/chat', {
  // Backend handles API key
});
```

---

## Support & Documentation

- **Main docs:** `AI_AGENT_SECTION_COMPLETE.md`
- **Examples:** `AIAgentSection.example.tsx`
- **Type definitions:** `src/types/opus.ts`
- **Service layer:** `src/services/opus.service.ts`

For questions or issues, check the comprehensive docs or reach out to the development team.

---

**Ready to integrate!** Just import and use. The component is production-ready with mock data and will seamlessly transition to real API calls when backend is ready.
