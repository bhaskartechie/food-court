import React from 'react';
import { Container, Typography, Box, Button } from '@mui/material';
import { Link } from 'react-router-dom';

export default function SellerDashboardPage() {
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h5" gutterBottom>Seller Dashboard</Typography>
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 2 }}>
        <Button component={Link} to="/seller/dashboard/menus" variant="contained">Manage Menus</Button>
        <Button component={Link} to="/seller/dashboard/orders" variant="outlined">View Orders</Button>
      </Box>
      <Typography color="text.secondary" sx={{ mt: 3 }}>Seller tools will be added here.</Typography>
    </Container>
  );
}
