import React from 'react';
import { Box, Typography } from '@mui/material';
import { Radar } from 'react-chartjs-2';
import { Chart as ChartJS, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend } from 'chart.js';

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

export default function FlavorRadar() {
  const data = {
    labels: ['Umami', 'Acidity', 'Richness', 'Aroma', 'Texture'],
    datasets: [
      {
        label: 'Personalized',
        data: [85, 60, 78, 72, 68],
        backgroundColor: 'rgba(255,107,53,0.12)',
        borderColor: '#FF6B35',
        pointBackgroundColor: '#FFD166',
        pointBorderColor: '#fff',
      },
    ],
  };

  const options = {
    scales: {
      r: {
        angleLines: { color: 'rgba(255,255,255,0.04)' },
        grid: { color: 'rgba(255,255,255,0.03)' },
        suggestedMin: 0,
        suggestedMax: 100,
        ticks: { color: '#ccc' },
      },
    },
    plugins: {
      legend: { display: false },
    },
    maintainAspectRatio: false,
  };

  return (
    <Box sx={{ height: '100%', color: '#fff' }}>
      <Typography variant="h6" sx={{ mb: 1, fontWeight: 700 }}>AI Flavor Profile</Typography>
      <Box sx={{ height: 180 }}>
        <Radar data={data} options={options} />
      </Box>
    </Box>
  );
}
