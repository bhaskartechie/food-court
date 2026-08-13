import React, { useEffect, useState } from 'react';
import { ordersAPI } from '../services/api';
import { Container, Typography, Box, List, ListItem, ListItemText, CircularProgress, Alert } from '@mui/material';

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    ordersAPI.list()
      .then((res) => setOrders(res.data?.orders || []))
      .catch((err) => setError(err.response?.data?.detail || 'Failed to load orders'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h5" gutterBottom>Your Orders</Typography>
      {loading && <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>}
      {error && <Alert severity="error">{error}</Alert>}
      {!loading && !error && (
        <List>
          {orders.map((o) => (
            <ListItem key={o.id} divider>
              <ListItemText primary={`Order #${o.id} • ${o.status}`} secondary={`${o.items?.length || 0} items • ₹${o.total || 0}`} />
            </ListItem>
          ))}
        </List>
      )}
    </Container>
  );
}
