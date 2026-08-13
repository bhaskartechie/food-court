import React from 'react';
import { Container, Typography } from '@mui/material';

export default function BuyerDashboardPage() {
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h5" gutterBottom>Buyer Dashboard</Typography>
      <Typography color="text.secondary" sx={{ mt: 2 }}>Quick access to orders, favourites, and recent sellers.</Typography>
    </Container>
  );
}
