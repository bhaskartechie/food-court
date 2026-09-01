import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import * as apiModule from '../services/api';
import MenuPage from '../pages/Menu';
import CartDrawer from '../components/CartDrawer';

const mockMenuItems = [
  {
    id: 1,
    name: 'Paneer Butter Masala',
    price: 180,
    category: 'veg',
    description: 'Creamy tomato gravy with fresh paneer cubes and mild spices.',
    is_preorder_only: false,
    image_url: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7',
  },
  {
    id: 2,
    name: 'Hyderabadi Chicken Biryani',
    price: 240,
    category: 'non_veg',
    description: 'Fragrant basmati rice layered with spiced marinated chicken.',
    is_preorder_only: true,
    preorder_cutoff_time: '11:00 AM',
    available_slots: ['lunch_today', 'dinner_today'],
  },
  {
    id: 3,
    name: 'Gulab Jamun (2 pcs)',
    price: 70,
    category: 'desserts',
    description: 'Soft melt-in-the-mouth milk solid dumplings in cardamom syrup.',
    is_preorder_only: false,
  },
];

const mockSeller = {
  id: 10,
  name: 'Chef Anita',
  flat_number: '304',
  rating: 4.8,
  review_count: 32,
  on_time_delivery_rate: 97.0,
  avg_delivery_minutes: 20,
};

describe('Menu Search, Category Filtering, and Modern Image Lightbox', () => {
  beforeEach(() => {
    jest.spyOn(apiModule.menusAPI, 'bySeller').mockImplementation(() =>
      Promise.resolve({ data: { items: mockMenuItems } })
    );
    jest.spyOn(apiModule.sellersAPI, 'get').mockImplementation(() =>
      Promise.resolve({ data: mockSeller })
    );
    jest.spyOn(apiModule.ordersAPI, 'create').mockImplementation(() =>
      Promise.resolve({ data: { id: 501, status: 'pending' } })
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('renders menu items and filters by search text and category pills', async () => {
    const handleAddToCart = jest.fn();
    render(
      <MemoryRouter initialEntries={['/menu/10']}>
        <Routes>
          <Route path="/menu/:sellerId" element={<MenuPage onAddToCart={handleAddToCart} />} />
        </Routes>
      </MemoryRouter>
    );

    // Wait for items to load
    await waitFor(() => {
      expect(screen.getByText('Chef Anita')).toBeInTheDocument();
    });

    expect(screen.getByText('Paneer Butter Masala')).toBeInTheDocument();
    expect(screen.getByText('Gulab Jamun (2 pcs)')).toBeInTheDocument();

    // Test Search input
    const searchInput = screen.getByPlaceholderText(/Search dishes, ingredients/i);
    fireEvent.change(searchInput, { target: { value: 'Gulab' } });

    expect(screen.getByText('Gulab Jamun (2 pcs)')).toBeInTheDocument();
    expect(screen.queryByText('Paneer Butter Masala')).not.toBeInTheDocument();

    // Clear search
    fireEvent.change(searchInput, { target: { value: '' } });
    expect(screen.getByText('Paneer Butter Masala')).toBeInTheDocument();

    // Test category pill filtering
    const vegPill = screen.getByText(/Veg 🟢/i);
    fireEvent.click(vegPill);

    expect(screen.getByText('Paneer Butter Masala')).toBeInTheDocument();
    expect(screen.queryByText('Gulab Jamun (2 pcs)')).not.toBeInTheDocument();
  });

  test('opens modern DishImageModal on image banner click and triggers Add to Basket', async () => {
    const handleAddToCart = jest.fn();
    render(
      <MemoryRouter initialEntries={['/menu/10']}>
        <Routes>
          <Route path="/menu/:sellerId" element={<MenuPage onAddToCart={handleAddToCart} />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Paneer Butter Masala')).toBeInTheDocument();
    });

    // Click on photo banner or photo details link
    const viewPhotoBtn = screen.getAllByText(/Photo & Details →/i)[0];
    fireEvent.click(viewPhotoBtn);

    // Lightbox modal should appear
    await waitFor(() => {
      expect(screen.getByText('🟢 Pure Veg')).toBeInTheDocument();
    });

    // Click Add to Basket inside the modal
    const modalAddBtn = screen.getByRole('button', { name: /Add to Basket • ₹180/i });
    fireEvent.click(modalAddBtn);

    expect(handleAddToCart).toHaveBeenCalled();
  });

  test('renders Multi-Chef Cart Drawer with grouped kitchens and fulfillment options', async () => {
    const mockCartItems = [
      {
        id: 1,
        name: 'Paneer Butter Masala',
        price: 180,
        quantity: 2,
        sellerId: '10',
        sellerName: 'Chef Anita',
        sellerFlat: '304',
        is_preorder_only: false,
      },
      {
        id: 2,
        name: 'Hyderabadi Chicken Biryani',
        price: 240,
        quantity: 1,
        sellerId: '20',
        sellerName: 'Chef Rahul',
        sellerFlat: '502',
        is_preorder_only: true,
      },
    ];

    const handleUpdateQuantity = jest.fn();
    const handleClearCart = jest.fn();
    const handleOrderSuccess = jest.fn();

    render(
      <CartDrawer
        open={true}
        onClose={jest.fn()}
        cartItems={mockCartItems}
        onUpdateQuantity={handleUpdateQuantity}
        onClearCart={handleClearCart}
        onOrderSuccess={handleOrderSuccess}
      />
    );

    // Verify both chef kitchens are grouped distinctly
    expect(screen.getAllByText(/Chef Anita/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Resident Flat 304/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Chef Rahul/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Resident Flat 502/i)).toBeInTheDocument();

    // Verify fulfillment options are present
    const doorstepRadios = screen.getAllByLabelText(/Doorstep Delivery/i);
    expect(doorstepRadios.length).toBe(2);

    // Verify Grand Total calculation: 180*2 + 240*1 = 600
    expect(screen.getByText('₹600.00')).toBeInTheDocument();

    // Checkout button reflects 2 kitchens
    const checkoutBtn = screen.getByRole('button', { name: /Place All Orders \(2 Kitchens\) • ₹600/i });
    expect(checkoutBtn).toBeInTheDocument();

    fireEvent.click(checkoutBtn);

    await waitFor(() => {
      expect(handleClearCart).toHaveBeenCalled();
      expect(handleOrderSuccess).toHaveBeenCalled();
    });
  });
});
