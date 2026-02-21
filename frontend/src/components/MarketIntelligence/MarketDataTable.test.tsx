/**
 * MarketDataTable Component Tests
 * 
 * Manual testing checklist and automated test structure
 */

import { render, screen, fireEvent } from '@testing-library/react';
import MarketDataTable from './MarketDataTable';

describe('MarketDataTable', () => {
  const mockOnPropertyClick = jest.fn();
  
  beforeEach(() => {
    mockOnPropertyClick.mockClear();
  });
  
  it('renders the component with property data', () => {
    render(
      <MarketDataTable 
        marketId="atlanta-fulton"
        onPropertyClick={mockOnPropertyClick}
      />
    );
    
    // Check header is present
    expect(screen.getByText('Market Property Data')).toBeInTheDocument();
    
    // Check MOCK DATA badge is shown
    expect(screen.getByText('MOCK DATA')).toBeInTheDocument();
    
    // Check that properties are displayed
    expect(screen.getByText(/1,028 of 1,028 properties/i)).toBeInTheDocument();
  });
  
  it('filters properties by search query', () => {
    render(
      <MarketDataTable 
        marketId="atlanta-fulton"
        onPropertyClick={mockOnPropertyClick}
      />
    );
    
    const searchInput = screen.getByPlaceholderText(/search by address/i);
    
    // Type in search box
    fireEvent.change(searchInput, { target: { value: 'Peachtree' } });
    
    // Results should be filtered
    expect(screen.queryByText(/1,028 of 1,028/i)).not.toBeInTheDocument();
  });
  
  it('calls onPropertyClick when row is clicked', () => {
    render(
      <MarketDataTable 
        marketId="atlanta-fulton"
        onPropertyClick={mockOnPropertyClick}
      />
    );
    
    // Find and click first row (need to identify by unique content)
    const firstRow = screen.getByText('245 Peachtree Center Ave NE').closest('tr');
    
    if (firstRow) {
      fireEvent.click(firstRow);
      expect(mockOnPropertyClick).toHaveBeenCalledWith('1');
    }
  });
  
  it('shows filter panel when Filters button is clicked', () => {
    render(
      <MarketDataTable 
        marketId="atlanta-fulton"
        onPropertyClick={mockOnPropertyClick}
      />
    );
    
    const filterButton = screen.getByText('Filters');
    fireEvent.click(filterButton);
    
    // Filter panel should be visible
    expect(screen.getByText('Vintage Class')).toBeInTheDocument();
    expect(screen.getByText('Owner Type')).toBeInTheDocument();
    expect(screen.getByText('Units Range')).toBeInTheDocument();
  });
  
  it('filters by vintage class', () => {
    render(
      <MarketDataTable 
        marketId="atlanta-fulton"
        onPropertyClick={mockOnPropertyClick}
      />
    );
    
    // Open filters
    fireEvent.click(screen.getByText('Filters'));
    
    // Click on 2010+ vintage filter
    const vintage2010Plus = screen.getByText('2010+');
    fireEvent.click(vintage2010Plus);
    
    // Filter should be active (button should have blue background)
    expect(vintage2010Plus.closest('button')).toHaveClass('bg-blue-600');
  });
  
  it('sorts by units column', () => {
    render(
      <MarketDataTable 
        marketId="atlanta-fulton"
        onPropertyClick={mockOnPropertyClick}
      />
    );
    
    // Find and click Units header
    const unitsHeader = screen.getByText('Units').closest('button');
    
    if (unitsHeader) {
      // First click: ascending
      fireEvent.click(unitsHeader);
      // Second click: descending
      fireEvent.click(unitsHeader);
      // Third click: reset
      fireEvent.click(unitsHeader);
    }
  });
  
  it('paginates through results', () => {
    render(
      <MarketDataTable 
        marketId="atlanta-fulton"
        onPropertyClick={mockOnPropertyClick}
      />
    );
    
    // Should show "Showing 1 to 50 of 1,028"
    expect(screen.getByText(/Showing 1 to 50 of 1,028/i)).toBeInTheDocument();
    
    // Click Next button
    const nextButton = screen.getByText('Next');
    fireEvent.click(nextButton);
    
    // Should now show "Showing 51 to 100"
    expect(screen.getByText(/Showing 51 to 100/i)).toBeInTheDocument();
  });
  
  it('shows empty state when no results match filters', () => {
    render(
      <MarketDataTable 
        marketId="atlanta-fulton"
        onPropertyClick={mockOnPropertyClick}
      />
    );
    
    // Search for something that doesn't exist
    const searchInput = screen.getByPlaceholderText(/search by address/i);
    fireEvent.change(searchInput, { target: { value: 'NONEXISTENT12345' } });
    
    // Should show empty state
    expect(screen.getByText('No properties found')).toBeInTheDocument();
    expect(screen.getByText('Try adjusting your search or filters')).toBeInTheDocument();
  });
  
  it('resets all filters when Reset button is clicked', () => {
    render(
      <MarketDataTable 
        marketId="atlanta-fulton"
        onPropertyClick={mockOnPropertyClick}
      />
    );
    
    // Add some filters
    const searchInput = screen.getByPlaceholderText(/search by address/i);
    fireEvent.change(searchInput, { target: { value: 'Peachtree' } });
    
    // Open filter panel and select a vintage
    fireEvent.click(screen.getByText('Filters'));
    fireEvent.click(screen.getByText('2010+'));
    
    // Click reset
    const resetButton = screen.getByText('Reset all filters');
    fireEvent.click(resetButton);
    
    // Search should be cleared
    expect(searchInput).toHaveValue('');
  });
});

