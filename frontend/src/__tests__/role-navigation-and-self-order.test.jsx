import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import App from '../App';
import MenuPage from '../pages/Menu';
import SellerDashboardPage from '../pages/SellerDashboard';
import CartDrawer from '../components/CartDrawer';
import * as apiModule from '../services/api';

describe('Role Navigation, User Info Popover, Dynamic Portions & Self-Ordering Prevention', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  test('Buyer Mode Navbar displays only Cravings, Orders, Cart, Switch Mode and clicking User Chip opens Profile Popover', async () => {
    const mockBuyer = {
      id: 101,
      email: 'buyer@society.com',
      name: 'Rohan Sharma',
      role: 'buyer',
      flat_number: '304',
      verification_status: 'verified',
    };
    localStorage.setItem('token', 'fake-buyer-token');
    localStorage.setItem('user', JSON.stringify(mockBuyer));

    render(<App />);

    // In Buyer Mode: Cravings, Orders, Cart, Switch to Chef Mode should be visible
    expect(screen.getByRole('link', { name: /^Cravings$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^Orders$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Switch to Chef Mode/i })).toBeInTheDocument();
    
    // Kitchen Hub must NOT be in the navbar for a buyer
    expect(screen.queryByRole('link', { name: /^Kitchen Hub$/i })).not.toBeInTheDocument();

    // Click the User Chip to open the User Info Popover
    const userChip = screen.getByText(/Rohan Sharma \(buyer\)/i);
    fireEvent.click(userChip);

    // Verify Popover content
    await waitFor(() => {
      expect(screen.getByText('buyer@society.com')).toBeInTheDocument();
      expect(screen.getByText('Flat #304')).toBeInTheDocument();
      expect(screen.getByText('✅ Verified Resident')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /View Full Profile/i })).toBeInTheDocument();
    });
  });

  test('Seller Mode Navbar displays Kitchen Hub and Switch to Buyer Mode', async () => {
    const mockSeller = {
      id: 202,
      email: 'chefmeera@society.com',
      name: 'Chef Meera',
      role: 'seller',
      flat_number: '102',
      verification_status: 'verified',
    };
    localStorage.setItem('token', 'fake-seller-token');
    localStorage.setItem('user', JSON.stringify(mockSeller));

    render(<App />);

    // In Seller Mode: Kitchen Hub must be visible
    expect(screen.getByRole('link', { name: /^Kitchen Hub$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Switch to Buyer Mode/i })).toBeInTheDocument();
  });

  test('Kitchen Hub lists seller dishes with dynamic portion controls and availability toggle', async () => {
    const mockSeller = { id: 202, email: 'chefmeera@society.com', name: 'Chef Meera', role: 'seller' };
    const mockDishes = [
      {
        id: 501,
        seller_id: 202,
        name: 'Hyderabadi Dum Biryani',
        category: 'non-veg',
        price: 240,
        is_available: true,
        quantity: 12,
        is_preorder_only: true,
        preorder_cutoff_time: '11:00 AM',
      },
    ];

    jest.spyOn(apiModule.sellersAPI, 'getMe').mockResolvedValue({ data: { id: 202, is_open: true } });
    jest.spyOn(apiModule.ordersAPI, 'list').mockResolvedValue({ data: { orders: [] } });
    jest.spyOn(apiModule.paymentsAPI, 'getBalance').mockResolvedValue({ data: { current_balance: 1500, total_earned: 4500 } });
    if (apiModule.paymentsAPI.getMaintenanceStatus) {
      jest.spyOn(apiModule.paymentsAPI, 'getMaintenanceStatus').mockResolvedValue({ data: null });
    }
    jest.spyOn(apiModule.menusAPI, 'bySeller').mockResolvedValue({ data: mockDishes });
    const updatePortionsSpy = jest.spyOn(apiModule.menusAPI, 'updatePortions').mockResolvedValue({ data: { id: 501, is_available: true, quantity: 13 } });

    render(
      <MemoryRouter>
        <SellerDashboardPage currentUser={mockSeller} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Hyderabadi Dum Biryani')).toBeInTheDocument();
      expect(screen.getByText('12')).toBeInTheDocument();
      expect(screen.getByText(/IN STOCK 🟢/i)).toBeInTheDocument();
    });

    // Test incrementing portions
    const addButtons = screen.getAllByTestId('AddIcon');
    fireEvent.click(addButtons[0].closest('button'));

    await waitFor(() => {
      expect(updatePortionsSpy).toHaveBeenCalledWith(501, 13);
    });
  });

  test('Menu Page disables Add to Basket and displays notice when chef views own kitchen in buyer mode', async () => {
    const mockChefUser = { id: 303, name: 'Chef Suresh', email: 'suresh@society.com', role: 'buyer' };
    localStorage.setItem('user', JSON.stringify(mockChefUser));

    const mockChefProfile = { id: 303, name: 'Chef Suresh', flat_number: '401' };
    const mockItems = [
      { id: 601, seller_id: 303, name: 'Special Masala Dosa', price: 90, category: 'veg', is_available: true, quantity: 10 },
    ];

    jest.spyOn(apiModule.menusAPI, 'bySeller').mockResolvedValue({ data: { items: mockItems } });
    jest.spyOn(apiModule.sellersAPI, 'get').mockResolvedValue({ data: mockChefProfile });

    render(
      <MemoryRouter initialEntries={['/menu/303']}>
        <Routes>
          <Route path="/menu/:sellerId" element={<MenuPage onAddToCart={jest.fn()} />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      // Self-order alert notice
      expect(screen.getByText(/You are viewing your own kitchen menu. Self-ordering is disabled in buyer mode/i)).toBeInTheDocument();
      // Add to Basket button replaced with disabled "Your Kitchen"
      const yourKitchenBtn = screen.getByRole('button', { name: /^Your Kitchen$/i });
      expect(yourKitchenBtn).toBeDisabled();
    });
  });

  test('Cart Drawer highlights self-kitchen items and blocks checkout', () => {
    const mockChefUser = { id: 404, name: 'Chef Ananya', email: 'ananya@society.com', role: 'buyer' };
    localStorage.setItem('user', JSON.stringify(mockChefUser));

    const cartItems = [
      { id: 701, name: 'Paneer Butter Masala', price: 180, quantity: 2, sellerId: 404, sellerName: 'Chef Ananya' },
    ];

    render(
      <CartDrawer
        open={true}
        onClose={jest.fn()}
        cartItems={cartItems}
        onUpdateQuantity={jest.fn()}
        onClearCart={jest.fn()}
        onOrderSuccess={jest.fn()}
      />
    );

    // Warning chip and Alert
    expect(screen.getByText(/⚠️ Your Kitchen/i)).toBeInTheDocument();
    expect(screen.getByText(/You cannot order dishes from your own kitchen/i)).toBeInTheDocument();

    // Checkout button disabled
    const checkoutBtn = screen.getByRole('button', { name: /Remove Own Kitchen Dishes to Checkout/i });
    expect(checkoutBtn).toBeDisabled();
  });
});

