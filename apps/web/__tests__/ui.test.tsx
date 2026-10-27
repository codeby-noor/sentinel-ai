import { render, screen } from '@testing-library/react';
import { StatusBadge, Empty } from '@/components/ui';
import { apiUrl } from '@/lib/api';

describe('UI primitives', () => {
  it('renders status badges with accessible text', () => {
    render(<StatusBadge value="CRITICAL" />);
    expect(screen.getByText('CRITICAL')).toBeInTheDocument();
  });
  it('renders empty states', () => {
    render(<Empty title="No incidents yet" hint="Create one" />);
    expect(screen.getByText('No incidents yet')).toBeInTheDocument();
  });
});

describe('apiUrl', () => {
  it('joins base and path', () => {
    expect(apiUrl('/api/v1/health')).toContain('/api/v1/health');
  });
});
