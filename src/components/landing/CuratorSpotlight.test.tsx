import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { CuratorSpotlight } from './CuratorSpotlight';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('CuratorSpotlight', () => {
  it('always renders the founder note', () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));
    render(<CuratorSpotlight />);
    expect(screen.getByText(/we were the ones scrolling/i)).toBeInTheDocument();
  });

  it('renders trending titles once the TMDB fetch resolves', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          { id: 1, title: 'Test Movie', poster_path: '/abc.jpg', media_type: 'movie' },
        ],
      })
    );
    render(<CuratorSpotlight />);
    await waitFor(() => expect(screen.getByText('Test Movie')).toBeInTheDocument());
    expect(screen.getByText(/trending now/i)).toBeInTheDocument();
  });

  it('renders no trending strip (but still the founder note) if the fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));
    render(<CuratorSpotlight />);
    await waitFor(() => expect(screen.getByText(/we were the ones scrolling/i)).toBeInTheDocument());
    expect(screen.queryByText(/trending now/i)).not.toBeInTheDocument();
  });
});
