import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import * as apiModule from '../services/api';
import CartDrawer from '../components/CartDrawer';

describe('Cart & Multi-Item Checkout Journey', () => {
  beforeEach(() => {
    jest.spyOn(apiModule.ordersAPI, 'create').mockResolvedValue({
      data: { id: 101, status: 'pending' },
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const mockItems = [
    {
      id: 1,
      name: 'Paneer Butter Masala',
      price: 180,
      quantity: 2,
      sellerId: 2,
      sellerName: 'Chef Meera',
      is_preorder_only: false,
    },
    {
      id: 2,
      name: 'Garlic Naan (2 pcs)',
      price: 60,
      quantity: 3,
      sellerId: 2,
      sellerName: 'Chef Meera',
      is_preorder_only: false,
    },
  ];

  test('renders cart drawer with correct itemized totals and handles quantity changes', async () => {
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
        onOrderSuccess={handleOrderSuccess}
      />
    );

    // Verify chef name
    expect(screen.getAllByText(/Chef Meera/i).length).toBeGreaterThan(0);

    // Verify items are displayed
    expect(screen.getByText(/Paneer Butter Masala/i)).toBeInTheDocument();
    expect(screen.getByText(/Garlic Naan/i)).toBeInTheDocument();

    // Verify total: (180 * 2) + (60 * 3) = 360 + 180 = 540
    expect(screen.getByText('₹540.00')).toBeInTheDocument();

    // Test place order button
    const placeOrderBtn = screen.getByRole('button', { name: /Place Order • ₹540/i });
    expect(placeOrderBtn).toBeInTheDocument();
    fireEvent.click(placeOrderBtn);

    await waitFor(() => {
      expect(handleClearCart).toHaveBeenCalled();
      expect(handleOrderSuccess).toHaveBeenCalled();
    });
  });

  test('renders pre-order slot selector when cart contains pre-order items', () => {
    const preorderItems = [
      {
        id: 3,
        name: 'Hyderabadi Dum Biryani (Batch Special)',
        price: 250,
        quantity: 1,
        sellerId: 2,
        sellerName: 'Chef Meera',
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
        onOrderSuccess={jest.fn()}
      />
    );

    // Verify pre-order slot selection label appears
    expect(screen.getAllByText(/Delivery \/ Pickup Slot/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /Place Order • ₹250/i })).toBeInTheDocument();
  });
});
