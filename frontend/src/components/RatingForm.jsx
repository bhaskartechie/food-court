import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Box, TextField, Button, Rating, Alert } from '@mui/material';
import { ratingsAPI, getErrorMessage } from '../services/api';

export default function RatingForm({ orderId, onSubmitted }) {
  const [score, setScore] = useState(5);
  const [review, setReview] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!orderId) return;
    setLoading(true);
    setError(null);
    try {
      await ratingsAPI.create(orderId, score, review);
      setReview('');
      if (onSubmitted) onSubmitted();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to submit rating.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      <Rating value={score} onChange={(_, v) => setScore(v || 5)} />
      <TextField
        value={review}
        onChange={(e) => setReview(e.target.value)}
        placeholder="Write a short review (optional)"
        multiline
        rows={3}
      />
      <Button type="submit" variant="contained" disabled={loading} sx={{ bgcolor: '#E05A2B', '&:hover': { bgcolor: '#c9481c' } }}>
        {loading ? 'Submitting...' : 'Submit Rating'}
      </Button>
    </Box>
  );
}


RatingForm.propTypes = {
  orderId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  onSubmitted: PropTypes.func,
};

