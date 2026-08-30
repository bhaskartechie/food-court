import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import * as apiModule from '../services/api';
import RatingForm from '../components/RatingForm';

describe('RatingForm Component', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('submits rating with correct score and review_text payload', async () => {
    const handleSubmitted = jest.fn();
    const createSpy = jest.spyOn(apiModule.ratingsAPI, 'create').mockResolvedValue({
      data: { id: 1, score: 5, review_text: 'Delicious!' },
    });

    render(<RatingForm orderId={101} onSubmitted={handleSubmitted} />);

    const textarea = screen.getByPlaceholderText(/Write a short review/i);
    fireEvent.change(textarea, { target: { value: 'Delicious homemade food!' } });

    const submitBtn = screen.getByRole('button', { name: /Submit Rating/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith(101, 5, 'Delicious homemade food!');
      expect(handleSubmitted).toHaveBeenCalled();
    });
  });

  test('displays friendly error message when 422 validation error occurs without React crash', async () => {
    jest.spyOn(apiModule.ratingsAPI, 'create').mockRejectedValue({
      response: {
        status: 422,
        data: {
          detail: [
            {
              type: 'missing',
              loc: ['body', 'score'],
              msg: 'Field required',
              input: null,
              ctx: {},
            },
          ],
        },
      },
    });

    render(<RatingForm orderId={102} />);

    const submitBtn = screen.getByRole('button', { name: /Submit Rating/i });
    fireEvent.click(submitBtn);

    // Verify error is rendered as clean text in Alert
    await waitFor(() => {
      expect(screen.getByText(/score: Field required/i)).toBeInTheDocument();
    });
  });
});

