import React from 'react';
import { Box, Typography, TextField, Button } from '@mui/material';

export default function PromptBox() {
  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="h6" sx={{ fontWeight: 700 }}>What are we cooking tonight?</Typography>
      <Typography variant="body2" color="text.secondary">Describe your mood, diet, or upload a fridge photo.</Typography>
      <TextField multiline rows={6} placeholder="I feel cozy and want something vegetarian with mushrooms..." sx={{ bgcolor: 'rgba(255,255,255,0.02)', borderRadius: 1 }} />
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button variant="contained" sx={{ bgcolor: '#FF6B35' }}>Generate</Button>
        <Button variant="outlined" sx={{ borderColor: 'rgba(255,255,255,0.06)' }}>Browse Inspirations</Button>
      </Box>
    </Box>
  );
}
