import React from 'react';
import { Box, Typography } from '@mui/material';

export default function Footer() {
  return (
    <Box component="footer" sx={{ py: 3, textAlign: 'center', mt: 6 }}>
      <Typography variant="body2" color="text.secondary">
        © {new Date().getFullYear()} Society Food Platform — Built with ❤️
      </Typography>
    </Box>
  );
}
