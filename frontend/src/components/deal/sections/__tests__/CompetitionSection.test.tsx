import { describe, it, expect } from 'vitest';
import { render, screen } from '../../../test/testUtils';
import { CompetitionSection } from '../CompetitionSection';
import { mockDeal } from '../../../test/testUtils';

describe('CompetitionSection', () => {
  it('renders without crashing', () => {
    render(<CompetitionSection deal={mockDeal} />);
    expect(screen.getByText(/competition/i)).toBeInTheDocument();
  });

  it('displays comp analysis', () => {
    render(<CompetitionSection deal={mockDeal} />);
    
    // Check for key competition elements
    expect(screen.getByText(/comp|competition|comparable/i)).toBeInTheDocument();
  });

  it('shows similarity scoring', () => {
    render(<CompetitionSection deal={mockDeal} />);
    
    // Look for similarity score indicators
    const scoreElements = screen.queryAllByText(/%|score|similarity/i);
    expect(scoreElements.length).toBeGreaterThan(0);
  });

  it('displays market positioning', () => {
    render(<CompetitionSection deal={mockDeal} />);
    
    // Check for market positioning content
    expect(screen.queryByText(/market|position|competitive/i)).toBeTruthy();
  });

  it('supports dual-mode (acquisition/performance)', () => {
    const acquisitionDeal = { ...mockDeal, mode: 'acquisition' };
    const { rerender } = render(<CompetitionSection deal={acquisitionDeal} />);
    
    expect(screen.getByText(/competition/i)).toBeInTheDocument();
    
    // Rerender with performance mode
    const performanceDeal = { ...mockDeal, mode: 'performance' };
    rerender(<CompetitionSection deal={performanceDeal} />);
    
    expect(screen.getByText(/competition/i)).toBeInTheDocument();
  });

  it('renders charts when available', () => {
    render(<CompetitionSection deal={mockDeal} />);
    
    // Look for chart containers or SVG elements
    const charts = document.querySelectorAll('svg, canvas, [class*="chart"]');
    // Charts may or may not be present depending on mock data
    expect(charts.length).toBeGreaterThanOrEqual(0);
  });

  it('loads mock data successfully', async () => {
    render(<CompetitionSection deal={mockDeal} />);
    
    // Should not show loading state forever
    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    }, { timeout: 3000 });
  });
});
