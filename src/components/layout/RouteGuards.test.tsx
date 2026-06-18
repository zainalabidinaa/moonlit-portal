import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import { PublicRoute, UserRoute, AdminRoute } from './RouteGuards';

vi.mock('../../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from '../../context/AuthContext';

const mockUseAuth = useAuth as ReturnType<typeof vi.fn>;

function setup(element: React.ReactNode, initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/" element={element} />
        <Route path="/login" element={<div>login page</div>} />
        <Route path="/profiles" element={<div>profiles page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('PublicRoute', () => {
  it('renders children when no session', () => {
    mockUseAuth.mockReturnValue({ session: null, loading: false, role: null });
    setup(<PublicRoute><div>public content</div></PublicRoute>);
    expect(screen.getByText('public content')).toBeInTheDocument();
  });

  it('redirects to /profiles when session exists', () => {
    mockUseAuth.mockReturnValue({ session: { user: {} }, loading: false, role: 'premium' });
    setup(<PublicRoute><div>public content</div></PublicRoute>);
    expect(screen.getByText('profiles page')).toBeInTheDocument();
  });
});

describe('UserRoute', () => {
  it('redirects to /login when no session', () => {
    mockUseAuth.mockReturnValue({ session: null, loading: false, role: null });
    setup(<UserRoute><div>protected</div></UserRoute>);
    expect(screen.getByText('login page')).toBeInTheDocument();
  });

  it('renders children when session exists', () => {
    mockUseAuth.mockReturnValue({ session: { user: {} }, loading: false, role: 'premium' });
    setup(<UserRoute><div>protected</div></UserRoute>);
    expect(screen.getByText('protected')).toBeInTheDocument();
  });
});

describe('AdminRoute', () => {
  it('redirects non-admin to /profiles', () => {
    mockUseAuth.mockReturnValue({ session: { user: {} }, loading: false, role: 'premium' });
    setup(<AdminRoute><div>admin only</div></AdminRoute>);
    expect(screen.getByText('profiles page')).toBeInTheDocument();
  });

  it('renders children for admin', () => {
    mockUseAuth.mockReturnValue({ session: { user: {} }, loading: false, role: 'admin' });
    setup(<AdminRoute><div>admin only</div></AdminRoute>);
    expect(screen.getByText('admin only')).toBeInTheDocument();
  });
});
