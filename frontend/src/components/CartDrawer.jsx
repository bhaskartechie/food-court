import React, { useState } from 'react';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Button,
  Divider,
  List,
  ListItem,
  ListItemText,
  RadioGroup,
  FormControlLabel,
  Radio,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Alert,
  CircularProgress,
} from '@mui/material';

import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import ShoppingBagOutlinedIcon from '@mui/icons-material/ShoppingBagOutlined';
import DeliveryDiningIcon from '@mui/icons-material/DeliveryDining';
import StorefrontIcon from '@mui/icons-material/Storefront';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { ordersAPI, getErrorMessage } from '../services/api';

const SLOT_LABELS = {
  lunch_today: '☀️ Lunch Today (12:30 PM - 1:30 PM)',
  dinner_today: '🌙 Dinner Today (7:30 PM - 8:30 PM)',
  lunch_tomorrow: '☀️ Lunch Tomorrow (12:30 PM - 1:30 PM)',
  dinner_tomorrow: '🌙 Dinner Tomorrow (7:30 PM - 8:30 PM)',
  weekend_special: '🎉 Weekend Special Batch',
  custom: '⏰ Custom Slot',
};

export default function CartDrawer({
  open,
  onClose,
  cartItems,
  onUpdateQuantity,
  onClearCart,
  sellerId,
  sellerName,
  onOrderSuccess,
}) {
  const [deliveryType, setDeliveryType] = useState('doorstep');
  const [deliverySlot, setDeliverySlot] = useState('lunch_today');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const isPreorderCart = cartItems.some((item) => item.is_preorder_only);
  const subtotal = cartItems.reduce(
    (acc, item) => acc + item.price * item.quantity,
    0
  );

  const handleCheckout = async () => {
    if (cartItems.length === 0) return;
    setLoading(true);
    setError(null);

    try {
      const payload = {
        seller_id: sellerId,
        items: cartItems.map((item) => ({
          menu_id: item.id,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
        })),
        notes: notes.trim() || undefined,
        is_preorder: isPreorderCart,
        delivery_slot: isPreorderCart ? deliverySlot : undefined,
        delivery_type: deliveryType,
      };

      const res = await ordersAPI.create(payload);
      onClearCart();
      onClose();
      if (onOrderSuccess) {
        onOrderSuccess(res.data);
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to place order.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 420 },
          bgcolor: '#161622',
          color: '#fff',
          p: 3,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        },
      }}
    >
      {/* Top Header */}
      <Box>
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          mb={2}
        >
          <Box display="flex" alignItems="center" gap={1}>
            <ShoppingBagOutlinedIcon sx={{ color: '#E05A2B' }} />
            <Typography variant="h6" fontWeight="bold">
              Your Kitchen Basket
            </Typography>
          </Box>
          <IconButton onClick={onClose} sx={{ color: '#aaa' }}>
            <CloseIcon />
          </IconButton>
        </Box>

        {sellerName && (
          <Typography variant="body2" color="text.secondary" mb={2}>
            Ordering from <b style={{ color: '#F6BD60' }}>{sellerName}</b>
          </Typography>
        )}

        {isPreorderCart && (
          <Alert
            severity="info"
            icon={<AccessTimeIcon fontSize="inherit" />}
            sx={{
              mb: 2,
              bgcolor: 'rgba(246, 189, 96, 0.15)',
              color: '#F6BD60',
              border: '1px solid rgba(246, 189, 96, 0.3)',
            }}
          >
            Contains Pre-Order items. Choose your scheduled delivery slot.
          </Alert>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Item List */}
        {cartItems.length === 0 ? (
          <Box textAlign="center" py={8} color="text.secondary">
            <Typography variant="body1">Your basket is empty.</Typography>
            <Typography variant="caption">
              Add freshly cooked meals or pre-order specials!
            </Typography>
          </Box>
        ) : (
          <List sx={{ maxHeight: '35vh', overflowY: 'auto', pr: 1 }}>
            {cartItems.map((item) => (
              <ListItem
                key={item.id}
                sx={{
                  bgcolor: '#1F1F2E',
                  borderRadius: 2,
                  mb: 1.5,
                  p: 1.5,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <ListItemText
                  primary={
                    <Box display="flex" alignItems="center" gap={1}>
                      <span style={{ fontSize: 10 }}>
                        {item.category === 'veg' ? '🟢' : '🔴'}
                      </span>
                      <Typography variant="subtitle2" fontWeight="600">
                        {item.name}
                      </Typography>
                    </Box>
                  }
                  secondary={
                    <Typography variant="caption" color="text.secondary">
                      ₹{item.price} each
                    </Typography>
                  }
                />

                <Box
                  display="flex"
                  alignItems="center"
                  gap={1}
                  bgcolor="#2A2A3D"
                  borderRadius={1.5}
                  px={0.5}
                >
                  <IconButton
                    size="small"
                    onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                    sx={{ color: '#fff' }}
                  >
                    <RemoveIcon fontSize="small" />
                  </IconButton>
                  <Typography variant="body2" fontWeight="bold">
                    {item.quantity}
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                    sx={{ color: '#fff' }}
                  >
                    <AddIcon fontSize="small" />
                  </IconButton>
                </Box>
              </ListItem>
            ))}
          </List>
        )}

        {/* Pre-Order Slot Picker */}
        {cartItems.length > 0 && isPreorderCart && (
          <Box mt={2}>
            <FormControl fullWidth size="small">
              <InputLabel sx={{ color: '#aaa' }}>Scheduled Delivery Slot</InputLabel>
              <Select
                value={deliverySlot}
                label="Scheduled Delivery Slot"
                onChange={(e) => setDeliverySlot(e.target.value)}
                sx={{
                  bgcolor: '#1F1F2E',
                  color: '#fff',
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(255,255,255,0.1)',
                  },
                }}
              >
                {Object.entries(SLOT_LABELS).map(([k, v]) => (
                  <MenuItem key={k} value={k}>
                    {v}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        )}

        {/* Fulfillment Type Radio */}
        {cartItems.length > 0 && (
          <Box mt={2}>
            <Typography variant="caption" color="text.secondary" mb={1} display="block">
              Fulfillment Method
            </Typography>
            <RadioGroup
              row
              value={deliveryType}
              onChange={(e) => setDeliveryType(e.target.value)}
            >
              <FormControlLabel
                value="doorstep"
                control={<Radio sx={{ color: '#E05A2B', '&.Mui-checked': { color: '#E05A2B' } }} />}
                label={
                  <Box display="flex" alignItems="center" gap={0.5}>
                    <DeliveryDiningIcon fontSize="small" />
                    <Typography variant="body2">Doorstep Delivery</Typography>
                  </Box>
                }
              />
              <FormControlLabel
                value="self_pickup"
                control={<Radio sx={{ color: '#E05A2B', '&.Mui-checked': { color: '#E05A2B' } }} />}
                label={
                  <Box display="flex" alignItems="center" gap={0.5}>
                    <StorefrontIcon fontSize="small" />
                    <Typography variant="body2">Self-Pickup</Typography>
                  </Box>
                }
              />
            </RadioGroup>
          </Box>
        )}

        {/* Special Instructions */}
        {cartItems.length > 0 && (
          <TextField
            fullWidth
            size="small"
            placeholder="Special instructions (e.g. less spice, ring bell)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            sx={{
              mt: 2,
              bgcolor: '#1F1F2E',
              borderRadius: 1,
              '& .MuiInputBase-input': { color: '#fff' },
            }}
          />
        )}
      </Box>

        {/* Bottom Summary & CTA */}
      <Box pt={2}>
        <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)', mb: 2 }} />

        <Box display="flex" justifyContent="space-between" mb={1}>
          <Typography variant="body2" color="text.secondary">
            Items Subtotal
          </Typography>
          <Typography variant="body2" fontWeight="bold">
            ₹{subtotal.toFixed(2)}
          </Typography>
        </Box>

        <Box display="flex" justifyContent="space-between" mb={1}>
          <Typography variant="body2" color="text.secondary">
            Society Doorstep Delivery
          </Typography>
          <Typography variant="body2" color="#2EC4B6" fontWeight="bold">
            {deliveryType === 'doorstep' ? 'FREE (Society Member)' : 'Self-Pickup'}
          </Typography>
        </Box>

        <Box display="flex" justifyContent="space-between" mb={2}>
          <Typography variant="body2" color="text.secondary">
            Eco-Packaging & Handling
          </Typography>
          <Typography variant="body2" color="#F6BD60" fontWeight="bold">
            ₹10.00
          </Typography>
        </Box>

        <Box display="flex" justifyContent="space-between" mb={2.5}>
          <Typography variant="h6" fontWeight="bold">
            Total Payable
          </Typography>
          <Typography variant="h6" fontWeight="bold" color="#E05A2B">
            ₹{(subtotal > 0 ? subtotal + 10 : 0).toFixed(2)}
          </Typography>
        </Box>

        {/* Freshness & Punctuality Guarantee */}
        <Box mb={2} p={1.2} bgcolor="rgba(46, 196, 182, 0.1)" borderRadius={2} display="flex" alignItems="center" gap={1}>
          <AccessTimeIcon sx={{ color: '#2EC4B6', fontSize: 18 }} />
          <Typography variant="caption" color="#2EC4B6" fontWeight="600">
            ⚡ Prepared fresh by neighbor chef & delivered hot to your flat door.
          </Typography>
        </Box>

        <Button
          fullWidth
          variant="contained"
          disabled={cartItems.length === 0 || loading}
          onClick={handleCheckout}
          sx={{
            py: 1.5,
            bgcolor: '#E05A2B',
            fontWeight: 'bold',
            fontSize: '1rem',
            borderRadius: 2,
            textTransform: 'none',
            '&:hover': { bgcolor: '#c9481c' },
          }}
        >
          {loading ? (
            <CircularProgress size={24} sx={{ color: '#fff' }} />
          ) : isPreorderCart ? (
            'Book Pre-Order'
          ) : (
            'Place Order Now'
          )}
        </Button>
      </Box>

    </Drawer>
  );
}
