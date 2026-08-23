import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Box, Chip } from '@mui/material';

// Simple ingredient names for demo
const INGREDIENTS = [
  'Arborio', 'Porcini', 'Mascarpone', 'Parsley', 'White Wine', 'Butter', 'Shallot', 'Garlic'
];

export default function StreamingIngredients({ active = true }) {
  const [particles, setParticles] = useState([]);

  useEffect(() => {
    if (!active) return;
    let id = 0;
    const iv = setInterval(() => {
      const left = 10 + Math.random() * 80; // percent
      const size = 10 + Math.random() * 18; // px font-size proxy
      const text = INGREDIENTS[Math.floor(Math.random() * INGREDIENTS.length)];
      const particle = { id: `${Date.now()}-${id++}`, left, size, text };
      setParticles((p) => [...p, particle]);
      // remove after animation duration (3.5s)
      setTimeout(() => setParticles((p) => p.filter((x) => x.id !== particle.id)), 3800);
    }, 650);

    return () => clearInterval(iv);
  }, [active]);

  return (
    <Box className="streaming-ingredients-overlay" aria-hidden>
      {particles.map((pt) => (
        <Chip
          key={pt.id}
          label={pt.text}
          size="small"
          className="ingredient-chip"
          sx={{ left: `${pt.left}%`, fontSize: `${pt.size}px` }}
        />
      ))}
    </Box>
  );
}

StreamingIngredients.propTypes = {
  active: PropTypes.bool,
};