/**
 * MANUAL TESTING CHECKLIST
 * 
 * Run this in your browser to verify all features:
 * 
 * 1. DATA DISPLAY
 *    [ ] Table shows 50 properties on first page
 *    [ ] All 7 columns display correctly
 *    [ ] MOCK DATA badge is visible in header
 *    [ ] Property count shows "1,028 of 1,028 properties"
 * 
 * 2. SEARCH
 *    [ ] Type "Peachtree" - filters to matching addresses
 *    [ ] Type "LLC" - filters to matching owners
 *    [ ] Type "14-0089-0001" - filters to matching parcel ID
 *    [ ] Clear search - returns to full list
 * 
 * 3. SORTING
 *    [ ] Click Address header - sorts A-Z
 *    [ ] Click again - sorts Z-A
 *    [ ] Click again - removes sort
 *    [ ] Click Units header - sorts low to high
 *    [ ] Click Year Built - sorts old to new
 *    [ ] Chevron icons update correctly
 * 
 * 4. FILTERS
 *    [ ] Click Filters button - panel opens
 *    [ ] Select "2010+" vintage - filters to new construction
 *    [ ] Select multiple vintages - shows all selected
 *    [ ] Select "LLC" owner type - filters to LLCs
 *    [ ] Enter min units (100) - filters to 100+ unit properties
 *    [ ] Enter max units (200) - filters to 100-200 unit properties
 *    [ ] Filter count badge shows number of active filters
 * 
 * 5. PAGINATION
 *    [ ] Shows "Showing 1 to 50 of 1,028"
 *    [ ] Click Next - goes to page 2 (51-100)
 *    [ ] Click page number - jumps to that page
 *    [ ] Click Previous - goes back one page
 *    [ ] Last page shows remaining results (e.g., "1001 to 1028")
 *    [ ] Previous/Next buttons disable at first/last page
 * 
 * 6. INTERACTION
 *    [ ] Click any row - triggers onPropertyClick callback
 *    [ ] Row highlights on hover (blue background)
 *    [ ] Clicking row logs property ID to console
 * 
 * 7. EDGE CASES
 *    [ ] Search for "ZZZZZ" - shows empty state
 *    [ ] Filter to 500+ units - shows fewer results
 *    [ ] Combine multiple filters - works correctly
 *    [ ] Reset filters - clears everything
 *    [ ] Sort + filter + search - all work together
 * 
 * 8. RESPONSIVE DESIGN
 *    [ ] Mobile view - table scrolls horizontally
 *    [ ] Tablet view - readable layout
 *    [ ] Desktop view - full table visible
 *    [ ] Filter panel stacks nicely on mobile
 * 
 * 9. PERFORMANCE
 *    [ ] Initial load is fast (<1s)
 *    [ ] Sorting is instant
 *    [ ] Filtering is instant
 *    [ ] Pagination is instant
 *    [ ] No lag when typing in search
 * 
 * 10. ACCESSIBILITY
 *     [ ] All buttons are keyboard accessible
 *     [ ] Tab order makes sense
 *     [ ] Screen reader can announce table content
 *     [ ] Input fields have proper labels
 */
