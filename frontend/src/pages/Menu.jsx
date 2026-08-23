import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { menusAPI } from '../services/api';
import { Container, Typography, Box, List, ListItem, ListItemText, CircularProgress, Alert } from '@mui/material';

export default function MenuPage() {
  const { sellerId: routeSellerId } = useParams();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const resolvedSellerId = routeSellerId || (() => {
    try {
      const savedUser = JSON.parse(localStorage.getItem('user') || 'null');
      return savedUser?.id ?? null;
    } catch {
      return null;
    }
  })();

  useEffect(() => {
    if (!resolvedSellerId) {
      setError('Seller ID not found. Please log in again.');
      setLoading(false);
      return;
    }

    setLoading(true);
    menusAPI.bySeller(resolvedSellerId)
      .then((res) => setItems(res.data?.items || []))
      .catch((err) => setError(err.response?.data?.detail || 'Failed to load menu'))
      .finally(() => setLoading(false));
  }, [resolvedSellerId]);

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h5" gutterBottom>Menu</Typography>
      {loading && <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>}
      {error && <Alert severity="error">{error}</Alert>}
      {!loading && !error && (
        <List>
          {items.map((it) => (
            <ListItem key={it.id} divider>
              <ListItemText primary={it.name} secondary={`₹${it.price} • ${it.category || 'General'}`} />
            </ListItem>
          ))}
        </List>
      )}
    </Container>
  );
}
