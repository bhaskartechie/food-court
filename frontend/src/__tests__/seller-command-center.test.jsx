import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SellerDashboardPage from '../pages/SellerDashboard';

const mockProfile = {
  id: 2,
  name: 'Chef Meera',
  is_open: true,
  on_time_delivery_rate: 98.5,
  avg_delivery_minutes: 22,
  punctuality_rating: 4.9,
  total_orders_completed: 48,
};

const mockOrders = [
  {
    id: 201,
    buyer_id: 1,
    seller_id: 2,
    status: 'pending',
    items: [{ menu_id: 1, name: 'Paneer Butter Masala', quantity: 2, price: 180 }],
    total_price: 360,
    is_preorder: true,
    delivery_slot: 'lunch_today',
    delivery_type: 'doorstep',
    created_at: '2026-08-30T09:00:00Z',
  },
];

jest.mock('../services/api', () => ({
  sellersAPI: {
    getMe: jest.fn(() => Promise.resolve({ data: mockProfile })),
    toggleOpen: jest.fn(() => Promise.resolve({ data: { is_open: false } })),
  },
  ordersAPI: {
    list: jest.fn(() => Promise.resolve({ data: { orders: mockOrders } })),
    updateStatus: jest.fn(() => Promise.resolve({ data: { status: 'accepted' } })),
  },
  menusAPI: {
    bySeller: jest.fn(() => Promise.resolve({ data: { items: [] } })),
    create: jest.fn(() => Promise.resolve({ data: { id: 10 } })),
  },
  paymentsAPI: {
    getBalance: jest.fn(() => Promise.resolve({ data: { current_balance: 1450.0, total_earned: 8900.0 } })),
  },
  getErrorMessage: jest.fn((err, fallback) => fallback),
}));

describe('Seller Kitchen Command Center', () => {
  test('renders kitchen hub with punctuality health metrics and batch prep sheet', async () => {
    render(<SellerDashboardPage currentUser={{ id: 2, name: 'Chef Meera', role: 'seller' }} />);

    // Check title
    expect(screen.getByText(/Kitchen Command Center/i)).toBeInTheDocument();

    // Check kitchen status switch
    await waitFor(() => {
      expect(screen.getByText(/KITCHEN OPEN/i)).toBeInTheDocument();
      expect(screen.getByText(/98.5%/i)).toBeInTheDocument();
      expect(screen.getByText(/~22m/i)).toBeInTheDocument();
      expect(screen.getByText(/4.9 ★/i)).toBeInTheDocument();
    });

    // Check batch prep count
    expect(screen.getByText(/Today's Batch Prep Sheet/i)).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument(); // 2 portions for lunch_today

    // Check live orders board
    expect(screen.getByText(/Live Kitchen Orders/i)).toBeInTheDocument();
    expect(screen.getByText(/Order #201/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Accept Order/i })).toBeInTheDocument();
  });
});

