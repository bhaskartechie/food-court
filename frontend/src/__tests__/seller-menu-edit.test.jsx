import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SellerDashboardPage from '../pages/SellerDashboard';
import { menusAPI } from '../services/api';

jest.mock('../services/api', () => ({
  __esModule: true,
  sellersAPI: {
    getMe: () =>
      Promise.resolve({
        data: {
          id: 5,
          name: 'Chef Ananya',
          is_open: true,
        },
      }),
    setOpenStatus: () => Promise.resolve({ data: { is_open: true } }),
  },
  ordersAPI: {
    list: () => Promise.resolve({ data: { orders: [], total: 0 } }),
    updateStatus: () => Promise.resolve({ data: {} }),
  },
  menusAPI: {
    bySeller: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    uploadImage: jest.fn(),
    toggleAvailability: jest.fn(),
    updatePortions: jest.fn(),
  },
  paymentsAPI: {
    getBalance: () => Promise.resolve({ data: { current_balance: 500, total_earned: 2500 } }),
    getMaintenanceStatus: () =>
      Promise.resolve({
        data: {
          free_orders_remaining: 35,
          free_orders_total: 50,
          maintenance_balance: 100.0,
          is_availability_allowed: true,
        },
      }),
  },
  deliveryAPI: {
    updateStatus: () => Promise.resolve({ data: {} }),
  },
  ratingsAPI: {
    create: () => Promise.resolve({ data: {} }),
  },
  getErrorMessage: (err, fallback) => fallback,
}));

describe('Seller Menu Management: Edit, Duplicate, Spice Level & Low Stock', () => {
  const mockDishes = [
    {
      id: 101,
      name: 'Hyderabadi Dum Biryani',
      price: 240,
      category: 'non-veg',
      description: 'Fragrant basmati rice layered with spiced chicken.',
      quantity: 2, // triggers low stock warning (1 <= qty <= 3)
      is_available: true,
      spice_level: 'hot',
      image_url: '/uploads/menus/biryani.jpg',
      is_preorder_only: true,
      preorder_cutoff_time: '12:00 PM',
      max_batch_quantity: 20,
    },
    {
      id: 102,
      name: 'Paneer Makhani',
      price: 180,
      category: 'veg',
      description: 'Cottage cheese cubes in creamy tomato gravy.',
      quantity: 12,
      is_available: true,
      spice_level: 'mild',
      image_url: null,
      is_preorder_only: false,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    global.URL.createObjectURL = jest.fn(() => 'blob:mock-image-url');
    menusAPI.bySeller.mockResolvedValue({
      data: {
        items: mockDishes,
        total: 2,
      },
    });
    menusAPI.create.mockResolvedValue({ data: { id: 103, name: 'Hyderabadi Dum Biryani (Copy)' } });
    menusAPI.update.mockResolvedValue({ data: { id: 101, name: 'Hyderabadi Dum Biryani (Spicy Special)' } });
    menusAPI.uploadImage.mockResolvedValue({ data: { image_url: '/uploads/menus/101.jpg' } });
  });

  test('renders dish cards with Spice Level and Low Stock badges', async () => {
    render(<SellerDashboardPage currentUser={{ id: 5, name: 'Chef Ananya', role: 'seller' }} />);

    // Wait for dishes to load
    await waitFor(() => {
      expect(screen.getByText('Hyderabadi Dum Biryani')).toBeInTheDocument();
      expect(screen.getByText('Paneer Makhani')).toBeInTheDocument();
    });

    // Check Spice level chips (Option B)
    expect(screen.getByText('🌶️🌶️🌶️ Hot')).toBeInTheDocument();
    expect(screen.getByText('🌶️ Mild')).toBeInTheDocument();

    // Check Low stock warning badge (Option C: qty = 2)
    expect(screen.getByText('⚠️ Only 2 left')).toBeInTheDocument();
  });

  test('opens Edit dialog pre-filled and updates dish on submit', async () => {
    render(<SellerDashboardPage currentUser={{ id: 5, name: 'Chef Ananya', role: 'seller' }} />);

    await waitFor(() => {
      expect(screen.getByText('Hyderabadi Dum Biryani')).toBeInTheDocument();
    });

    // Click Edit button on the first dish
    const editBtn = screen.getByLabelText('Edit Hyderabadi Dum Biryani');
    fireEvent.click(editBtn);

    // Verify dialog opens in Edit mode
    expect(screen.getByText(/Edit Menu Item/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue('Hyderabadi Dum Biryani')).toBeInTheDocument();
    expect(screen.getByDisplayValue('240')).toBeInTheDocument();

    // Update dish name
    const nameInput = screen.getByDisplayValue('Hyderabadi Dum Biryani');
    fireEvent.change(nameInput, { target: { value: 'Hyderabadi Dum Biryani (Spicy Special)' } });

    // Submit the update
    const updateBtn = screen.getByRole('button', { name: /Update Dish/i });
    fireEvent.click(updateBtn);

    await waitFor(() => {
      expect(menusAPI.update).toHaveBeenCalledWith(
        101,
        expect.objectContaining({
          name: 'Hyderabadi Dum Biryani (Spicy Special)',
          price: 240,
          spice_level: 'hot',
        })
      );
    });
  });

  test('duplicates dish with "(Copy)" suffix and saves as new dish (Option A)', async () => {
    render(<SellerDashboardPage currentUser={{ id: 5, name: 'Chef Ananya', role: 'seller' }} />);

    await waitFor(() => {
      expect(screen.getByText('Hyderabadi Dum Biryani')).toBeInTheDocument();
    });

    // Click Duplicate button on the first dish
    const duplicateBtn = screen.getByLabelText('Duplicate Hyderabadi Dum Biryani');
    fireEvent.click(duplicateBtn);

    // Verify dialog opens in Create mode with "(Copy)" suffix
    expect(screen.getByText(/Create Dish or Pre-Order Batch/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue('Hyderabadi Dum Biryani (Copy)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save Dish/i })).toBeInTheDocument();

    // Submit cloned dish
    const saveBtn = screen.getByRole('button', { name: /Save Dish/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(menusAPI.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Hyderabadi Dum Biryani (Copy)',
          price: 240,
          spice_level: 'hot',
        })
      );
    });
  });
});

