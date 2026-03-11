import React from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

// Custom render function that includes providers
const AllTheProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <BrowserRouter>
      {children}
    </BrowserRouter>
  );
};

const customRender = (
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) => render(ui, { wrapper: AllTheProviders, ...options });

export * from '@testing-library/react';
export { customRender as render };

// Mock deal data
export const mockDeal = {
  id: 1,
  name: 'Sunset Apartments',
  address: '123 Main St',
  city: 'Atlanta',
  state: 'GA',
  zip: '30308',
  projectType: 'multifamily',
  tier: 'pro',
  acres: 2.5,
  budget: 5000000,
  pipelineStage: 'underwriting',
  daysInStage: 15,
  status: 'active',
  mode: 'acquisition',
  latitude: 33.7756,
  longitude: -84.3963,
  created_at: '2024-01-15T10:00:00Z',
  updated_at: '2024-02-12T14:30:00Z',
};

// Mock user data
export const mockUser = {
  id: 1,
  email: 'test@example.com',
  name: 'Test User',
  role: 'investor',
  subscription_tier: 'pro',
};
