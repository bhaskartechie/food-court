import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
  Container,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  Button,
  Chip,
  Switch,
  FormControlLabel,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Divider,
} from '@mui/material';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import DeliveryDiningIcon from '@mui/icons-material/DeliveryDining';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import {
  ordersAPI,
  sellersAPI,
  menusAPI,
  paymentsAPI,
  getErrorMessage,
} from '../services/api';


const SLOT_LABELS = {
  lunch_today: '☀️ Lunch Today',
  dinner_today: '🌙 Dinner Today',
  lunch_tomorrow: '☀️ Lunch Tomorrow',
  dinner_tomorrow: '🌙 Dinner Tomorrow',
  weekend_special: '🎉 Weekend Special',
};

export default function SellerDashboardPage({ currentUser }) {
  const [sellerProfile, setSellerProfile] = useState(null);
  const [orders, setOrders] = useState([]);
  const [balance, setBalance] = useState({ current_balance: 0, total_earned: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  // New Menu Item Dialog
  const [openNewMenu, setOpenNewMenu] = useState(false);
  const [menuName, setMenuName] = useState('');
  const [menuPrice, setMenuPrice] = useState(120);
  const [menuCat, setMenuCat] = useState('veg');
  const [menuDesc, setMenuDesc] = useState('');
  const [isPreorder, setIsPreorder] = useState(true);
  const [cutoffTime, setCutoffTime] = useState('11:00');
  const [maxBatch, setMaxBatch] = useState(15);
  const [submittingMenu, setSubmittingMenu] = useState(false);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [profRes, ordersRes, balRes] = await Promise.all([
        sellersAPI.getMe().catch(() => ({ data: null })),
        ordersAPI.list(0, 50).catch(() => ({ data: { orders: [] } })),
        paymentsAPI.getBalance().catch(() => ({ data: { current_balance: 0, total_earned: 0 } })),
      ]);

      if (profRes.data) setSellerProfile(profRes.data);
      setOrders(ordersRes.data.orders || []);
      setBalance(balRes.data || { current_balance: 0, total_earned: 0 });
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load seller dashboard.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleToggleStoreOpen = async (event) => {
    const newStatus = event.target.checked;
    try {
      await sellersAPI.setOpenStatus(newStatus);
      setSellerProfile((prev) => (prev ? { ...prev, is_open: newStatus } : null));
      setActionSuccess(`Kitchen is now ${newStatus ? 'OPEN 🟢' : 'CLOSED 🔴'}`);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to update store status.'));
    }
  };

  const handleAdvanceOrderStatus = async (orderId, currentStatus) => {
    const nextMap = {
      pending: 'accepted',
      accepted: 'ready',
      ready: 'completed',
    };
    const nextStatus = nextMap[currentStatus];
    if (!nextStatus) return;

    try {
      await ordersAPI.updateStatus(orderId, nextStatus);
      setActionSuccess(`Order #${orderId} updated to ${nextStatus.toUpperCase()}`);
      fetchDashboardData();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to update order status.'));
    }
  };

  const handleCreateMenuSubmit = async () => {
    if (!menuName.trim()) return;
    try {
      setSubmittingMenu(true);
      await menusAPI.create({
        name: menuName,
        price: parseFloat(menuPrice),
        category: menuCat,
        description: menuDesc || undefined,
        is_preorder_only: isPreorder,
        preorder_cutoff_time: isPreorder ? cutoffTime : undefined,
        available_slots: isPreorder ? ['lunch_today', 'dinner_today'] : undefined,
        max_batch_quantity: isPreorder ? parseInt(maxBatch, 10) : 0,
      });
      setOpenNewMenu(false);
      setMenuName('');
      setMenuDesc('');
      setActionSuccess('Menu item / Pre-order batch created successfully!');
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to create menu item.'));
    } finally {
      setSubmittingMenu(false);
    }
  };

  // Compute batch counts per slot
  const preorders = orders.filter((o) => o.is_preorder && o.status !== 'cancelled');
  const slotBatchCounts = preorders.reduce((acc, o) => {
    const slot = o.delivery_slot || 'unassigned';
    const totalItems = (o.items || []).reduce((sum, it) => sum + (it.quantity || 1), 0);
    acc[slot] = (acc[slot] || 0) + totalItems;
    return acc;
  }, {});

  return (
    <Container maxWidth="lg" sx={{ py: 4, color: '#fff' }}>
      {/* Top Header & Store Open Switch */}
      <Box
        sx={{
          bgcolor: '#191928',
          p: { xs: 2.5, md: 3.5 },
          borderRadius: 3,
          mb: 4,
          border: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'flex-start', md: 'center' },
          gap: 2,
        }}
      >
        <Box>
          <Box display="flex" alignItems="center" gap={1.5}>
            <RestaurantIcon sx={{ color: '#E05A2B', fontSize: 32 }} />
            <Typography variant="h4" fontWeight="bold">
              Kitchen Command Center
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" mt={0.5}>
            Manage incoming orders, morning prep batches, and society door deliveries.
          </Typography>
        </Box>

        <Box display="flex" alignItems="center" gap={2}>
          <FormControlLabel
            control={
              <Switch
                checked={sellerProfile?.is_open ?? true}
                onChange={handleToggleStoreOpen}
                color="success"
              />
            }
            label={
              <Typography fontWeight="bold" color={sellerProfile?.is_open ? '#2EC4B6' : '#aaa'}>
                {sellerProfile?.is_open ? 'KITCHEN OPEN' : 'KITCHEN CLOSED'}
              </Typography>
            }
          />

          <Button
            variant="contained"
            startIcon={<AddCircleOutlineIcon />}
            onClick={() => setOpenNewMenu(true)}
            sx={{
              bgcolor: '#E05A2B',
              fontWeight: 'bold',
              borderRadius: 2,
              textTransform: 'none',
              '&:hover': { bgcolor: '#c9481c' },
            }}
          >
            + Add Pre-Order Batch
          </Button>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>{error}</Alert>}
      {actionSuccess && <Alert severity="success" sx={{ mb: 3 }} onClose={() => setActionSuccess(null)}>{actionSuccess}</Alert>}

      {/* Metrics Row */}
      <Grid container spacing={3} mb={4}>
        {/* Pre-Order Batch Prep Sheet */}
        <Grid item xs={12} md={7}>
          <Card sx={{ bgcolor: '#191928', borderRadius: 3, border: '1px solid rgba(255,255,255,0.08)' }}>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <AccessTimeIcon sx={{ color: '#F6BD60' }} />
                <Typography variant="h6" fontWeight="bold">
                  Today's Batch Prep Sheet
                </Typography>
              </Box>

              {Object.keys(slotBatchCounts).length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No pre-orders scheduled yet for upcoming slots.
                </Typography>
              ) : (
                <Grid container spacing={2}>
                  {Object.entries(slotBatchCounts).map(([slot, count]) => (
                    <Grid item xs={6} sm={4} key={slot}>
                      <Box bgcolor="#1F1F35" p={2} borderRadius={2} textAlign="center">
                        <Typography variant="caption" color="text.secondary" display="block">
                          {SLOT_LABELS[slot] || slot}
                        </Typography>
                        <Typography variant="h5" fontWeight="bold" color="#F6BD60" mt={0.5}>
                          {count}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Portions Booked
                        </Typography>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Ledger & Wallet Card */}
        <Grid item xs={12} md={5}>
          <Card sx={{ bgcolor: '#191928', borderRadius: 3, border: '1px solid rgba(255,255,255,0.08)' }}>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <AccountBalanceWalletIcon sx={{ color: '#2EC4B6' }} />
                <Typography variant="h6" fontWeight="bold">
                  Wallet & Earnings
                </Typography>
              </Box>

              <Box display="flex" justifyContent="space-between" mb={2}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Available Balance
                  </Typography>
                  <Typography variant="h4" fontWeight="bold" color="#2EC4B6">
                    ₹{balance.current_balance?.toFixed(2) || '0.00'}
                  </Typography>
                </Box>
                <Box textAlign="right">
                  <Typography variant="caption" color="text.secondary">
                    Total Gross Sales
                  </Typography>
                  <Typography variant="h6" fontWeight="bold" color="#fff">
                    ₹{balance.total_earned?.toFixed(2) || '0.00'}
                  </Typography>
                </Box>
              </Box>

              <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', my: 1.5 }} />

              {/* Speed & Reliability Score */}
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    ⚡ On-Time Rate
                  </Typography>
                  <Typography variant="subtitle2" fontWeight="bold" color="#2EC4B6">
                    {sellerProfile?.on_time_delivery_rate ?? 100}%
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    ⏱️ Avg Speed
                  </Typography>
                  <Typography variant="subtitle2" fontWeight="bold" color="#F6BD60">
                    ~{sellerProfile?.avg_delivery_minutes ?? 25}m
                  </Typography>
                </Box>
                <Box textAlign="right">
                  <Typography variant="caption" color="text.secondary">
                    🎯 Reliability
                  </Typography>
                  <Typography variant="subtitle2" fontWeight="bold" color="#E05A2B">
                    {sellerProfile?.punctuality_rating ?? 5.0} ★
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>


      {/* Orders Board */}
      <Typography variant="h5" fontWeight="bold" mb={2}>
        Live Kitchen Orders ({orders.length})
      </Typography>

      {loading ? (
        <Box display="flex" justifyContent="center" py={6}>
          <CircularProgress sx={{ color: '#E05A2B' }} />
        </Box>
      ) : orders.length === 0 ? (
        <Box textAlign="center" py={6} color="text.secondary" bgcolor="#191928" borderRadius={3}>
          <Typography variant="body1">No active orders yet.</Typography>
        </Box>
      ) : (
        <Grid container spacing={2.5}>
          {orders.map((order) => (
            <Grid item xs={12} md={6} key={order.id}>
              <Card sx={{ bgcolor: '#191928', borderRadius: 3, border: '1px solid rgba(255,255,255,0.08)' }}>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5}>
                    <Typography variant="subtitle1" fontWeight="bold">
                      Order #{order.id}
                    </Typography>

                    <Chip
                      size="small"
                      label={order.status.toUpperCase()}
                      sx={{
                        bgcolor:
                          order.status === 'completed'
                            ? 'rgba(46, 196, 182, 0.2)'
                            : order.status === 'ready'
                            ? 'rgba(246, 189, 96, 0.2)'
                            : 'rgba(224, 90, 43, 0.2)',
                        color:
                          order.status === 'completed'
                            ? '#2EC4B6'
                            : order.status === 'ready'
                            ? '#F6BD60'
                            : '#E05A2B',
                        fontWeight: 'bold',
                      }}
                    />
                  </Box>

                  {/* Pre-order & Delivery Badges */}
                  <Box display="flex" gap={1} mb={2} flexWrap="wrap">
                    {order.is_preorder && (
                      <Chip
                        size="small"
                        icon={<AccessTimeIcon fontSize="small" />}
                        label={SLOT_LABELS[order.delivery_slot] || order.delivery_slot || 'Pre-Order'}
                        sx={{ bgcolor: 'rgba(246, 189, 96, 0.15)', color: '#F6BD60' }}
                      />
                    )}
                    <Chip
                      size="small"
                      icon={<DeliveryDiningIcon fontSize="small" />}
                      label={order.delivery_type === 'doorstep' ? 'Doorstep Delivery' : 'Self-Pickup'}
                      sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: '#fff' }}
                    />
                  </Box>

                  {/* Item List */}
                  <Box mb={2}>
                    {(order.items || []).map((it, idx) => (
                      <Typography key={idx} variant="body2">
                        {it.quantity}x {it.name} <span style={{ color: '#aaa' }}>— ₹{it.price * it.quantity}</span>
                      </Typography>
                    ))}
                  </Box>

                  {order.notes && (
                    <Typography variant="caption" color="#F6BD60" display="block" mb={2}>
                      Note: {order.notes}
                    </Typography>
                  )}

                  <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', mb: 2 }} />

                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="subtitle1" fontWeight="bold" color="#E05A2B">
                      Total: ₹{order.total_price}
                    </Typography>

                    {order.status !== 'completed' && order.status !== 'cancelled' && (
                      <Button
                        variant="contained"
                        size="small"
                        onClick={() => handleAdvanceOrderStatus(order.id, order.status)}
                        sx={{
                          bgcolor:
                            order.status === 'pending'
                              ? '#E05A2B'
                              : order.status === 'accepted'
                              ? '#F6BD60'
                              : '#2EC4B6',
                          color: order.status === 'pending' ? '#fff' : '#000',
                          fontWeight: 'bold',
                          textTransform: 'none',
                        }}
                      >
                        {order.status === 'pending'
                          ? 'Accept Order'
                          : order.status === 'accepted'
                          ? 'Mark as Ready'
                          : 'Mark Completed / Delivered'}
                      </Button>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* New Menu / Pre-Order Dialog */}
      <Dialog
        open={openNewMenu}
        onClose={() => setOpenNewMenu(false)}
        PaperProps={{ sx: { bgcolor: '#161622', color: '#fff', width: 480 } }}
      >
        <DialogTitle fontWeight="bold">Create Dish or Pre-Order Batch</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Dish Name"
            value={menuName}
            onChange={(e) => setMenuName(e.target.value)}
            margin="dense"
            sx={{ mb: 2, '& .MuiInputBase-input': { color: '#fff' } }}
          />

          <TextField
            fullWidth
            type="number"
            label="Portion Price (₹)"
            value={menuPrice}
            onChange={(e) => setMenuPrice(e.target.value)}
            margin="dense"
            sx={{ mb: 2, '& .MuiInputBase-input': { color: '#fff' } }}
          />

          <TextField
            fullWidth
            label="Category"
            select
            value={menuCat}
            onChange={(e) => setMenuCat(e.target.value)}
            margin="dense"
            sx={{ mb: 2, '& .MuiInputBase-input': { color: '#fff' } }}
          >
            {['veg', 'non-veg', 'snacks', 'desserts'].map((c) => (
              <MenuItem key={c} value={c}>
                {c.toUpperCase()}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            fullWidth
            multiline
            rows={2}
            label="Description"
            value={menuDesc}
            onChange={(e) => setMenuDesc(e.target.value)}
            margin="dense"
            sx={{ mb: 2, '& .MuiInputBase-input': { color: '#fff' } }}
          />

          <FormControlLabel
            control={
              <Switch
                checked={isPreorder}
                onChange={(e) => setIsPreorder(e.target.checked)}
                color="secondary"
              />
            }
            label="Is this a scheduled Pre-Order Batch?"
          />

          {isPreorder && (
            <Box mt={2}>
              <TextField
                fullWidth
                label="Pre-order Booking Cutoff (e.g. 11:00 AM)"
                value={cutoffTime}
                onChange={(e) => setCutoffTime(e.target.value)}
                margin="dense"
                sx={{ mb: 2, '& .MuiInputBase-input': { color: '#fff' } }}
              />

              <TextField
                fullWidth
                type="number"
                label="Max Batch Portions (0 for unlimited)"
                value={maxBatch}
                onChange={(e) => setMaxBatch(e.target.value)}
                margin="dense"
                sx={{ '& .MuiInputBase-input': { color: '#fff' } }}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenNewMenu(false)} sx={{ color: '#aaa' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={submittingMenu || !menuName.trim()}
            onClick={handleCreateMenuSubmit}
            sx={{ bgcolor: '#E05A2B', fontWeight: 'bold' }}
          >
            {submittingMenu ? <CircularProgress size={20} /> : 'Save Dish'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

SellerDashboardPage.propTypes = {
  currentUser: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    name: PropTypes.string,
    email: PropTypes.string,
    role: PropTypes.string,
  }),
};


