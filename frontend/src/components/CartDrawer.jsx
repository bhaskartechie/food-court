import React, { useState } from 'react';
import PropTypes from 'prop-types';
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
  Chip,
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
  Card,
  CardContent,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import ShoppingBagOutlinedIcon from '@mui/icons-material/ShoppingBagOutlined';
import DeliveryDiningIcon from '@mui/icons-material/DeliveryDining';
import StorefrontIcon from '@mui/icons-material/Storefront';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { ordersAPI, getErrorMessage } from '../services/api';
import DirectUPIPaymentModal from './DirectUPIPaymentModal';

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
  cartItems = [],
  onUpdateQuantity,
  onClearCart,
  onOrderSuccess,
}) {
  // State for per-chef configuration: { [sellerId]: { deliveryType, deliverySlot, notes } }
  const [chefConfig, setChefConfig] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [upiModalOrder, setUpiModalOrder] = useState(null);

  // Group cart items by sellerId
  const chefGroups = cartItems.reduce((acc, item) => {
    const sId = String(item.sellerId || item.seller_id || 'default');
    if (!acc[sId]) {
      acc[sId] = {
        sellerId: sId,
        sellerName: item.sellerName || item.seller_name || 'Home Chef',
        sellerFlat: item.sellerFlat || item.seller_flat || null,
        items: [],
      };
    }
    acc[sId].items.push(item);
    return acc;
  }, {});

  const chefGroupList = Object.values(chefGroups);

  const getChefState = (sellerId) => {
    return (
      chefConfig[sellerId] || {
        deliveryType: 'doorstep',
        deliverySlot: 'lunch_today',
        notes: '',
      }
    );
  };

  const updateChefState = (sellerId, field, value) => {
    setChefConfig((prev) => ({
      ...prev,
      [sellerId]: {
        ...getChefState(sellerId),
        [field]: value,
      },
    }));
  };

  const savedUser = (() => {
    try {
      return JSON.parse(localStorage.getItem('user') || 'null');
    } catch {
      return null;
    }
  })();

  const hasSelfOrder = chefGroupList.some(
    (g) => savedUser && String(g.sellerId) === String(savedUser.id)
  );

  const grandTotal = cartItems.reduce(
    (acc, item) => acc + item.price * item.quantity,
    0
  );

  const handleCheckout = async () => {
    if (cartItems.length === 0 || hasSelfOrder) return;
    setLoading(true);
    setError(null);


    try {
      const createdOrders = [];

      // Place an order for each distinct chef kitchen
      for (const group of chefGroupList) {
        const conf = getChefState(group.sellerId);
        const hasPreorder = group.items.some((it) => it.is_preorder_only);

        const payload = {
          seller_id: parseInt(group.sellerId, 10) || 1,
          items: group.items.map((item) => ({
            menu_id: item.id,
            name: item.name,
            quantity: item.quantity,
            price: item.price,
          })),
          notes: conf.notes?.trim() || undefined,
          is_preorder: hasPreorder,
          delivery_slot: hasPreorder ? conf.deliverySlot : undefined,
          delivery_type: conf.deliveryType,
        };

        const res = await ordersAPI.create(payload);
        createdOrders.push(res.data);
      }

      onClearCart();
      if (onOrderSuccess) {
        onOrderSuccess(createdOrders.length === 1 ? createdOrders[0] : createdOrders);
      }
      if (createdOrders.length > 0) {
        setUpiModalOrder(createdOrders[0]);
      } else {
        onClose();
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to place one or more orders. Please try again.'));
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
          width: { xs: '100%', sm: 460 },
          bgcolor: '#141420',
          color: '#fff',
          p: { xs: 2, sm: 3 },
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
            <ShoppingBagOutlinedIcon sx={{ color: '#E05A2B', fontSize: 28 }} />
            <Typography variant="h6" fontWeight="bold">
              Your Basket
            </Typography>
            {cartItems.length > 0 && (
              <Chip
                label={`${cartItems.reduce((sum, it) => sum + it.quantity, 0)} items`}
                size="small"
                sx={{ bgcolor: 'rgba(224,90,43,0.15)', color: '#E05A2B', fontWeight: 'bold' }}
              />
            )}
          </Box>
          <IconButton onClick={onClose} sx={{ color: '#fff' }} aria-label="Close cart">
            <CloseIcon />
          </IconButton>
        </Box>
        <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', mb: 2 }} />
      </Box>

      {/* Cart Content: Multi-Chef Grouped List */}
      <Box sx={{ flexGrow: 1, overflowY: 'auto', pr: 0.5, mb: 2 }}>
        {cartItems.length === 0 ? (
          <Box textAlign="center" py={8} color="text.secondary">
            <StorefrontIcon sx={{ fontSize: 64, opacity: 0.3, mb: 1.5 }} />
            <Typography variant="h6" color="#ddd">
              Your basket is empty
            </Typography>
            <Typography variant="body2" color="text.secondary" mt={0.5}>
              Discover delicious meals from your society's home cooks and add them here!
            </Typography>
          </Box>
        ) : (
          <Box display="flex" flexDirection="column" gap={3}>
            {chefGroupList.map((group) => {
              const conf = getChefState(group.sellerId);
              const hasPreorder = group.items.some((it) => it.is_preorder_only);
              const isSelfGroup = Boolean(savedUser && String(group.sellerId) === String(savedUser.id));
              const chefSubtotal = group.items.reduce(
                (sum, it) => sum + it.price * it.quantity,
                0
              );

              return (
                <Card
                  key={group.sellerId}
                  sx={{
                    bgcolor: '#1C1C2C',
                    borderRadius: 3,
                    border: '1px solid',
                    borderColor: isSelfGroup ? '#F6BD60' : 'rgba(255,255,255,0.08)',
                    overflow: 'visible',
                  }}
                >
                  <CardContent sx={{ p: 2.5 }}>
                    {/* Chef Title & Kitchen Header */}
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5} flexWrap="wrap" gap={1}>
                      <Box>
                        <Typography variant="subtitle1" fontWeight="bold" sx={{ color: '#fff' }}>
                          🍳 {group.sellerName}
                        </Typography>
                        {group.sellerFlat && (
                          <Typography variant="caption" sx={{ color: '#2EC4B6', fontWeight: 'bold' }}>
                            📍 Resident Flat {group.sellerFlat}
                          </Typography>
                        )}
                      </Box>
                      <Box display="flex" alignItems="center" gap={1}>
                        {isSelfGroup && (
                          <Chip
                            label="⚠️ Your Kitchen"
                            size="small"
                            sx={{ bgcolor: 'rgba(246, 189, 96, 0.2)', color: '#F6BD60', fontWeight: 'bold', fontSize: 11 }}
                          />
                        )}
                        <Chip
                          label={`₹${chefSubtotal}`}
                          size="small"
                          sx={{ bgcolor: 'rgba(224, 90, 43, 0.2)', color: '#E05A2B', fontWeight: 'bold' }}
                        />
                      </Box>
                    </Box>

                    <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', mb: 1.5 }} />


                    {/* Item List for this Chef */}
                    <List disablePadding>
                      {group.items.map((item) => (
                        <ListItem
                          key={item.id}
                          disableGutters
                          sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            py: 1,
                            borderBottom: '1px dashed rgba(255,255,255,0.05)',
                          }}
                        >
                          <ListItemText
                            primary={
                              <Typography variant="body2" fontWeight="bold" sx={{ color: '#eee' }}>
                                {item.name}
                              </Typography>
                            }
                            secondary={
                              <Typography variant="caption" sx={{ color: '#aaa' }}>
                                ₹{item.price} each {item.is_preorder_only && '• 📅 Pre-Order'}
                              </Typography>
                            }
                          />

                          {/* Stepper Controls */}
                          <Box display="flex" alignItems="center" gap={1}>
                            <IconButton
                              size="small"
                              onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                              sx={{
                                color: '#fff',
                                bgcolor: 'rgba(255,255,255,0.08)',
                                p: 0.5,
                                '&:hover': { bgcolor: 'rgba(255,255,255,0.15)' },
                              }}
                            >
                              <RemoveIcon fontSize="small" />
                            </IconButton>

                            <Typography variant="body2" fontWeight="bold" sx={{ minWidth: 20, textAlign: 'center' }}>
                              {item.quantity}
                            </Typography>

                            <IconButton
                              size="small"
                              onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                              sx={{
                                color: '#fff',
                                bgcolor: 'rgba(255,255,255,0.08)',
                                p: 0.5,
                                '&:hover': { bgcolor: 'rgba(255,255,255,0.15)' },
                              }}
                            >
                              <AddIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        </ListItem>
                      ))}
                    </List>

                    {/* Fulfillment Option (Delivery vs. Pickup) provided by this Chef */}
                    <Box mt={2} bgcolor="#161622" p={1.5} borderRadius={2}>
                      <Typography variant="caption" fontWeight="bold" sx={{ color: '#F6BD60', display: 'block', mb: 0.5 }}>
                        Fulfillment Option for {group.sellerName}:
                      </Typography>
                      <RadioGroup
                        row
                        value={conf.deliveryType}
                        onChange={(e) => updateChefState(group.sellerId, 'deliveryType', e.target.value)}
                      >
                        <FormControlLabel
                          value="doorstep"
                          control={<Radio size="small" sx={{ color: '#2EC4B6', '&.Mui-checked': { color: '#2EC4B6' } }} />}
                          label={
                            <Typography variant="caption" fontWeight="bold" sx={{ color: '#eee' }}>
                              🚪 Doorstep Delivery
                            </Typography>
                          }
                        />
                        <FormControlLabel
                          value="self_pickup"
                          control={<Radio size="small" sx={{ color: '#F6BD60', '&.Mui-checked': { color: '#F6BD60' } }} />}
                          label={
                            <Typography variant="caption" fontWeight="bold" sx={{ color: '#eee' }}>
                              🚶 Self-Pickup {group.sellerFlat ? `(Flat ${group.sellerFlat})` : ''}
                            </Typography>
                          }
                        />
                      </RadioGroup>
                    </Box>

                    {/* Pre-order Slot Selection if applicable */}
                    {hasPreorder && (
                      <Box mt={1.5}>
                        <FormControl fullWidth size="small">
                          <InputLabel sx={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>
                            📅 Delivery / Pickup Slot
                          </InputLabel>
                          <Select
                            value={conf.deliverySlot}
                            label="📅 Delivery / Pickup Slot"
                            onChange={(e) => updateChefState(group.sellerId, 'deliverySlot', e.target.value)}
                            sx={{
                              color: '#fff',
                              bgcolor: '#161622',
                              fontSize: 13,
                              '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.1)' },
                            }}
                          >
                            {Object.entries(SLOT_LABELS).map(([key, label]) => (
                              <MenuItem key={key} value={key} sx={{ fontSize: 13 }}>
                                {label}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Box>
                    )}

                    {/* Chef-specific notes */}
                    <Box mt={1.5}>
                      <TextField
                        placeholder={`Notes for ${group.sellerName} (e.g. less spice)...`}
                        size="small"
                        fullWidth
                        value={conf.notes}
                        onChange={(e) => updateChefState(group.sellerId, 'notes', e.target.value)}
                        sx={{
                          bgcolor: '#161622',
                          borderRadius: 1,
                          '& .MuiOutlinedInput-root': {
                            fontSize: 12,
                            color: '#fff',
                            '& fieldset': { borderColor: 'rgba(255,255,255,0.08)' },
                          },
                        }}
                      />
                    </Box>
                  </CardContent>
                </Card>
              );
            })}
          </Box>
        )}
      </Box>

      {/* Bottom Summary & Multi-Order Checkout */}
      {cartItems.length > 0 && (
        <Box sx={{ pt: 2, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2, fontSize: 13 }}>
              {error}
            </Alert>
          )}

          {hasSelfOrder && (
            <Alert
              severity="warning"
              sx={{
                mb: 2,
                fontSize: 13,
                bgcolor: 'rgba(246, 189, 96, 0.15)',
                color: '#F6BD60',
                border: '1px solid rgba(246, 189, 96, 0.3)',
                fontWeight: 'bold',
              }}
            >
              ⚠️ You cannot order dishes from your own kitchen. Please remove them to place your order.
            </Alert>
          )}

          <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
            <Typography variant="body2" color="text.secondary">
              Kitchens: <strong>{chefGroupList.length}</strong> • Total Items:{' '}
              <strong>{cartItems.reduce((sum, it) => sum + it.quantity, 0)}</strong>
            </Typography>
            <Button
              size="small"
              onClick={onClearCart}
              startIcon={<DeleteOutlineIcon fontSize="small" />}
              sx={{ color: '#aaa', textTransform: 'none', fontSize: 12, '&:hover': { color: '#ff6b6b' } }}
            >
              Clear Basket
            </Button>
          </Box>

          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              bgcolor: 'rgba(76, 175, 80, 0.12)',
              border: '1px solid rgba(76, 175, 80, 0.3)',
              borderRadius: 1.5,
              px: 1.5,
              py: 0.75,
              mb: 1.5,
            }}
          >
            <Typography variant="caption" sx={{ color: '#4caf50', fontWeight: 'bold' }}>
              Direct P2PM UPI
            </Typography>
            <Typography variant="caption" sx={{ color: '#81c784' }}>
              0% Aggregator Fee • Pay Chef Directly
            </Typography>
          </Box>

          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6" fontWeight="bold">
              Grand Total
            </Typography>
            <Typography variant="h5" fontWeight="bold" sx={{ color: '#E05A2B' }}>
              ₹{grandTotal.toFixed(2)}
            </Typography>
          </Box>

          <Button
            variant="contained"
            fullWidth
            size="large"
            disabled={loading || hasSelfOrder}
            onClick={handleCheckout}
            sx={{
              bgcolor: '#E05A2B',
              fontWeight: 'bold',
              py: 1.5,
              fontSize: '1rem',
              borderRadius: 2,
              textTransform: 'none',
              '&:hover': { bgcolor: '#c9481c' },
            }}
          >
            {loading ? (
              <Box display="flex" alignItems="center" gap={1}>
                <CircularProgress size={20} color="inherit" />
                <span>Processing Orders...</span>
              </Box>
            ) : hasSelfOrder ? (
              'Remove Own Kitchen Dishes to Checkout'
            ) : chefGroupList.length > 1 ? (
              `Place All Orders (${chefGroupList.length} Kitchens) • ₹${grandTotal}`
            ) : (
              `Place Order • ₹${grandTotal}`
            )}
          </Button>

        </Box>
      )}

      {upiModalOrder && (
        <DirectUPIPaymentModal
          open={Boolean(upiModalOrder)}
          onClose={() => {
            setUpiModalOrder(null);
            onClose();
          }}
          orderId={upiModalOrder?.id}
          orderAmount={upiModalOrder?.total_price}
          sellerName={upiModalOrder?.seller_name}
          onSuccess={() => {
            setUpiModalOrder(null);
            onClose();
          }}
        />
      )}
    </Drawer>
  );
}

CartDrawer.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  cartItems: PropTypes.array,
  onUpdateQuantity: PropTypes.func.isRequired,
  onClearCart: PropTypes.func.isRequired,
  onOrderSuccess: PropTypes.func,
};
