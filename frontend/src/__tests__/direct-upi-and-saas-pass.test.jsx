import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import * as apiModule from '../services/api';
import ProfilePage from '../pages/Profile';
import DirectUPIPaymentModal from '../components/DirectUPIPaymentModal';

describe('Direct P2PM UPI and SaaS Pass Frontend Flows', () => {
  const mockSellerUser = {
    id: 10,
    name: 'Chef Ananya',
    email: 'ananya@societyfood.com',
    role: 'seller',
    flat_number: 'B-402',
  };

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('user', JSON.stringify(mockSellerUser));
    localStorage.setItem('access_token', 'mock_token');

    jest.spyOn(apiModule.sellersAPI, 'getMe').mockResolvedValue({
      data: {
        id: 10,
        name: 'Chef Ananya',
        email: 'ananya@societyfood.com',
        upi_id: 'ananya@okhdfc',
        upi_account_name: 'Ananya Rao',
        bio: 'Fresh homemade meals and treats',
        is_upi_verified: true,
        free_orders_remaining: 45,
        maintenance_balance: 0.0,
      },
    });

    jest.spyOn(apiModule.sellersAPI, 'updateProfile').mockResolvedValue({
      data: { message: 'Profile updated successfully.' },
    });

    jest.spyOn(apiModule.paymentsAPI, 'initiateDirectUPI').mockResolvedValue({
      data: {
        order_id: 101,
        amount: 250.0,
        currency: 'INR',
        seller_name: 'Ananya Rao',
        seller_vpa: 'ananya@okhdfc',
        upi_uri: 'upi://pay?pa=ananya@okhdfc&pn=Ananya%20Rao&am=250.00&cu=INR&tr=ORD_101',
        payment_id: 55,
      },
    });

    jest.spyOn(apiModule.paymentsAPI, 'submitUTR').mockResolvedValue({
      data: {
        id: 55,
        order_id: 101,
        status: 'submitted',
        utr_number: '412345678901',
      },
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('ProfilePage renders UPI configuration and SaaS Pass quota for seller', async () => {
    render(<ProfilePage />);

    // Check user info
    expect(screen.getByText(/Chef Ananya/i)).toBeInTheDocument();
    expect(screen.getByText(/B-402/i)).toBeInTheDocument();

    // Check UPI section
    await waitFor(() => {
      expect(screen.getByText(/Direct P2PM UPI Payment Configuration/i)).toBeInTheDocument();
      expect(screen.getByText(/Direct UPI Active/i)).toBeInTheDocument();
    });

    // Check SaaS Pass quota values
    expect(screen.getByText('45 / 50')).toBeInTheDocument();
    expect(screen.getByText('₹0.00')).toBeInTheDocument();

    // Update UPI ID
    const upiInput = screen.getByLabelText(/Your UPI ID \/ VPA/i);
    fireEvent.change(upiInput, { target: { value: 'ananya.new@okaxis' } });

    const saveBtn = screen.getByRole('button', { name: /Save Payment Details/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(apiModule.sellersAPI.updateProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          upi_id: 'ananya.new@okaxis',
        })
      );
      expect(screen.getByText(/Kitchen payment details updated successfully!/i)).toBeInTheDocument();
    });
  });

  test('DirectUPIPaymentModal displays chef UPI details and submits UTR', async () => {
    const handleClose = jest.fn();
    const handleSuccess = jest.fn();

    render(
      <DirectUPIPaymentModal
        open={true}
        onClose={handleClose}
        orderId={101}
        orderAmount={250.0}
        sellerName="Ananya Rao"
        onSuccess={handleSuccess}
      />
    );

    // Verify loading transitions to loaded UPI data
    await waitFor(() => {
      expect(screen.getByText('₹250.00')).toBeInTheDocument();
      expect(screen.getByText('ananya@okhdfc')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Pay via any UPI App/i })).toBeInTheDocument();
    });

    // Input UTR number
    const utrInput = screen.getByPlaceholderText(/e.g. 412345678901/i);
    fireEvent.change(utrInput, { target: { value: '412345678901' } });

    const submitBtn = screen.getByRole('button', { name: /I've Transferred Payment/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(apiModule.paymentsAPI.submitUTR).toHaveBeenCalledWith(101, '412345678901');
      expect(screen.getByText(/Payment reference submitted!/i)).toBeInTheDocument();
    });
  });
});

