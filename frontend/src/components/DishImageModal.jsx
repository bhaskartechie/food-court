import React from 'react';
import PropTypes from 'prop-types';
import {
  Dialog,
  DialogContent,
  IconButton,
  Box,
  Typography,
  Chip,
  Button,
  Divider,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import AddShoppingCartIcon from '@mui/icons-material/AddShoppingCart';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import DeliveryDiningIcon from '@mui/icons-material/DeliveryDining';
import StorefrontIcon from '@mui/icons-material/Storefront';

const SLOT_SHORT_LABELS = {
  lunch_today: '☀️ Lunch Today',
  dinner_today: '🌙 Dinner Today',
  lunch_tomorrow: '☀️ Lunch Tomorrow',
  dinner_tomorrow: '🌙 Dinner Tomorrow',
  weekend_special: '🎉 Weekend Special',
};

// Fallback high-aesthetic dish photography based on category/keywords
export function getDishImageUrl(item) {
  if (item?.image_url && item.image_url.trim().startsWith('http')) {
    return item.image_url;
  }
  const name = (item?.name || '').toLowerCase();
  const category = (item?.category || '').toLowerCase();

  if (name.includes('paneer') || name.includes('tikka') || name.includes('curry')) {
    return 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=800&auto=format&fit=crop&q=80';
  }
  if (name.includes('biryani') || name.includes('rice') || name.includes('pulao')) {
    return 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&auto=format&fit=crop&q=80';
  }
  if (name.includes('dosa') || name.includes('idli') || name.includes('sambar')) {
    return 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?w=800&auto=format&fit=crop&q=80';
  }
  if (name.includes('cake') || name.includes('jamun') || category === 'desserts' || name.includes('halwa') || name.includes('sweet')) {
    return 'https://images.unsplash.com/photo-1589119908995-c6837fa14848?w=800&auto=format&fit=crop&q=80';
  }
  if (name.includes('tea') || name.includes('coffee') || category === 'beverages' || name.includes('chai') || name.includes('lassi')) {
    return 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=800&auto=format&fit=crop&q=80';
  }
  if (category === 'snacks' || name.includes('samosa') || name.includes('pakora') || name.includes('chaat')) {
    return 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=800&auto=format&fit=crop&q=80';
  }
  if (category === 'non_veg' || category === 'non-veg' || name.includes('chicken') || name.includes('mutton') || name.includes('fish')) {
    return 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=800&auto=format&fit=crop&q=80';
  }
  // Default fresh home-cooked meal
  return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop&q=80';
}

export default function DishImageModal({
  open,
  onClose,
  item,
  sellerName,
  sellerFlat,
  onAddToCart,
  isSelfKitchen = false,
}) {
  if (!item) return null;

  const imageUrl = getDishImageUrl(item);
  const isVeg = item.category === 'veg' || (!item.category?.includes('non') && !item.name?.toLowerCase().includes('chicken') && !item.name?.toLowerCase().includes('mutton'));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: '#191928',
          color: '#fff',
          borderRadius: 3,
          overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 24px 48px rgba(0,0,0,0.6)',
          backdropFilter: 'blur(12px)',
        },
      }}
      BackdropProps={{
        sx: {
          bgcolor: 'rgba(10, 10, 18, 0.75)',
          backdropFilter: 'blur(8px)',
        },
      }}
    >
      {/* Top Image Banner */}
      <Box sx={{ position: 'relative', width: '100%', height: { xs: 240, sm: 300 } }}>
        <Box
          component="img"
          src={imageUrl}
          alt={item.name}
          sx={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />

        {/* Category Badge overlay */}
        <Chip
          label={isVeg ? '🟢 Pure Veg' : '🔴 Non-Veg'}
          size="small"
          sx={{
            position: 'absolute',
            top: 16,
            left: 16,
            bgcolor: 'rgba(22, 22, 34, 0.85)',
            color: '#fff',
            backdropFilter: 'blur(6px)',
            fontWeight: 'bold',
            border: '1px solid rgba(255,255,255,0.15)',
          }}
        />

        <IconButton
          onClick={onClose}
          sx={{
            position: 'absolute',
            top: 12,
            right: 12,
            bgcolor: 'rgba(0,0,0,0.6)',
            color: '#fff',
            backdropFilter: 'blur(6px)',
            '&:hover': { bgcolor: 'rgba(0,0,0,0.85)' },
          }}
        >
          <CloseIcon />
        </IconButton>
      </Box>

      {/* Content Section */}
      <DialogContent sx={{ p: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1.5}>
          <Box>
            <Typography variant="h5" fontWeight="bold" color="#fff">
              {item.name}
            </Typography>
            {(sellerName || sellerFlat) && (
              <Typography variant="body2" color="text.secondary" mt={0.5}>
                by <strong>{sellerName || 'Home Chef'}</strong> {sellerFlat ? `(Flat #${sellerFlat})` : ''}
              </Typography>
            )}
          </Box>
          <Typography variant="h5" fontWeight="bold" color="#E05A2B">
            ₹{item.price}
          </Typography>
        </Box>

        {item.description && (
          <Typography variant="body2" color="rgba(255,255,255,0.8)" sx={{ mb: 2.5, lineHeight: 1.6 }}>
            {item.description}
          </Typography>
        )}

        {/* Pre-Order Specifics */}
        {item.is_preorder_only && (
          <Box sx={{ bgcolor: 'rgba(246, 189, 96, 0.1)', border: '1px solid rgba(246, 189, 96, 0.25)', p: 2, borderRadius: 2, mb: 2.5 }}>
            <Box display="flex" alignItems="center" gap={1} mb={1}>
              <AccessTimeIcon sx={{ color: '#F6BD60', fontSize: 20 }} />
              <Typography variant="subtitle2" fontWeight="bold" color="#F6BD60">
                Advance Pre-Order Required
              </Typography>
            </Box>
            {item.preorder_cutoff_time && (
              <Typography variant="body2" color="rgba(255,255,255,0.85)" mb={1}>
                Booking Cutoff: <strong>{item.preorder_cutoff_time}</strong>
              </Typography>
            )}
            {item.available_slots && item.available_slots.length > 0 && (
              <Box display="flex" gap={1} flexWrap="wrap" mt={1}>
                {item.available_slots.map((s) => (
                  <Chip
                    key={s}
                    size="small"
                    label={SLOT_SHORT_LABELS[s] || s}
                    sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: '#F6BD60', fontWeight: 'bold' }}
                  />
                ))}
              </Box>
            )}
          </Box>
        )}

        <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', mb: 2.5 }} />

        {/* Action Button */}
        {isSelfKitchen ? (
          <Button
            variant="outlined"
            fullWidth
            disabled
            size="large"
            sx={{
              borderColor: 'rgba(255,255,255,0.2)',
              color: '#aaa',
              py: 1.5,
              fontSize: '1rem',
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 'bold',
            }}
          >
            🍳 Your Kitchen — Self-ordering disabled
          </Button>
        ) : (
          <Button
            variant="contained"
            fullWidth
            size="large"
            startIcon={<AddShoppingCartIcon />}
            onClick={() => {
              if (onAddToCart) {
                onAddToCart(item);
              }
              onClose();
            }}
            sx={{
              bgcolor: '#E05A2B',
              fontWeight: 'bold',
              py: 1.5,
              fontSize: '1.05rem',
              borderRadius: 2,
              textTransform: 'none',
              '&:hover': { bgcolor: '#c9481c' },
            }}
          >
            {item.is_preorder_only ? `Pre-Order for ₹${item.price}` : `Add to Basket • ₹${item.price}`}
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}

DishImageModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  item: PropTypes.object,
  sellerName: PropTypes.string,
  sellerFlat: PropTypes.string,
  onAddToCart: PropTypes.func,
  isSelfKitchen: PropTypes.bool,
};
