import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useParams } from 'react-router-dom';
import { menusAPI, sellersAPI, getErrorMessage } from '../services/api';
import DishImageModal, { getDishImageUrl } from '../components/DishImageModal';
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
  TextField,
  InputAdornment,
  IconButton,
} from '@mui/material';

import AccessTimeIcon from '@mui/icons-material/AccessTime';
import StarIcon from '@mui/icons-material/Star';
import AddShoppingCartIcon from '@mui/icons-material/AddShoppingCart';
import StorefrontIcon from '@mui/icons-material/Storefront';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import DeliveryDiningIcon from '@mui/icons-material/DeliveryDining';

const SLOT_SHORT_LABELS = {
  lunch_today: '☀️ Lunch Today',
  dinner_today: '🌙 Dinner Today',
  lunch_tomorrow: '☀️ Lunch Tomorrow',
  dinner_tomorrow: '🌙 Dinner Tomorrow',
  weekend_special: '🎉 Weekend Special',
};

const CATEGORIES = [
  { id: 'all', label: 'All Items' },
  { id: 'veg', label: 'Veg 🟢' },
  { id: 'non_veg', label: 'Non-Veg 🔴' },
  { id: 'snacks', label: 'Snacks 🥪' },
  { id: 'desserts', label: 'Desserts 🍰' },
  { id: 'beverages', label: 'Beverages ☕' },
];

