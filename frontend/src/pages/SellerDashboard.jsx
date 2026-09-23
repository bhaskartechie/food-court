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
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Divider,
  IconButton,
  Tooltip,
} from '@mui/material';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import DeliveryDiningIcon from '@mui/icons-material/DeliveryDining';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import CloseIcon from '@mui/icons-material/Close';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import {
  ordersAPI,
  sellersAPI,
  menusAPI,
  paymentsAPI,
  deliveryAPI,
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
  const [menuItems, setMenuItems] = useState([]);
  const [balance, setBalance] = useState({ current_balance: 0, total_earned: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  // SaaS Pass & Platform Maintenance Quota
  const [maintenanceStatus, setMaintenanceStatus] = useState(null);
  const [openTopupDialog, setOpenTopupDialog] = useState(false);
  const [topupAmount, setTopupAmount] = useState(100);
  const [topupUtr, setTopupUtr] = useState('');
  const [submittingTopup, setSubmittingTopup] = useState(false);

  // Menu Item Dialog (Create & Edit)
  const [openNewMenu, setOpenNewMenu] = useState(false);
  const [editingMenuId, setEditingMenuId] = useState(null);
  const [menuName, setMenuName] = useState('');
  const [menuPrice, setMenuPrice] = useState(120);
  const [menuCat, setMenuCat] = useState('veg');
  const [menuDesc, setMenuDesc] = useState('');
  const [menuPortions, setMenuPortions] = useState(15);
  const [menuSpiceLevel, setMenuSpiceLevel] = useState('medium');
  const [menuImageUrl, setMenuImageUrl] = useState('');
  const [selectedImageFile, setSelectedImageFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState('');
  const [isPreorder, setIsPreorder] = useState(true);
  const [cutoffTime, setCutoffTime] = useState('11:00');
  const [maxBatch, setMaxBatch] = useState(15);
  const [submittingMenu, setSubmittingMenu] = useState(false);
  const fileInputRef = React.useRef(null);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const sellerId =
        currentUser?.id ||
        (() => {
          try {
            return JSON.parse(localStorage.getItem('user') || 'null')?.id;
          } catch {
            return null;
          }
        })();
      const [profRes, ordersRes, balRes, menusRes, maintRes] = await Promise.all([
        sellersAPI.getMe().catch(() => ({ data: null })),
        ordersAPI.list(0, 50).catch(() => ({ data: { orders: [] } })),
        paymentsAPI.getBalance().catch(() => ({ data: { current_balance: 0, total_earned: 0 } })),
        sellerId
          ? menusAPI.bySeller(sellerId, null, null, false).catch(() => ({ data: [] }))
          : Promise.resolve({ data: [] }),
        paymentsAPI.getMaintenanceStatus
          ? paymentsAPI.getMaintenanceStatus().catch(() => ({ data: null }))
          : Promise.resolve({ data: null }),
      ]);

      if (profRes.data) setSellerProfile(profRes.data);
      if (maintRes.data) setMaintenanceStatus(maintRes.data);
      setOrders(ordersRes.data.orders || []);
      setBalance(balRes.data || { current_balance: 0, total_earned: 0 });
      const rawMenuData = menusRes.data;
      const fetchedItems = Array.isArray(rawMenuData)
        ? rawMenuData
        : (rawMenuData?.items || []);
      setMenuItems(fetchedItems);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load seller dashboard.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [currentUser?.id]);

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
    try {
      if (currentStatus === 'pending') {
        try {
          await paymentsAPI.confirmReceived(orderId);
          setActionSuccess(`Payment confirmed & Order #${orderId} ACCEPTED!`);
        } catch {
          await ordersAPI.updateStatus(orderId, 'accepted');
          setActionSuccess(`Order #${orderId} updated to ACCEPTED`);
        }
      } else {
        const nextMap = {
          accepted: 'ready',
          ready: 'completed',
        };
        const nextStatus = nextMap[currentStatus];
        if (!nextStatus) return;
        await ordersAPI.updateStatus(orderId, nextStatus);
        setActionSuccess(`Order #${orderId} updated to ${nextStatus.toUpperCase()}`);
      }
      fetchDashboardData();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to update order status.'));
    }
  };

  const handleTopupSubmit = async (e) => {
    e.preventDefault();
    if (!topupUtr.trim() || topupUtr.trim().length < 6) {
      setError('Please enter a valid recharge UTR reference number.');
      return;
    }
    try {
      setSubmittingTopup(true);
      setError(null);
      const res = await paymentsAPI.topupMaintenance(Number(topupAmount), topupUtr.trim());
      if (res.data) setMaintenanceStatus(res.data);
      setActionSuccess(`Successfully recharged ₹${topupAmount} platform credits!`);
      setOpenTopupDialog(false);
      setTopupUtr('');
      fetchDashboardData();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to submit maintenance recharge.'));
    } finally {
      setSubmittingTopup(false);
    }
  };

  // ── Dynamic Portions & Availability Handlers ────────────────────────────────
  const handleToggleDishAvailability = async (menuId, currentAvailable, currentQty) => {
    const targetAvailable = !currentAvailable;
    const targetQty = targetAvailable ? (currentQty > 0 ? currentQty : 10) : 0;
    try {
      await menusAPI.toggleAvailability(menuId, targetAvailable, targetQty);
      setMenuItems((prev) =>
        prev.map((item) =>
          item.id === menuId
            ? { ...item, is_available: targetAvailable, quantity: targetQty }
            : item
        )
      );
      setActionSuccess(
        `Dish marked as ${targetAvailable ? `AVAILABLE 🟢 (${targetQty} portions)` : 'SOLD OUT 🔴 (0 portions)'}`
      );
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to update dish availability.'));
    }
  };

  const handleAdjustPortions = async (menuId, currentQty, delta) => {
    const nextQty = Math.max(0, (currentQty || 0) + delta);
    const nextAvailable = nextQty > 0;
    try {
      await menusAPI.updatePortions(menuId, nextQty);
      setMenuItems((prev) =>
        prev.map((item) =>
          item.id === menuId
            ? { ...item, quantity: nextQty, is_available: nextAvailable }
            : item
        )
      );
      if (nextQty === 0) {
        setActionSuccess(`Portions reached 0 — Dish auto-marked SOLD OUT 🔴`);
      } else {
        setActionSuccess(`Updated portion count to ${nextQty} portions (🟢 In Stock)`);
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to adjust dish portions.'));
    }
  };

  const handleDeleteDish = async (menuId, dishName) => {
    if (!window.confirm(`Are you sure you want to remove '${dishName}' from your menu?`)) return;
    try {
      await menusAPI.delete(menuId);
      setMenuItems((prev) => prev.filter((item) => item.id !== menuId));
      setActionSuccess(`'${dishName}' removed from kitchen menu.`);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to delete menu item.'));
    }
  };

  const handleOpenCreateMenu = () => {
    setEditingMenuId(null);
    setMenuName('');
    setMenuPrice(120);
    setMenuCat('veg');
    setMenuDesc('');
    setMenuPortions(15);
    setMenuSpiceLevel('medium');
    setMenuImageUrl('');
    setSelectedImageFile(null);
    setImagePreviewUrl('');
    setIsPreorder(true);
    setCutoffTime('11:00');
    setMaxBatch(15);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setOpenNewMenu(true);
  };

  const handleOpenEditMenu = (dish) => {
    setEditingMenuId(dish.id);
    setMenuName(dish.name || '');
    setMenuPrice(dish.price || 0);
    setMenuCat(dish.category || 'veg');
    setMenuDesc(dish.description || '');
    setMenuPortions(dish.quantity !== undefined ? dish.quantity : 15);
    setMenuSpiceLevel(dish.spice_level || 'medium');
    setMenuImageUrl(dish.image_url || '');
    setSelectedImageFile(null);
    const resolvedUrl = dish.image_url
      ? (dish.image_url.startsWith('http')
          ? dish.image_url
          : `${process.env.REACT_APP_API_URL || 'http://localhost:8000'}${dish.image_url}`)
      : '';
    setImagePreviewUrl(resolvedUrl);
    setIsPreorder(Boolean(dish.is_preorder_only));
    setCutoffTime(dish.preorder_cutoff_time || '11:00');
    setMaxBatch(dish.max_batch_quantity || dish.quantity || 15);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setOpenNewMenu(true);
  };

  const handleDuplicateDish = (dish) => {
    setEditingMenuId(null); // Cloning creates a new dish
    setMenuName(`${dish.name} (Copy)`);
    setMenuPrice(dish.price || 0);
    setMenuCat(dish.category || 'veg');
    setMenuDesc(dish.description || '');
    setMenuPortions(dish.quantity !== undefined ? dish.quantity : 15);
    setMenuSpiceLevel(dish.spice_level || 'medium');
    setMenuImageUrl(dish.image_url || '');
    setSelectedImageFile(null);
    const resolvedUrl = dish.image_url
      ? (dish.image_url.startsWith('http')
          ? dish.image_url
          : `${process.env.REACT_APP_API_URL || 'http://localhost:8000'}${dish.image_url}`)
      : '';
    setImagePreviewUrl(resolvedUrl);
    setIsPreorder(Boolean(dish.is_preorder_only));
    setCutoffTime(dish.preorder_cutoff_time || '11:00');
    setMaxBatch(dish.max_batch_quantity || dish.quantity || 15);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setOpenNewMenu(true);
    setActionSuccess(`Cloned '${dish.name}' as a draft. Adjust details and click Save!`);
  };

  const handleSaveMenuSubmit = async () => {
    if (!menuName.trim()) return;
    try {
      setSubmittingMenu(true);
      setError(null);
      const portionsVal = parseInt(menuPortions, 10) || 0;
      const menuPayload = {
        name: menuName.trim(),
        price: parseFloat(menuPrice),
        category: menuCat,
        description: menuDesc ? menuDesc.trim() : undefined,
        quantity: portionsVal,
        is_available: portionsVal > 0,
        spice_level: menuSpiceLevel || 'medium',
        image_url: menuImageUrl ? menuImageUrl.trim() : undefined,
        is_preorder_only: isPreorder,
        preorder_cutoff_time: isPreorder ? cutoffTime : undefined,
        available_slots: isPreorder ? ['lunch_today', 'dinner_today'] : undefined,
        max_batch_quantity: isPreorder ? (parseInt(maxBatch, 10) || portionsVal) : portionsVal,
      };

      let targetMenuId = editingMenuId;

      if (editingMenuId) {
        await menusAPI.update(editingMenuId, menuPayload);
        setActionSuccess(`Dish '${menuName}' updated successfully!`);
      } else {
        const createRes = await menusAPI.create(menuPayload);
        targetMenuId = createRes?.data?.id;
        setActionSuccess('Menu item / Pre-order batch created successfully!');
      }

      // If user selected a local file from disk, upload it to the menu item endpoint
      if (selectedImageFile && targetMenuId) {
        try {
          await menusAPI.uploadImage(targetMenuId, selectedImageFile);
          setActionSuccess(`Dish '${menuName}' saved & photo uploaded!`);
        } catch (uploadErr) {
          setError(getErrorMessage(uploadErr, 'Dish saved, but failed to upload photo.'));
        }
      }

      setOpenNewMenu(false);
      setEditingMenuId(null);
      setSelectedImageFile(null);
      setImagePreviewUrl('');
      fetchDashboardData();
    } catch (err) {
      setError(getErrorMessage(err, editingMenuId ? 'Failed to update menu item.' : 'Failed to create menu item.'));
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
          <Box display="flex" flexWrap="wrap" gap={1} mt={1.5}>
            <Chip
              label={`⚡ ${sellerProfile?.on_time_delivery_rate ?? 98.5}% on-time`}
              size="small"
              sx={{ bgcolor: 'rgba(46, 196, 182, 0.15)', color: '#2EC4B6', fontWeight: 'bold' }}
            />
            <Chip
              label={`⏱️ ~${sellerProfile?.avg_delivery_minutes ?? 22}m avg prep`}
              size="small"
              sx={{ bgcolor: 'rgba(246, 189, 96, 0.15)', color: '#F6BD60', fontWeight: 'bold' }}
            />
            <Chip
              label={`⭐ ${sellerProfile?.punctuality_rating?.toFixed(1) ?? '4.9'} ★`}
              size="small"
              sx={{ bgcolor: 'rgba(255, 107, 53, 0.15)', color: '#FF6B35', fontWeight: 'bold' }}
            />
          </Box>
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

        {/* SaaS Pass & Direct UPI Quota Card */}
        <Grid item xs={12} md={5}>
          <Card sx={{ bgcolor: '#191928', borderRadius: 3, border: '1px solid rgba(255,255,255,0.08)' }}>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5}>
                <Box display="flex" alignItems="center" gap={1}>
                  <AccountBalanceWalletIcon sx={{ color: '#4caf50' }} />
                  <Typography variant="h6" fontWeight="bold">
                    SaaS Pass & Quota
                  </Typography>
                </Box>
                <Chip
                  size="small"
                  label={sellerProfile?.upi_id ? '🟢 Direct UPI' : '⚠️ Missing UPI'}
                  sx={{
                    bgcolor: sellerProfile?.upi_id ? 'rgba(76, 175, 80, 0.15)' : 'rgba(255, 152, 0, 0.15)',
                    color: sellerProfile?.upi_id ? '#4caf50' : '#ff9800',
                    fontWeight: 'bold',
                  }}
                />
              </Box>

              <Box display="flex" justifyContent="space-between" mb={2}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Free Orders Remaining
                  </Typography>
                  <Typography variant="h4" fontWeight="bold" color="#4caf50">
                    {maintenanceStatus?.free_orders_remaining ?? sellerProfile?.free_orders_remaining ?? 50}{' '}
                    <span style={{ fontSize: '1rem', color: '#aaa' }}>/ 50</span>
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    100% Free Quota
                  </Typography>
                </Box>
                <Box textAlign="right">
                  <Typography variant="caption" color="text.secondary">
                    Platform Balance
                  </Typography>
                  <Typography variant="h5" fontWeight="bold" color="#E05A2B">
                    ₹{Number(maintenanceStatus?.maintenance_balance ?? sellerProfile?.maintenance_balance ?? 0).toFixed(2)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    ₹5.00/order after free quota
                  </Typography>
                </Box>
              </Box>

              <Button
                fullWidth
                variant="outlined"
                onClick={() => setOpenTopupDialog(true)}
                sx={{
                  color: '#4caf50',
                  borderColor: '#4caf50',
                  fontWeight: 'bold',
                  textTransform: 'none',
                  borderRadius: 2,
                  '&:hover': { borderColor: '#81c784', bgcolor: 'rgba(76, 175, 80, 0.08)' },
                }}
              >
                + Recharge Platform Credits
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Live Kitchen Menu & Dishes Management Section */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} mt={5}>
        <Box display="flex" alignItems="center" gap={1}>
          <RestaurantIcon sx={{ color: '#E05A2B' }} />
          <Typography variant="h5" fontWeight="bold">
            Kitchen Menu & Active Dishes ({menuItems.length})
          </Typography>
        </Box>
        <Button
          variant="contained"
          size="small"
          startIcon={<AddCircleOutlineIcon />}
          onClick={handleOpenCreateMenu}
          sx={{
            bgcolor: '#E05A2B',
            fontWeight: 'bold',
            borderRadius: 2,
            textTransform: 'none',
            '&:hover': { bgcolor: '#c9481c' },
          }}
        >
          + Add New Dish
        </Button>
      </Box>

      {menuItems.length === 0 ? (
        <Box textAlign="center" py={5} mb={4} color="text.secondary" bgcolor="#191928" borderRadius={3} border="1px dashed rgba(255,255,255,0.12)">
          <Typography variant="body1" mb={1}>No dishes published from your kitchen yet.</Typography>
          <Typography variant="caption" color="text.secondary" display="block" mb={2}>
            Add today's home-cooked specials or scheduled pre-order batches for society neighbors.
          </Typography>
          <Button
            variant="outlined"
            size="small"
            startIcon={<AddCircleOutlineIcon />}
            onClick={handleOpenCreateMenu}
            sx={{ color: '#E05A2B', borderColor: '#E05A2B', textTransform: 'none' }}
          >
            Create Your First Dish
          </Button>
        </Box>
      ) : (
        <Grid container spacing={2.5} mb={5}>
          {menuItems.map((dish) => {
            const isSoldOut = !dish.is_available || (dish.quantity !== undefined && dish.quantity <= 0);
            const catColors = {
              veg: '#2EC4B6',
              'non-veg': '#E05A2B',
              snacks: '#F6BD60',
              desserts: '#FF6B6B',
              beverages: '#4D96FF',
            };
            const catColor = catColors[dish.category] || '#E05A2B';

            return (
              <Grid item xs={12} sm={6} md={4} key={dish.id}>
                <Card
                  sx={{
                    bgcolor: '#191928',
                    borderRadius: 3,
                    border: '1px solid',
                    borderColor: isSoldOut ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.12)',
                    opacity: isSoldOut ? 0.8 : 1,
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%',
                  }}
                >
                  <CardContent sx={{ flexGrow: 1, p: 2.5 }}>
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1.5} gap={1}>
                      <Box display="flex" alignItems="center" gap={0.8} flexWrap="wrap">
                        <Chip
                          label={dish.category?.toUpperCase() || 'DISH'}
                          size="small"
                          sx={{
                            bgcolor: `${catColor}22`,
                            color: catColor,
                            fontWeight: 'bold',
                            fontSize: '0.7rem',
                            height: 22,
                          }}
                        />
                        {/* Option B: Spice Level Indicator */}
                        {dish.spice_level && (
                          <Chip
                            label={
                              dish.spice_level === 'hot'
                                ? '🌶️🌶️🌶️ Hot'
                                : dish.spice_level === 'mild'
                                ? '🌶️ Mild'
                                : '🌶️🌶️ Medium'
                            }
                            size="small"
                            sx={{
                              bgcolor: 'rgba(255,255,255,0.06)',
                              color: dish.spice_level === 'hot' ? '#ff5252' : '#F6BD60',
                              fontSize: '0.7rem',
                              fontWeight: 'bold',
                              height: 22,
                            }}
                          />
                        )}
                        {/* Option C: Low Stock Warning Badge */}
                        {dish.is_available && dish.quantity !== undefined && dish.quantity >= 1 && dish.quantity <= 3 && (
                          <Chip
                            label={`⚠️ Only ${dish.quantity} left`}
                            size="small"
                            sx={{
                              bgcolor: 'rgba(255, 152, 0, 0.15)',
                              color: '#ff9800',
                              fontWeight: 'bold',
                              fontSize: '0.7rem',
                              height: 22,
                              border: '1px solid rgba(255, 152, 0, 0.3)',
                            }}
                          />
                        )}
                      </Box>

                      <Box display="flex" alignItems="center" gap={0.5}>
                        <Typography variant="h6" fontWeight="bold" color="#E05A2B" sx={{ mr: 0.5 }}>
                          ₹{dish.price}
                        </Typography>
                        <Tooltip title="Edit dish details & spice">
                          <IconButton
                            size="small"
                            onClick={() => handleOpenEditMenu(dish)}
                            sx={{ color: '#aaa', '&:hover': { color: '#2EC4B6' } }}
                            aria-label={`Edit ${dish.name}`}
                          >
                            <EditOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Duplicate / clone this dish">
                          <IconButton
                            size="small"
                            onClick={() => handleDuplicateDish(dish)}
                            sx={{ color: '#aaa', '&:hover': { color: '#F6BD60' } }}
                            aria-label={`Duplicate ${dish.name}`}
                          >
                            <ContentCopyIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete dish from kitchen menu">
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteDish(dish.id, dish.name)}
                            sx={{ color: '#aaa', '&:hover': { color: '#ff5252' } }}
                            aria-label={`Delete ${dish.name}`}
                          >
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>

                    {dish.image_url && (
                      <Box
                        component="img"
                        src={dish.image_url.startsWith('http') ? dish.image_url : `${process.env.REACT_APP_API_URL || 'http://localhost:8000'}${dish.image_url}`}
                        alt={dish.name}
                        onError={(e) => { e.target.style.display = 'none'; }}
                        sx={{
                          width: '100%',
                          height: 120,
                          objectFit: 'cover',
                          borderRadius: 2,
                          mb: 1.5,
                        }}
                      />
                    )}

                    <Typography variant="subtitle1" fontWeight="bold" color="#fff" mb={0.5}>
                      {dish.name}
                    </Typography>

                    {dish.description && (
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          mb: 1.5,
                          fontSize: '0.82rem',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {dish.description}
                      </Typography>
                    )}

                    {dish.is_preorder_only && (
                      <Box display="flex" alignItems="center" gap={0.8} mb={1.5}>
                        <AccessTimeIcon sx={{ color: '#F6BD60', fontSize: 16 }} />
                        <Typography variant="caption" color="#F6BD60">
                          Pre-Order Cutoff: {dish.preorder_cutoff_time || '11:00 AM'}
                        </Typography>
                      </Box>
                    )}

                    <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', my: 1.5 }} />

                    {/* Dynamic Portion Availability & Stepper Controls */}
                    <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
                      <Box>
                        <Typography variant="caption" color="text.secondary" display="block">
                          Portions Available:
                        </Typography>
                        <Box display="flex" alignItems="center" gap={0.8} mt={0.5}>
                          <IconButton
                            size="small"
                            disabled={!dish.quantity || dish.quantity <= 0}
                            onClick={() => handleAdjustPortions(dish.id, dish.quantity, -1)}
                            sx={{
                              bgcolor: 'rgba(255,255,255,0.08)',
                              color: '#fff',
                              p: 0.5,
                              '&:hover': { bgcolor: 'rgba(255,255,255,0.15)' },
                            }}
                          >
                            <RemoveIcon fontSize="small" />
                          </IconButton>

                          <Typography variant="body2" fontWeight="bold" color={isSoldOut ? '#ff5252' : '#2EC4B6'} sx={{ minWidth: 24, textAlign: 'center' }}>
                            {dish.quantity ?? 0}
                          </Typography>

                          <IconButton
                            size="small"
                            onClick={() => handleAdjustPortions(dish.id, dish.quantity, 1)}
                            sx={{
                              bgcolor: 'rgba(255,255,255,0.08)',
                              color: '#fff',
                              p: 0.5,
                              '&:hover': { bgcolor: 'rgba(255,255,255,0.15)' },
                            }}
                          >
                            <AddIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      </Box>

                      {/* Real-Time Availability Switch */}
                      <Box textAlign="right">
                        <FormControlLabel
                          control={
                            <Switch
                              size="small"
                              checked={Boolean(dish.is_available && (dish.quantity === undefined || dish.quantity > 0))}
                              onChange={() => handleToggleDishAvailability(dish.id, dish.is_available, dish.quantity)}
                              color="success"
                            />
                          }
                          label={
                            <Typography variant="caption" fontWeight="bold" color={!isSoldOut ? '#2EC4B6' : '#ff5252'}>
                              {!isSoldOut ? 'IN STOCK 🟢' : 'SOLD OUT 🔴'}
                            </Typography>
                          }
                        />
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

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

      {/* New Menu / Edit Menu Dialog */}
      <Dialog
        open={openNewMenu}
        onClose={() => setOpenNewMenu(false)}
        PaperProps={{ sx: { bgcolor: '#161622', color: '#fff', width: 480 } }}
      >
        <DialogTitle fontWeight="bold">
          {editingMenuId ? '✏️ Edit Menu Item' : '✨ Create Dish or Pre-Order Batch'}
        </DialogTitle>
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
            type="number"
            label="Available Portions / Portions in Batch"
            value={menuPortions}
            onChange={(e) => setMenuPortions(e.target.value)}
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
            {['veg', 'non-veg', 'snacks', 'desserts', 'beverages'].map((c) => (
              <MenuItem key={c} value={c}>
                {c.toUpperCase()}
              </MenuItem>
            ))}
          </TextField>

          {/* Option B: Spice Level Selector */}
          <TextField
            select
            fullWidth
            label="Spice Level"
            value={menuSpiceLevel}
            onChange={(e) => setMenuSpiceLevel(e.target.value)}
            margin="dense"
            sx={{ mb: 2, '& .MuiInputBase-input': { color: '#fff' } }}
          >
            <MenuItem value="mild">🌶️ Mild (Kid-friendly / Gentle)</MenuItem>
            <MenuItem value="medium">🌶️🌶️ Medium (Balanced spice)</MenuItem>
            <MenuItem value="hot">🌶️🌶️🌶️ Hot (Authentic spicy)</MenuItem>
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

          {/* Local Photo Upload & Live Thumbnail Preview */}
          <Box
            sx={{
              mb: 2,
              p: 2,
              border: '1px dashed rgba(255,255,255,0.2)',
              borderRadius: 2,
              bgcolor: 'rgba(255,255,255,0.02)',
            }}
          >
            <Typography variant="caption" sx={{ color: '#aaa', display: 'block', mb: 1 }}>
              Dish Photo (Upload from device or enter web URL):
            </Typography>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/png,image/jpeg,image/webp,image/jpg"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  if (file.size > 5 * 1024 * 1024) {
                    setError('Image size exceeds 5MB limit. Please choose a smaller photo.');
                    return;
                  }
                  setSelectedImageFile(file);
                  setImagePreviewUrl(URL.createObjectURL(file));
                }
              }}
            />
            <Box display="flex" alignItems="center" gap={1.5} flexWrap="wrap">
              <Button
                variant="outlined"
                size="small"
                startIcon={<PhotoCameraIcon />}
                onClick={() => fileInputRef.current?.click()}
                sx={{
                  color: '#E05A2B',
                  borderColor: '#E05A2B',
                  textTransform: 'none',
                  '&:hover': { borderColor: '#c9481c', bgcolor: 'rgba(224,90,43,0.08)' },
                }}
              >
                {selectedImageFile ? 'Change Photo' : 'Browse Local Photo...'}
              </Button>
              {selectedImageFile && (
                <Typography variant="caption" sx={{ color: '#2EC4B6' }}>
                  {selectedImageFile.name} ({(selectedImageFile.size / 1024).toFixed(0)} KB)
                </Typography>
              )}
              {imagePreviewUrl && (
                <Button
                  size="small"
                  onClick={() => {
                    setSelectedImageFile(null);
                    setImagePreviewUrl('');
                    setMenuImageUrl('');
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  sx={{ color: '#aaa', textTransform: 'none', ml: 'auto' }}
                >
                  Remove Photo
                </Button>
              )}
            </Box>
            {imagePreviewUrl && (
              <Box
                component="img"
                src={imagePreviewUrl}
                alt="Dish preview"
                sx={{
                  width: '100%',
                  maxHeight: 140,
                  objectFit: 'cover',
                  borderRadius: 2,
                  mt: 1.5,
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              />
            )}
          </Box>

          <TextField
            fullWidth
            label="Or Image URL (Optional)"
            placeholder="https://images.unsplash.com/..."
            value={menuImageUrl}
            onChange={(e) => {
              setMenuImageUrl(e.target.value);
              if (!selectedImageFile) {
                setImagePreviewUrl(e.target.value);
              }
            }}
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
            onClick={handleSaveMenuSubmit}
            sx={{ bgcolor: '#E05A2B', fontWeight: 'bold' }}
          >
            {submittingMenu ? (
              <CircularProgress size={20} />
            ) : editingMenuId ? (
              'Update Dish'
            ) : (
              'Save Dish'
            )}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Recharge Platform Credits Dialog */}
      <Dialog
        open={openTopupDialog}
        onClose={() => setOpenTopupDialog(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: { bgcolor: '#161622', color: '#fff', borderRadius: 3, border: '1px solid #28283c' },
        }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h6" fontWeight="bold">
              Recharge Platform Credits
            </Typography>
            <Typography variant="caption" sx={{ color: '#4caf50' }}>
              Flat ₹5.00/order • Instant Top-up
            </Typography>
          </Box>
          <IconButton onClick={() => setOpenTopupDialog(false)} sx={{ color: '#aaa' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers sx={{ borderColor: '#232336' }}>
          <Typography variant="caption" sx={{ color: '#aaa', display: 'block', mb: 2 }}>
            Choose a maintenance credit pack to keep your kitchen open and active:
          </Typography>

          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.5, mb: 2.5 }}>
            {[
              { amt: 50, orders: '10 Orders' },
              { amt: 100, orders: '20 Orders' },
              { amt: 250, orders: '50 Orders' },
            ].map((pack) => (
              <Button
                key={pack.amt}
                variant={topupAmount === pack.amt ? 'contained' : 'outlined'}
                onClick={() => setTopupAmount(pack.amt)}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  py: 1,
                  bgcolor: topupAmount === pack.amt ? '#4caf50' : 'transparent',
                  color: topupAmount === pack.amt ? '#fff' : '#4caf50',
                  borderColor: '#4caf50',
                  '&:hover': {
                    bgcolor: topupAmount === pack.amt ? '#388e3c' : 'rgba(76, 175, 80, 0.1)',
                  },
                }}
              >
                <Typography variant="subtitle2" fontWeight="bold">
                  ₹{pack.amt}
                </Typography>
                <Typography variant="caption" sx={{ fontSize: '0.65rem' }}>
                  {pack.orders}
                </Typography>
              </Button>
            ))}
          </Box>

          {/* Platform QR */}
          <Box sx={{ textAlign: 'center', mb: 2 }}>
            <Box
              component="img"
              src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                `upi://pay?pa=${maintenanceStatus?.platform_upi_vpa || 'societyfood@upi'}&pn=SocietyFood&am=${topupAmount}&cu=INR`
              )}`}
              alt="Platform Topup QR"
              sx={{ width: 150, height: 150, bgcolor: '#fff', p: 1, borderRadius: 2, mb: 1 }}
            />
            <Typography variant="caption" sx={{ color: '#aaa', display: 'block' }}>
              Scan to pay ₹{topupAmount} to{' '}
              <strong style={{ color: '#fff' }}>{maintenanceStatus?.platform_upi_vpa || 'societyfood@upi'}</strong>
            </Typography>
          </Box>

          <Box component="form" onSubmit={handleTopupSubmit}>
            <TextField
              fullWidth
              size="small"
              label="12-Digit Recharge UTR / Transaction ID"
              placeholder="e.g. 412345678901"
              value={topupUtr}
              onChange={(e) => setTopupUtr(e.target.value)}
              required
              sx={{ mb: 2, '& .MuiInputBase-input': { color: '#fff' } }}
              InputLabelProps={{ sx: { color: '#bbb' } }}
            />

            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={submittingTopup || topupUtr.trim().length < 6}
              sx={{
                bgcolor: '#4caf50',
                '&:hover': { bgcolor: '#388e3c' },
                fontWeight: 'bold',
                py: 1,
              }}
            >
              {submittingTopup ? 'Verifying...' : `Confirm ₹${topupAmount} Recharge`}
            </Button>
          </Box>
        </DialogContent>
      </Dialog>
    </Container>
  );
}

SellerDashboardPage.propTypes = {
  currentUser: PropTypes.shape({
    id: PropTypes.number,
    name: PropTypes.string,
    email: PropTypes.string,
    role: PropTypes.string,
  }),
};


