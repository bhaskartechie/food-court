import React from 'react';
import { Container, Typography, Box, Paper } from '@mui/material';

export default function ProfilePage() {
  let user = null;
  try { user = JSON.parse(localStorage.getItem('user')); } catch { user = null; }

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>Profile</Typography>
        {user ? (
          <Box>
            <Typography><strong>Name:</strong> {user.name || '—'}</Typography>
            <Typography><strong>Email:</strong> {user.email || '—'}</Typography>
            <Typography><strong>Role:</strong> {user.role || 'buyer'}</Typography>
          </Box>
        ) : (
          <Typography color="text.secondary">Not logged in.</Typography>
        )}
      </Paper>
    </Container>
  );
}
