import React from 'react';
import { render, screen } from '@testing-library/react';
import App from '../App';

// Mock window.scrollTo
beforeAll(() => {
  window.scrollTo = jest.fn();
});

describe('Authentication & Landing Experience', () => {
  test('renders navigation bar with Society Food brand and Cravings hub button', () => {
    render(<App />);

    // Verify main brand
    expect(screen.getByText('Society Food')).toBeInTheDocument();

    // Verify cravings button
    expect(screen.getByRole('link', { name: /Cravings/i })).toBeInTheDocument();

    // Verify login link is present for guests
    const loginLinks = screen.getAllByRole('link', { name: /Login/i });
    expect(loginLinks.length).toBeGreaterThanOrEqual(1);
  });
});

