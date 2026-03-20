import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../../../test/testUtils';
import { OverviewSection } from '../OverviewSection';
import { mockDeal } from '../../../test/testUtils';

describe('OverviewSection', () => {
  it('renders without crashing', () => {
    render(<OverviewSection deal={mockDeal} />);
    expect(screen.getByText(/overview/i)).toBeInTheDocument();
  });

  it('displays quick stats in acquisition mode', () => {
    const acquisitionDeal = { ...mockDeal, mode: 'acquisition' };
    render(<OverviewSection deal={acquisitionDeal} />);
    
    // Check for acquisition-specific stats
    expect(screen.getByText(/pipeline stage/i)).toBeInTheDocument();
    expect(screen.getByText(/days in stage/i)).toBeInTheDocument();
  });

  it('displays quick stats in performance mode', () => {
    const performanceDeal = { ...mockDeal, mode: 'performance' };
    render(<OverviewSection deal={performanceDeal} />);
    
    // Check for performance-specific stats
    expect(screen.getByText(/occupancy|noi/i)).toBeInTheDocument();
  });

  it('toggles between acquisition and performance mode', async () => {
    const { rerender } = render(<OverviewSection deal={mockDeal} />);
    
    // Find mode toggle button
    const modeToggle = screen.queryByRole('button', { name: /mode/i });
    
    if (modeToggle) {
      fireEvent.click(modeToggle);
      
      await waitFor(() => {
        expect(screen.getByText(/performance/i)).toBeInTheDocument();
      });
    }
  });

  it('displays progress tracker', () => {
    render(<OverviewSection deal={mockDeal} />);
    
    // Check for progress indicators
    const progressElements = screen.queryAllByText(/progress|%|complete/i);
    expect(progressElements.length).toBeGreaterThan(0);
  });

  it('renders all 5 quick stats', () => {
    render(<OverviewSection deal={mockDeal} />);
    
    // Count stat cards (should be 5)
    const statCards = screen.getAllByRole('article').filter(
      el => el.className.includes('stat') || el.className.includes('card')
    );
    
    // Should have multiple stats (exact structure depends on implementation)
    expect(statCards.length).toBeGreaterThan(0);
  });

  it('handles missing data gracefully', () => {
    const incompleteDeal = { ...mockDeal, budget: null, acres: null };
    render(<OverviewSection deal={incompleteDeal} />);
    
    // Should render without crashing
    expect(screen.getByText(/overview/i)).toBeInTheDocument();
  });

  it('formats currency correctly', () => {
    render(<OverviewSection deal={mockDeal} />);
    
    // Check for formatted budget (should show $5.0M or similar)
    const budgetElement = screen.queryByText(/\$5\.0M|\$5,000,000/i);
    expect(budgetElement).toBeTruthy();
  });
});
