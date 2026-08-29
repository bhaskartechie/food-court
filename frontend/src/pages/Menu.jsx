import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useParams } from 'react-router-dom';
import { menusAPI, sellersAPI, getErrorMessage } from '../services/api';
import {
  Container,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  Avatar,
} from '@mui/material';

import AccessTimeIcon from '@mui/icons-material/AccessTime';
import StarIcon from '@mui/icons-material/Star';
import AddShoppingCartIcon from '@mui/icons-material/AddShoppingCart';
import StorefrontIcon from '@mui/icons-material/Storefront';

const SLOT_SHORT_LABELS = {
  lunch_today: '☀️ Lunch Today',
  dinner_today: '🌙 Dinner Today',
  lunch_tomorrow: '☀️ Lunch Tomorrow',
  dinner_tomorrow: '🌙 Dinner Tomorrow',
  weekend_special: '🎉 Weekend Special',
};

export default function MenuPage({ onAddToCart }) {
  const { sellerId: routeSellerId } = useParams();
  const [items, setItems] = useState([]);
  const [seller, setSeller] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState(0); // 0: Available Today, 1: Pre-Order Specials

  const resolvedSellerId =
    routeSellerId ||
    (() => {
      try {
        const savedUser = JSON.parse(localStorage.getItem('user') || 'null');
        return savedUser?.id ?? null;
      } catch {
        return null;
      }
    })();

  useEffect(() => {
    if (!resolvedSellerId) {
      setError('Seller ID not found.');
      setLoading(false);
      return;
    }

    setLoading(true);
    Promise.all([
      menusAPI.bySeller(resolvedSellerId),
      sellersAPI.get(resolvedSellerId).catch(() => ({ data: null })),
    ])
      .then(([menuRes, sellerRes]) => {
        setItems(menuRes.data?.items || []);
        if (sellerRes?.data) setSeller(sellerRes.data);
      })
      .catch((err) => setError(getErrorMessage(err, 'Failed to load menu.')))
      .finally(() => setLoading(false));
  }, [resolvedSellerId]);

  const instantItems = items.filter((it) => !it.is_preorder_only);
  const preorderItems = items.filter((it) => it.is_preorder_only);
  const displayedItems = activeTab === 0 ? instantItems : preorderItems;

  return (
    <Container maxWidth="lg" sx={{ py: 4, color: '#fff' }}>
      {/* Seller Header Banner */}
      {seller && (
        <Box
          sx={{
            bgcolor: '#191928',
            p: { xs: 2.5, md: 3.5 },
            borderRadius: 3,
            mb: 4,
            border: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            alignItems: 'center',
            gap: 2.5,
          }}
        >
          <Avatar
            sx={{
              width: { xs: 56, md: 72 },
              height: { xs: 56, md: 72 },
              bgcolor: '#E05A2B',
              fontSize: '1.8rem',
              fontWeight: 'bold',
            }}
          >
            {seller.name?.charAt(0) || 'C'}
          </Avatar>
          <Box flexGrow={1}>
            <Box display="flex" alignItems="center" gap={1.5} flexWrap="wrap">
              <Typography variant="h5" fontWeight="bold">
                {seller.name}
              </Typography>
              {seller.flat_number && (
                <Chip
                  size="small"
                  label={`Flat ${seller.flat_number}`}
                  sx={{ bgcolor: 'rgba(255,255,255,0.1)', color: '#fff' }}
                />
              )}
              {seller.rating > 0 && (
                <Chip
                  size="small"
                  icon={<StarIcon sx={{ color: '#F6BD60 !important' }} />}
                  label={`${seller.rating.toFixed(1)} (${seller.review_count || 0} reviews)`}
                  sx={{ bgcolor: 'rgba(246, 189, 96, 0.15)', color: '#F6BD60', fontWeight: 'bold' }}
                />
              )}
              {/* Automated Punctuality Badges */}
              <Chip
                size="small"
                label={`⚡ ${seller.on_time_delivery_rate ?? 100}% On-Time`}
                sx={{ bgcolor: 'rgba(46, 196, 182, 0.15)', color: '#2EC4B6', fontWeight: 'bold' }}
              />
              <Chip
                size="small"
                icon={<AccessTimeIcon sx={{ color: '#F6BD60 !important', fontSize: 16 }} />}
                label={`⏱️ ~${seller.avg_delivery_minutes ?? 25}m avg`}
                sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: '#ddd' }}
              />
            </Box>
            <Typography variant="body2" color="text.secondary" mt={0.5}>
              {seller.bio || 'Authentic society home cook preparing fresh homemade meals.'}
            </Typography>
          </Box>
        </Box>
      )}


      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'rgba(255,255,255,0.1)', mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={(e, val) => setActiveTab(val)}
          textColor="inherit"
          indicatorColor="primary"
        >
          <Tab
            label={`🍽️ Available Today (${instantItems.length})`}
            sx={{ fontWeight: 'bold', textTransform: 'none', fontSize: '1rem' }}
          />
          <Tab
            label={`📅 Pre-Order Specials (${preorderItems.length})`}
            sx={{ fontWeight: 'bold', textTransform: 'none', fontSize: '1rem' }}
          />
        </Tabs>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress sx={{ color: '#E05A2B' }} />
        </Box>
      ) : displayedItems.length === 0 ? (
        <Box textAlign="center" py={8} color="text.secondary">
          <StorefrontIcon sx={{ fontSize: 60, opacity: 0.5, mb: 1 }} />
          <Typography variant="h6">
            {activeTab === 0
              ? 'No instant meals ready right now.'
              : 'No scheduled pre-order specials for this chef.'}
          </Typography>
          <Typography variant="body2">
            {activeTab === 0
              ? 'Check the Pre-Order Specials tab for upcoming batches!'
              : 'Suggest a dish to this chef on the Community Cravings board!'}
          </Typography>
        </Box>
      ) : (
        <Grid container spacing={3}>
          {displayedItems.map((item) => (
            <Grid item xs={12} sm={6} md={4} key={item.id}>
              <Card
                sx={{
                  bgcolor: '#191928',
                  borderRadius: 3,
                  border: '1px solid rgba(255,255,255,0.08)',
                  display: 'flex',
                  flexDirection: 'column',
                  height: '100%',
                  transition: 'transform 0.2s',
                  '&:hover': { transform: 'translateY(-4px)' },
                }}
              >
                <CardContent sx={{ flexGrow: 1 }}>
                  {/* Category and Pre-order Badges */}
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5}>
                    <Chip
                      size="small"
                      label={item.category?.toUpperCase() || 'GENERAL'}
                      sx={{
                        bgcolor:
                          item.category === 'veg'
                            ? 'rgba(46, 196, 182, 0.2)'
                            : 'rgba(224, 90, 43, 0.2)',
                        color: item.category === 'veg' ? '#2EC4B6' : '#E05A2B',
                        fontWeight: 'bold',
                      }}
                    />

                    {item.is_preorder_only && (
                      <Chip
                        size="small"
                        icon={<AccessTimeIcon sx={{ fontSize: '14px !important' }} />}
                        label="Pre-Order Batch"
                        sx={{ bgcolor: 'rgba(246, 189, 96, 0.2)', color: '#F6BD60', fontWeight: 'bold' }}
                      />
                    )}
                  </Box>

                  {/* Title & Price */}
                  <Typography variant="h6" fontWeight="bold" gutterBottom>
                    {item.name}
                  </Typography>

                  <Typography variant="body2" color="text.secondary" mb={2}>
                    {item.description || 'Prepared with fresh ingredients in a home kitchen.'}
                  </Typography>

                  {/* Pre-order Cutoff & Slots */}
                  {item.is_preorder_only && (
                    <Box bgcolor="#1F1F35" p={1.5} borderRadius={2} mb={2}>
                      {item.preorder_cutoff_time && (
                        <Typography variant="caption" display="block" color="#F6BD60" fontWeight="bold" mb={0.5}>
                          ⏰ Booking closes at: {item.preorder_cutoff_time}
                        </Typography>
                      )}
                      {item.available_slots && item.available_slots.length > 0 && (
                        <Box display="flex" gap={0.5} flexWrap="wrap">
                          {item.available_slots.map((s) => (
                            <Chip
                              key={s}
                              size="small"
                              label={SLOT_SHORT_LABELS[s] || s}
                              sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: '#ccc', fontSize: 11 }}
                            />
                          ))}
                        </Box>
                      )}
                    </Box>
                  )}
                </CardContent>

                {/* Price & Add to Cart Action */}
                <CardActions sx={{ p: 2, pt: 0, justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="h6" fontWeight="bold" color="#E05A2B">
                    ₹{item.price}
                  </Typography>

                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<AddShoppingCartIcon />}
                    onClick={() => {
                      if (onAddToCart) {
                        onAddToCart(item, resolvedSellerId, seller?.name);
                      }
                    }}
                    sx={{
                      bgcolor: '#E05A2B',
                      fontWeight: 'bold',
                      borderRadius: 2,
                      textTransform: 'none',
                      '&:hover': { bgcolor: '#c9481c' },
                    }}
                  >
                    {item.is_preorder_only ? 'Pre-Order' : 'Add to Basket'}
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Container>
  );
}

MenuPage.propTypes = {
  onAddToCart: PropTypes.func,
};


