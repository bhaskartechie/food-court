import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SuggestionsBoard from '../pages/SuggestionsBoard';

// Mock API
const mockSuggestions = [
  {
    id: 1,
    title: 'Misal Pav Combo',
    description: 'Extra spicy Kat with butter toasted pav',
    category: 'snacks',
    upvotes_count: 8,
    has_upvoted: false,
    status: 'open',
    proposer: { name: 'Rahul' },
    created_at: '2026-08-30T10:00:00Z',
  },
  {
    id: 2,
    title: 'Gajar Ka Halwa',
    description: 'Slow-cooked in pure desi ghee',
    category: 'desserts',
    upvotes_count: 14,
    has_upvoted: true,
    status: 'open',
    proposer: { name: 'Priya' },
    created_at: '2026-08-30T11:00:00Z',
  },
];

import * as apiModule from '../services/api';

describe('Community Cravings Marketplace', () => {
  beforeEach(() => {
    jest.spyOn(apiModule.suggestionsAPI, 'list').mockResolvedValue({
      data: { suggestions: mockSuggestions },
    });
    jest.spyOn(apiModule.suggestionsAPI, 'create').mockResolvedValue({
      data: { id: 3, title: 'Pav Bhaji' },
    });
    jest.spyOn(apiModule.suggestionsAPI, 'upvote').mockResolvedValue({
      data: { id: 1, upvotes_count: 9, has_upvoted: true },
    });
    jest.spyOn(apiModule.suggestionsAPI, 'claim').mockResolvedValue({
      data: { status: 'claimed' },
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
  test('renders community cravings board and triggers upvote', async () => {
    render(<SuggestionsBoard currentUser={{ id: 1, name: 'Alice', role: 'buyer' }} />);

    // Wait for suggestions to load
    await waitFor(() => {
      expect(screen.getByText(/Misal Pav Combo/i)).toBeInTheDocument();
      expect(screen.getByText(/Gajar Ka Halwa/i)).toBeInTheDocument();
    });

    // Verify Upvote count
    expect(screen.getByText(/8 Votes/i)).toBeInTheDocument();
    expect(screen.getByText(/14 Votes/i)).toBeInTheDocument();

    // Verify Request a Dish button exists
    expect(screen.getByRole('button', { name: /Request a Dish/i })).toBeInTheDocument();
  });

  test('renders chef claim buttons for home chefs', async () => {
    render(<SuggestionsBoard currentUser={{ id: 2, name: 'Chef Bob', role: 'seller' }} />);

    await waitFor(() => {
      expect(screen.getByText(/Misal Pav Combo/i)).toBeInTheDocument();
    });

    // Check chef claim buttons
    const claimButtons = screen.getAllByRole('button', { name: /I'll Cook This!/i });
    expect(claimButtons.length).toBeGreaterThanOrEqual(1);
  });
});

