import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import * as apiModule from '../services/api';
import App from '../App';

describe('Role Selection & Switching Flow', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('allows selecting Home Chef role on Password login tab and logs in as seller', async () => {
    const mockLoginResponse = {
      data: {
        access_token: 'fake-seller-token',
        refresh_token: 'fake-refresh-token',
        user: {
          id: 101,
          email: 'chef.meera@society.local',
          name: 'Chef Meera',
          role: 'seller',
          verification_status: 'verified',
          is_verified: true,
        },
      },
    };

    const loginSpy = jest.spyOn(apiModule.authAPI, 'login').mockResolvedValue(mockLoginResponse);

    render(<App />);

    // Click on Login button in Navbar (exact match)
    const loginNavBtn = screen.getByRole('link', { name: /^Login$/i });
    fireEvent.click(loginNavBtn);

    // Switch to Password Tab by role
    const passwordTab = screen.getByRole('tab', { name: /Password/i });
    fireEvent.click(passwordTab);

    // Fill in credentials
    const emailInput = screen.getByPlaceholderText('you@example.com');
    const passwordInput = screen.getByPlaceholderText('••••••••');
    fireEvent.change(emailInput, { target: { value: 'chef.meera@society.local' } });
    fireEvent.change(passwordInput, { target: { value: 'secret123' } });

    // Select Home Chef role
    const chefRoleBtn = screen.getByRole('button', { name: /🍳 Home Chef/i });
    fireEvent.click(chefRoleBtn);

    // Click Sign In
    const signInBtn = screen.getByRole('button', { name: /Sign In/i });
    fireEvent.click(signInBtn);

    await waitFor(() => {
      expect(loginSpy).toHaveBeenCalledWith(
        'chef.meera@society.local',
        'secret123',
        'seller'
      );
      // Verify user is now authenticated as seller and sees Kitchen Hub in Navbar
      expect(screen.getByText(/Chef Meera \(seller\)/i)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Kitchen Hub/i })).toBeInTheDocument();
    });
  });

  test('allows switching role directly via Navbar Persona Switcher', async () => {
    // Pre-seed authenticated buyer in localStorage
    const initialUser = {
      id: 202,
      email: 'resident.anil@society.local',
      name: 'Anil Kumar',
      role: 'buyer',
      verification_status: 'verified',
      is_verified: true,
    };
    localStorage.setItem('user', JSON.stringify(initialUser));
    localStorage.setItem('access_token', 'initial-buyer-token');

    const switchRoleSpy = jest.spyOn(apiModule.authAPI, 'switchRole').mockResolvedValue({
      data: {
        access_token: 'new-seller-token',
        user: { ...initialUser, role: 'seller' },
      },
    });

    render(<App />);

    // Verify initial buyer navbar
    expect(screen.getByText(/Anil Kumar \(buyer\)/i)).toBeInTheDocument();

    // Click "Switch to Chef Mode" button
    const switchBtn = screen.getByRole('button', { name: /Switch to Chef Mode/i });
    fireEvent.click(switchBtn);

    await waitFor(() => {
      expect(switchRoleSpy).toHaveBeenCalledWith('seller');
      expect(screen.getByText(/Anil Kumar \(seller\)/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Switch to Buyer Mode/i })).toBeInTheDocument();
    });
  });
});

