import React from 'react';
import { Grid, Paper } from '@mui/material';
import RecipeCanvas from './RecipeCanvas';
import FlavorRadar from './FlavorRadar';
import PromptBox from './PromptBox';

export default function GenerativeBento() {
  return (
    <Grid container spacing={3}>
      <Grid item xs={12} md={7}>
        <Paper sx={{ p: 0, height: 560 }} elevation={6}>
          <RecipeCanvas />
        </Paper>
      </Grid>
      <Grid item xs={12} md={5}>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Paper sx={{ p: 2, height: 270 }} elevation={4}>
              <FlavorRadar />
            </Paper>
          </Grid>
          <Grid item xs={12}>
            <Paper sx={{ p: 2, height: 270 }} elevation={4}>
              <PromptBox />
            </Paper>
          </Grid>
        </Grid>
      </Grid>
    </Grid>
  );
}