export default function MenuPage({ onAddToCart }) {
  const { sellerId: routeSellerId } = useParams();
  const [items, setItems] = useState([]);
  const [seller, setSeller] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState(0); // 0: Available Today, 1: Pre-Order Specials
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [modalItem, setModalItem] = useState(null);

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

  const savedUser = (() => {
    try {
      return JSON.parse(localStorage.getItem('user') || 'null');
    } catch {
      return null;
    }
  })();

  const isSelfKitchen = Boolean(
    savedUser && (savedUser.id === Number(resolvedSellerId) || (seller && savedUser.id === seller.id))
  );


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

  // Tab separation
  const instantItems = items.filter((it) => !it.is_preorder_only);
  const preorderItems = items.filter((it) => it.is_preorder_only);
  const tabFilteredItems = activeTab === 0 ? instantItems : preorderItems;

  // Search & Category Filtering
  const displayedItems = tabFilteredItems.filter((it) => {
    const matchesSearch =
      !searchQuery.trim() ||
      it.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (it.description && it.description.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory =
      selectedCategory === 'all' ||
      it.category === selectedCategory ||
      (selectedCategory === 'non_veg' && (it.category === 'non-veg' || it.category === 'non_veg'));

    return matchesSearch && matchesCategory;
  });

  return (
    <Container maxWidth="lg" sx={{ py: 4, color: '#fff' }}>
      {/* Self-Order Notice for Chefs viewing their own kitchen */}
      {isSelfKitchen && (
        <Alert
          severity="warning"
          sx={{
            mb: 3,
            bgcolor: 'rgba(246, 189, 96, 0.15)',
            color: '#F6BD60',
            border: '1px solid rgba(246, 189, 96, 0.3)',
            fontWeight: 'bold',
          }}
        >
          🍳 You are viewing your own kitchen menu. Self-ordering is disabled in buyer mode.
        </Alert>
      )}

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
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: { xs: 'flex-start', sm: 'center' },
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

      {/* Search & Category Filter Header */}
      <Box sx={{ mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              placeholder="Search dishes, ingredients, or spices..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: 'rgba(255,255,255,0.5)' }} />
                  </InputAdornment>
                ),
                endAdornment: searchQuery ? (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setSearchQuery('')} sx={{ color: '#aaa' }}>
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ) : null,
              }}
              sx={{
                bgcolor: '#191928',
                borderRadius: 2,
                '& .MuiOutlinedInput-root': {
                  color: '#fff',
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                  '&:hover fieldset': { borderColor: '#E05A2B' },
                  '&.Mui-focused fieldset': { borderColor: '#E05A2B' },
                },
              }}
            />
          </Grid>

          {/* Category Pills */}
          <Grid item xs={12} md={6}>
            <Box display="flex" gap={1} flexWrap="wrap" justifyContent={{ xs: 'flex-start', md: 'flex-end' }}>
              {CATEGORIES.map((cat) => (
                <Chip
                  key={cat.id}
                  label={cat.label}
                  clickable
                  onClick={() => setSelectedCategory(cat.id)}
                  sx={{
                    bgcolor: selectedCategory === cat.id ? '#E05A2B' : '#191928',
                    color: '#fff',
                    fontWeight: selectedCategory === cat.id ? 'bold' : 'normal',
                    border: '1px solid',
                    borderColor: selectedCategory === cat.id ? '#E05A2B' : 'rgba(255,255,255,0.1)',
                    '&:hover': { bgcolor: selectedCategory === cat.id ? '#c9481c' : '#252538' },
                  }}
                />
              ))}
            </Box>
          </Grid>
        </Grid>
      </Box>

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
        <Box textAlign="center" py={8} color="text.secondary" bgcolor="#191928" borderRadius={3}>
          <StorefrontIcon sx={{ fontSize: 60, opacity: 0.5, mb: 1 }} />
          <Typography variant="h6">
            {searchQuery || selectedCategory !== 'all'
              ? `No dishes found matching your search filter.`
              : activeTab === 0
              ? 'No instant meals ready right now.'
              : 'No scheduled pre-order specials for this chef.'}
          </Typography>
          <Typography variant="body2" mt={0.5}>
            {searchQuery || selectedCategory !== 'all' ? (
              <Button
                size="small"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('all');
                }}
                sx={{ color: '#E05A2B', fontWeight: 'bold', mt: 1 }}
              >
                Clear Filters
              </Button>
            ) : activeTab === 0 ? (
              'Check the Pre-Order Specials tab for upcoming batches!'
            ) : (
              'Suggest a dish to this chef on the Community Cravings board!'
            )}
          </Typography>
        </Box>
      ) : (
        <Grid container spacing={3}>
          {displayedItems.map((item) => {
            const imageUrl = getDishImageUrl(item);
            const isVeg = item.category === 'veg' || (!item.category?.includes('non') && !item.name?.toLowerCase().includes('chicken') && !item.name?.toLowerCase().includes('mutton'));

            return (
              <Grid item xs={12} sm={6} md={4} key={item.id}>
                <Card
                  sx={{
                    bgcolor: '#191928',
                    borderRadius: 3,
                    border: '1px solid rgba(255,255,255,0.08)',
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%',
                    overflow: 'hidden',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: '0 12px 24px rgba(0,0,0,0.3)',
                    },
                  }}
                >
                  {/* Modern Food Image Banner with Zoom Popup Trigger */}
                  <Box
                    sx={{
                      position: 'relative',
                      height: 180,
                      width: '100%',
                      cursor: 'pointer',
                      overflow: 'hidden',
                      '&:hover .dish-img': {
                        transform: 'scale(1.06)',
                      },
                      '&:hover .zoom-overlay': {
                        opacity: 1,
                      },
                    }}
                    onClick={() => setModalItem(item)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && setModalItem(item)}
                    aria-label={`View photo and details of ${item.name}`}
                  >
                    <Box
                      component="img"
                      className="dish-img"
                      src={imageUrl}
                      alt={item.name}
                      sx={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        transition: 'transform 0.35s ease',
                      }}
                    />

                    {/* Gradient overlay on image */}
                    <Box
                      sx={{
                        position: 'absolute',
                        inset: 0,
                        background: 'linear-gradient(to top, rgba(25, 25, 40, 0.9) 0%, transparent 60%)',
                      }}
                    />

                    {/* Zoom Icon Overlay */}
                    <Box
                      className="zoom-overlay"
                      sx={{
                        position: 'absolute',
                        inset: 0,
                        bgcolor: 'rgba(0,0,0,0.4)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: 0,
                        transition: 'opacity 0.2s ease',
                      }}
                    >
                      <Chip
                        icon={<ZoomInIcon sx={{ color: '#fff !important' }} />}
                        label="View Dish"
                        size="small"
                        sx={{ bgcolor: 'rgba(0,0,0,0.7)', color: '#fff', fontWeight: 'bold' }}
                      />
                    </Box>

                    {/* Dietary & Pre-order Badges over image */}
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 10,
                        left: 10,
                        right: 10,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <Chip
                        size="small"
                        label={isVeg ? '🟢 Veg' : '🔴 Non-Veg'}
                        sx={{
                          bgcolor: isVeg ? 'rgba(46, 196, 182, 0.9)' : 'rgba(224, 90, 43, 0.9)',
                          color: '#fff',
                          fontWeight: 'bold',
                          backdropFilter: 'blur(4px)',
                        }}
                      />
                      {item.is_preorder_only && (
                        <Chip
                          size="small"
                          icon={<AccessTimeIcon sx={{ fontSize: '13px !important', color: '#fff !important' }} />}
                          label="Pre-Order"
                          sx={{ bgcolor: 'rgba(246, 189, 96, 0.9)', color: '#191928', fontWeight: 'bold' }}
                        />
                      )}
                    </Box>
                  </Box>

                  <CardContent sx={{ flexGrow: 1, pt: 2 }}>
                    {/* Title & Price */}
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
                      <Typography variant="h6" fontWeight="bold" sx={{ color: '#fff' }}>
                        {item.name}
                      </Typography>
                      <Typography variant="h6" fontWeight="bold" color="#E05A2B">
                        ₹{item.price}
                      </Typography>
                    </Box>

                    <Typography variant="body2" color="text.secondary" mb={2} sx={{ minHeight: 40 }}>
                      {item.description || 'Prepared fresh in a residential home kitchen.'}
                    </Typography>

                    {/* Pre-order Cutoff & Slots */}
                    {item.is_preorder_only && (
                      <Box bgcolor="#1F1F35" p={1.5} borderRadius={2} mb={1}>
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

                  {/* Actions Bar */}
                  <CardActions sx={{ p: 2, pt: 0, justifyContent: 'space-between', alignItems: 'center' }}>
                    <Button
                      size="small"
                      variant="text"
                      onClick={() => setModalItem(item)}
                      sx={{ color: '#2EC4B6', fontWeight: 'bold', textTransform: 'none' }}
                    >
                      Photo & Details →
                    </Button>

                    {isSelfKitchen ? (
                      <Button
                        variant="outlined"
                        disabled
                        size="small"
                        sx={{
                          borderColor: 'rgba(255,255,255,0.2)',
                          color: '#aaa',
                          borderRadius: 2,
                          textTransform: 'none',
                          fontWeight: 'bold',
                        }}
                      >
                        Your Kitchen
                      </Button>
                    ) : (
                      <Button
                        variant="contained"
                        size="small"
                        startIcon={<AddShoppingCartIcon />}
                        onClick={() => {
                          if (onAddToCart) {
                            onAddToCart(item, resolvedSellerId, seller?.name, seller?.flat_number);
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
                    )}
                  </CardActions>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      {/* Modern Dish Image Popup Lightbox Modal */}
      <DishImageModal
        open={Boolean(modalItem)}
        onClose={() => setModalItem(null)}
        item={modalItem}
        sellerName={seller?.name}
        sellerFlat={seller?.flat_number}
        isSelfKitchen={isSelfKitchen}
        onAddToCart={(it) => {
          if (onAddToCart) {
            onAddToCart(it, resolvedSellerId, seller?.name, seller?.flat_number);
          }
        }}
      />
    </Container>
  );
}


MenuPage.propTypes = {
  onAddToCart: PropTypes.func,
};
