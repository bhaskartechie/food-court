import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SuggestionsBoard from '../pages/SuggestionsBoard';
import * as apiModule from '../services/api';

describe('Cravings Matching Module & Seller Acceptance View', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  test('Seller Mode renders Chef Demand Radar and Matched for You tab with match score badges', async () => {
    const mockSeller = {
      id: 202,
      name: 'Chef Meera',
      email: 'chefmeera@society.com',
      role: 'seller',
      flat_number: '102',
    };

    const mockMatchedSuggestions = [
      {
        id: 801,
        title: 'Authentic Hyderabadi Dum Biryani',
        description: 'Need authentic biryani for family lunch',
        category: 'non-veg',
        upvotes_count: 6,
        status: 'open',
        user_name: 'Resident Ravi',
        user_flat: '502',
        match_score: 92,
        match_level: 'HIGH',
        match_reasons: ['Category Match: Active NON-VEG specialist', 'Existing Menu Match: You already cook Dum Biryani'],
        matching_menu_items: [{ id: 11, name: 'Hyderabadi Dum Biryani', price: 240 }],
      },
    ];

    jest.spyOn(apiModule.suggestionsAPI, 'listMatched').mockResolvedValue({
      data: { suggestions: mockMatchedSuggestions, total: 1 },
    });
    jest.spyOn(apiModule.menusAPI, 'bySeller').mockResolvedValue({
      data: { items: [{ id: 11, name: 'Hyderabadi Dum Biryani', price: 240, category: 'non-veg' }] },
    });

    render(
      <MemoryRouter>
        <SuggestionsBoard currentUser={mockSeller} />
      </MemoryRouter>
    );

    // Verify Chef Demand Radar banner
    await waitFor(() => {
      expect(screen.getByText(/Chef Demand Radar 🎯/i)).toBeInTheDocument();
      expect(screen.getByText(/Matched for Your Kitchen/i)).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /🎯 Matched for You/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /🔥 High Demand/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /🍳 My Accepted Batches/i })).toBeInTheDocument();
    });

    // Verify Match Score badge on craving card
    expect(screen.getByText(/🎯 92% Match/i)).toBeInTheDocument();
    expect(screen.getByText('Authentic Hyderabadi Dum Biryani')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Accept & Cook 🍳/i })).toBeInTheDocument();
  });

  test('Chef can open Acceptance Modal and switch between New Batch and Link Existing Dish', async () => {
    const mockSeller = { id: 202, name: 'Chef Meera', role: 'seller' };

    const mockSuggestions = [
      {
        id: 802,
        title: 'Special Paneer Tikka',
        category: 'veg',
        upvotes_count: 4,
        status: 'open',
        user_name: 'Neighbor Aman',
      },
    ];

    jest.spyOn(apiModule.suggestionsAPI, 'listMatched').mockResolvedValue({
      data: { suggestions: mockSuggestions },
    });
    jest.spyOn(apiModule.menusAPI, 'bySeller').mockResolvedValue({
      data: { items: [{ id: 15, name: 'Paneer Tikka Platter', price: 180, category: 'veg' }] },
    });
    const claimSpy = jest.spyOn(apiModule.suggestionsAPI, 'claim').mockResolvedValue({
      data: { message: 'Pre-order batch launched for "Special Paneer Tikka"!' },
    });

    render(
      <MemoryRouter>
        <SuggestionsBoard currentUser={mockSeller} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Special Paneer Tikka')).toBeInTheDocument();
    });

    // Click Accept & Cook
    fireEvent.click(screen.getByRole('button', { name: /Accept & Cook 🍳/i }));

    // Verify Dual Modal tabs
    expect(screen.getByText(/Accept Craving: "Special Paneer Tikka"/i)).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /🚀 Launch New Batch/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /🔗 Link Existing Dish/i })).toBeInTheDocument();

    // Click Launch Batch button
    fireEvent.click(screen.getByRole('button', { name: /Launch Batch 🚀/i }));

    await waitFor(() => {
      expect(claimSpy).toHaveBeenCalledWith(
        802,
        expect.objectContaining({
          price: expect.any(Number),
          max_batch_quantity: 15,
        })
      );
    });
  });

  test('Buyer Mode renders claimed craving with chef details and Pre-Order Now button', async () => {
    const mockBuyer = { id: 101, name: 'Buyer John', role: 'buyer' };

    const mockClaimedSuggestions = [
      {
        id: 803,
        title: 'Gujarati Khandvi',
        category: 'snacks',
        upvotes_count: 3,
        status: 'claimed_by_chef',
        user_name: 'Resident Priya',
        accepted_by_seller_id: 202,
        seller_name: 'Chef Patel',
        seller_flat: '302',
        menu_name: 'Special: Gujarati Khandvi',
        menu_price: 90.0,
      },
    ];

    jest.spyOn(apiModule.suggestionsAPI, 'list').mockResolvedValue({
      data: { suggestions: mockClaimedSuggestions },
    });

    render(
      <MemoryRouter>
        <SuggestionsBoard currentUser={mockBuyer} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Gujarati Khandvi')).toBeInTheDocument();
    });

    // Should display chef identity and price
    expect(screen.getByText(/Accepted by Chef Patel/i)).toBeInTheDocument();
    expect(screen.getByText(/Flat #302/i)).toBeInTheDocument();
    expect(screen.getByText(/Special Pre-Order Batch:/i)).toBeInTheDocument();
    expect(screen.getByText(/₹90/)).toBeInTheDocument();

    // Should show direct Pre-Order Now button
    expect(screen.getByRole('link', { name: /Pre-Order Now 🛒/i })).toBeInTheDocument();
  });
});



