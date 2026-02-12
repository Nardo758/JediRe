# Opus Components

AI-powered chat interface for JEDI RE deal analysis.

## Components

### OpusChat

Complete chat interface with recommendation cards for deal analysis.

**Features:**
- 📊 Recommendation card with score (0-10 scale)
- 🎯 Buy/Hold/Pass recommendation badges
- 💡 Key insights (strengths, risks, opportunities)
- 💬 ChatGPT-style chat interface
- 🌊 Streaming text responses
- 📝 Message history
- 🎯 Mode-specific suggested prompts
- 🔄 Reanalysis capability

**Usage:**

```tsx
import { OpusChat } from '../components/Opus';
import { OpusDealContext } from '../types/opus.types';

const MyComponent = () => {
  const dealContext: OpusDealContext = {
    dealId: deal.id,
    dealName: deal.name,
    status: 'pipeline', // or 'owned'
    overview: { /* ... */ },
    financial: { /* ... */ },
    // ... other tab data
  };

  return (
    <OpusChat
      dealContext={dealContext}
      mode="acquisition" // or "performance"
      useMockData={true} // false for live API
      onAnalysisComplete={(result) => {
        console.log('Analysis complete:', result);
      }}
    />
  );
};
```

## Mode-Specific Prompts

### Acquisition Mode
- "What's the biggest risk in this deal?"
- "How's the deal structure?"
- "Can you do a sensitivity analysis?"
- "What should I negotiate on?"
- "Compare this to market comps"

### Performance Mode
- "How can I increase NOI?"
- "What's underperforming?"
- "What optimization strategies do you recommend?"
- "Should I refinance or sell?"
- "How can I reduce expenses?"

## Props

### OpusChat Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `dealContext` | `OpusDealContext` | ✅ | Complete deal data from all tabs |
| `mode` | `'acquisition' \| 'performance'` | ✅ | Analysis mode |
| `useMockData` | `boolean` | ❌ | Use mock service (default: true) |
| `onAnalysisComplete` | `(result) => void` | ❌ | Callback when analysis completes |

## Recommendation Card

The recommendation card displays:

**Score Display:**
- 0-10 scale with color coding
- Green (8-10): Strong opportunity
- Blue (6-8): Good opportunity
- Yellow (4-6): Marginal
- Red (0-4): Weak/risky

**Recommendation Badges:**
- 💎 STRONG BUY (acquisition)
- ✅ BUY (acquisition)
- ⏸️ HOLD (acquisition)
- ⛔ PASS (acquisition)
- 🎯 OPTIMIZE (performance)
- 💼 HOLD (performance)
- 📤 SELL (performance)

**Key Insights:**
- 💪 Strengths (top 3)
- ⚠️ Risks (top 3 with severity)
- 💡 Opportunities (top 3 with value)
- 🎯 Priority Action Items (urgent, high, medium)

## Chat Interface

**Features:**
- Message bubbles (user vs AI)
- Streaming text effect
- Typing indicators
- Avatar icons (👤 user, 🤖 AI)
- Timestamps
- Clear chat button
- Suggested prompts (mode-specific)

**Keyboard Shortcuts:**
- `Enter` - Send message
- `Shift+Enter` - New line (in future multi-line input)

## Styling

Built with Tailwind CSS using:
- Gradient backgrounds
- Smooth animations
- Responsive grid layouts
- Shadow effects
- Rounded corners
- Color-coded elements

## Mock vs Live Mode

**Mock Mode** (default):
- No API key needed
- Instant responses
- Realistic data based on input
- Good for development/testing
- Free!

**Live Mode**:
- Requires `VITE_ANTHROPIC_API_KEY`
- Real Claude 3 Opus AI
- Actual analysis and insights
- ~$0.20-$0.40 per analysis
- ~$0.05-$0.15 per chat message

Toggle with `useMockData` prop.

## Data Requirements

For best results, provide data from multiple tabs:

**Required:**
- Overview (property specs, metrics, location)

**Highly Recommended:**
- Financial (pro forma, cash flow)
- Competition (comps, market position)

**Recommended:**
- Supply (pipeline, impact)
- Debt (rates, terms)
- Market (demographics, trends)
- Strategy (strategies, arbitrage)

**Optional but Valuable:**
- Due Diligence (checklist, findings)
- Team (members, communications)
- Documents (inventory)

## Performance

**Load Times:**
- Initial analysis: 1-3s (mock) / 3-10s (live)
- Chat message: ~500ms (mock) / 2-5s (live)
- Streaming effect: 30ms per word

**Optimization:**
- Context caching for repeated queries
- Session management for chat continuity
- Lazy loading of recommendation details

## Error Handling

Handles:
- ❌ API failures (shows retry button)
- ⚠️ Network timeouts
- 🔑 Missing API key
- 📊 Insufficient data warnings
- 💬 Chat errors (shows user-friendly message)

## Future Enhancements

Planned:
- [ ] Real streaming from API
- [ ] Voice input/output
- [ ] Export chat transcript
- [ ] Save favorite prompts
- [ ] Multi-deal comparison
- [ ] Historical analysis tracking
- [ ] Custom prompt templates
- [ ] Fine-tuned model support

## Support

For issues or questions:
- Check `/OPUS_INTEGRATION_GUIDE.md`
- Review `/OPUS_QUICK_START.md`
- Check error messages in console
- Verify API key configuration
- Test with mock mode first

---

Built with ❤️ for JEDI RE
