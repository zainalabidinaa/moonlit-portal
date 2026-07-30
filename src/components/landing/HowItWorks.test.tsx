import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { HowItWorks } from './HowItWorks';

describe('HowItWorks', () => {
  it('renders the three plain-language steps without addon/Stremio jargon', () => {
    render(<HowItWorks />);
    expect(screen.getByText(/sign up/i)).toBeInTheDocument();
    expect(screen.getByText(/open the app/i)).toBeInTheDocument();
    expect(screen.getByText(/press play/i)).toBeInTheDocument();
    expect(screen.queryByText(/stremio/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/addon/i)).not.toBeInTheDocument();
  });
});
