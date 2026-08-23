import React from 'react';
import { Box, Typography, Card, CardContent, CardActions, Button, Grid } from '@mui/material';

const items = [
  { id: 1, title: 'Date Night Ribeye Kit', price: 59 },
  { id: 2, title: 'Vegetarian Mezze Bundle', price: 39 },
  { id: 3, title: 'Saffron Seafood Box', price: 69 },
  { id: 4, title: 'Comfort Pasta Pack', price: 29 },
];

export default function CuratedRow() {
  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>Curated Ingredient Bundles</Typography>
      <Grid container spacing={2}>
        {items.map((it) => (
          <Grid item key={it.id} xs={12} sm={6} md={3}>
            <Card sx={{ borderRadius: 2, border: '1px solid rgba(255,107,53,0.08)', background: 'linear-gradient(180deg, rgba(255,255,255,0.01), transparent)', overflow: 'hidden' }}>
              <CardContent>
                <img src={`/assets/placeholder-${it.id % 2 === 0 ? 'veg' : 'meat'}.svg`} alt="bundle" style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 6, marginBottom: 8 }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{it.title}</Typography>
                <Typography variant="body2" color="text.secondary">Curated by AI Chef • {it.price} USD</Typography>
              </CardContent>
              <CardActions>
                <Button size="small" variant="contained" sx={{ bgcolor: '#FF6B35' }}>Approve</Button>
                <Button size="small" variant="outlined">Swap</Button>
                <Button size="small" color="inherit">Reject</Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
