import React from 'react';
import { Box, Container } from '@mui/material';
import AICenterSearch from '../ui/AICenterSearch';
import GenerativeBento from '../ui/GenerativeBento';
import CuratedRow from '../ui/CuratedRow';

export default function LandingPage() {
  return (
    <Box className="app-shell">
      <Container maxWidth="xl" sx={{ pt: 4 }}>
        <AICenterSearch />
        <Box sx={{ mt: 4 }}>
          <GenerativeBento />
        </Box>
        <Box sx={{ mt: 6 }}>
          <CuratedRow />
        </Box>
      </Container>
    </Box>
  );
}
