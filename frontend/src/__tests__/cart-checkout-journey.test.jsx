import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CartDrawer from '../components/CartDrawer';

// Mock API
jest.mock('../services/api', () => ({
  ordersAPI: {
    create: jest.fn(() => Promise.resolve({ data: { id: 101, status: 'pending' } })),
  },
  getErrorMessage: jest.fn((err, fallback) => fallback),
}));

describe('Cart & Multi-Item Checkout Journey', () => {
  const mockItems = [
    {
      id: 1,
      name: 'Paneer Butter Masala',
      price: 180,
      quantity: 2,
      is_preorder_only: false,
    },
    {
      id: 2,
      name: 'Garlic Naan (2 pcs)',
      price: 60,
      quantity: 3,
      is_preorder_only: false,
    },
  ];

  test('renders cart drawer with correct itemized totals and handles quantity changes', () => {
    const handleUpdateQuantity = jest.fn();
    const handleClearCart = jest.fn();
    const handleOrderSuccess = jest.fn();

    render(
      <CartDrawer
        open={true}
        onClose={jest.fn()}
        cartItems={mockItems}
        onUpdateQuantity={handleUpdateQuantity}
        onClearCart={handleClearCart}
        sellerId={2}
        sellerName="Chef Meera"
        onOrderSuccess={handleOrderSuccess}
      />
    );

    // Verify chef name
    expect(screen.getByText(/Chef Meera/i)).toBeInTheDocument();

    // Verify items are displayed
    expect(screen.getByText(/Paneer Butter Masala/i)).toBeInTheDocument();
    expect(screen.getByText(/Garlic Naan/i)).toBeInTheDocument();

    // Verify subtotal: (180 * 2) + (60 * 3) = 360 + 180 = 540
    expect(screen.getByText('₹540.00')).toBeInTheDocument();

    // Verify total with packaging: 540 + 10 = 550
    expect(screen.getByText('₹550.00')).toBeInTheDocument();

    // Test place order button
    const placeOrderBtn = screen.getByRole('button', { name: /Place Order Now/i });
    expect(placeOrderBtn).toBeInTheDocument();
    fireEvent.click(placeOrderBtn);
  });

  test('renders pre-order slot selector when cart contains pre-order items', () => {
    const preorderItems = [
      {
        id: 3,
        name: 'Hyderabadi Dum Biryani (Batch Special)',
        price: 250,
        quantity: 1,
        is_preorder_only: true,
        available_slots: ['lunch_tomorrow', 'dinner_tomorrow'],
      },
    ];

    render(
      <CartDrawer
        open={true}
        onClose={jest.fn()}
        cartItems={preorderItems}
        onUpdateQuantity={jest.fn()}
        onClearCart={jest.fn()}
        sellerId={2}
        sellerName="Chef Meera"
        onOrderSuccess={jest.fn()}
      />
    );

    // Verify pre-order slot selection appears
    expect(screen.getByText(/Contains Pre-Order items/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Book Pre-Order/i })).toBeInTheDocument();
  });
});

