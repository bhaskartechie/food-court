import React from 'react';
import { Box, Typography } from '@mui/material';
import StreamingIngredients from './StreamingIngredients';

export default function RecipeCanvas() {
  return (
    <Box sx={{ height: '100%', position: 'relative', background: 'linear-gradient(180deg, rgba(18,18,18,1), rgba(28,28,28,0.95))', color: '#fff', p: 3 }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>Rainy Day Comfort: Wild Mushroom Risotto</Typography>
      <Box sx={{ display: 'flex', gap: 2, height: 'calc(100% - 56px)' }}>
        <Box sx={{ flex: 1, borderRadius: 2, overflow: 'hidden', position: 'relative', backgroundImage: 'linear-gradient(180deg, rgba(0,0,0,0.2), rgba(0,0,0,0.6))' }}>
          {/* Prefer video when available; fallback to placeholder SVG */}
          <video autoPlay loop muted style={{ width: '100%', height: '100%', objectFit: 'cover' }}>
            <source src="/assets/demo-risotto.mp4" type="video/mp4" />
          </video>
          <img src="/assets/demo-risotto.svg" alt="demo risotto" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
          <StreamingIngredients />
          <Box sx={{ position: 'absolute', right: 12, bottom: 12, bgcolor: 'rgba(0,0,0,0.45)', px: 2, py: 1, borderRadius: 2 }}>
            <Typography variant="caption">Stream Ingredients</Typography>
          </Box>
        </Box>
        <Box sx={{ width: 220, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Box sx={{ p: 1, bgcolor: 'rgba(255,255,255,0.02)', borderRadius: 1 }}>
            <Typography variant="subtitle2">Prep Time</Typography>
            <Typography variant="h6">45m</Typography>
          </Box>
          <Box sx={{ p: 1, bgcolor: 'rgba(255,255,255,0.02)', borderRadius: 1 }}>
            <Typography variant="subtitle2">Difficulty</Typography>
            <Typography variant="h6">Medium</Typography>
          </Box>
          <Box sx={{ flex: 1 }}>
            {/* Skeleton streaming visual would appear here */}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
