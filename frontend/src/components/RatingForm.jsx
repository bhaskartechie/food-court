import React, { useState } from 'react';
import { Box, TextField, Button, Rating } from '@mui/material';
import { ratingsAPI } from '../services/api';

export default function RatingForm({ orderId, onSubmitted }) {
  const [score, setScore] = useState(5);
  const [review, setReview] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!orderId) return;
    setLoading(true);
    try {
      await ratingsAPI.create(orderId, score, review);
      setReview('');
      if (onSubmitted) onSubmitted();
    } catch (_) {
      // ignore for now
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Rating value={score} onChange={(_, v) => setScore(v || 5)} />
      <TextField value={review} onChange={(e) => setReview(e.target.value)} placeholder="Write a short review (optional)" multiline rows={3} />
      <Button type="submit" variant="contained" disabled={loading}>Submit Rating</Button>
    </Box>
  );
}
