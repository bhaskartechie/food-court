import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import {
  Container,
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  Tooltip,
  Paper,
  Divider,
  FormControl,
  InputLabel,
  Select,
} from '@mui/material';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import FavoriteIcon from '@mui/icons-material/Favorite';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import RestaurantMenuIcon from '@mui/icons-material/RestaurantMenu';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import StarsIcon from '@mui/icons-material/Stars';
import ShoppingBagOutlinedIcon from '@mui/icons-material/ShoppingBagOutlined';
import StorefrontIcon from '@mui/icons-material/Storefront';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import { suggestionsAPI, menusAPI, getErrorMessage } from '../services/api';

const CATEGORIES = ['all', 'veg', 'non-veg', 'snacks', 'desserts'];

const DELIVERY_SLOTS = [
  { id: 'lunch_today', label: '☀️ Lunch Today' },
  { id: 'dinner_today', label: '🌙 Dinner Today' },
  { id: 'lunch_tomorrow', label: '☀️ Lunch Tomorrow' },
  { id: 'dinner_tomorrow', label: '🌙 Dinner Tomorrow' },
  { id: 'weekend_special', label: '🎉 Weekend Special' },
];

export default function SuggestionsBoard({ currentUser }) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [error, setError] = useState(null);

  // Seller specific tab: 'matched' | 'high_demand' | 'all' | 'my_accepted'
  const isSeller = currentUser?.role === 'seller' || currentUser?.role === 'admin';
  const [sellerTab, setSellerTab] = useState(isSeller ? 'matched' : 'all');

  // Propose Dish Modal
  const [openPropose, setOpenPropose] = useState(false);
  const [proposeTitle, setProposeTitle] = useState('');
  const [proposeDesc, setProposeDesc] = useState('');
  const [proposeCat, setProposeCat] = useState('veg');
  const [proposeDate, setProposeDate] = useState('');
  const [submittingPropose, setSubmittingPropose] = useState(false);

  // Chef Acceptance Modal
  const [selectedSuggestion, setSelectedSuggestion] = useState(null);
  const [claimTab, setClaimTab] = useState(0); // 0: New Batch, 1: Link Existing
  const [claimPrice, setClaimPrice] = useState(150);
  const [claimBatch, setClaimBatch] = useState(15);
  const [claimCutoff, setClaimCutoff] = useState('11:00');
  const [selectedSlots, setSelectedSlots] = useState(['lunch_today', 'dinner_today']);
  const [selectedExistingMenuId, setSelectedExistingMenuId] = useState('');
  const [chefMenuItems, setChefMenuItems] = useState([]);
  const [submittingClaim, setSubmittingClaim] = useState(false);
  const [claimSuccessMsg, setClaimSuccessMsg] = useState(null);

  // Fetch Chef's existing dishes for linking
  useEffect(() => {
    if (isSeller && currentUser?.id) {
      menusAPI
        .bySeller(currentUser.id)
        .then((res) => {
          setChefMenuItems(res.data?.items || []);
        })
        .catch(() => {
          setChefMenuItems([]);
        });
    }
  }, [isSeller, currentUser]);

  // Fetch Cravings
  const fetchSuggestions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (isSeller && sellerTab === 'matched') {
        const res = await suggestionsAPI.listMatched(30);
        setSuggestions(res.data.suggestions || []);
      } else {
        const cat = categoryFilter === 'all' ? null : categoryFilter;
        const res = await suggestionsAPI.list(null, cat);
        let items = res.data.suggestions || [];

        if (isSeller && sellerTab === 'high_demand') {
          items = [...items].sort((a, b) => b.upvotes_count - a.upvotes_count);
        } else if (isSeller && sellerTab === 'my_accepted') {
          items = items.filter((s) => s.accepted_by_seller_id === currentUser?.id);
        }

        setSuggestions(items);
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load community cravings.'));
    } finally {
      setLoading(false);
    }
  }, [isSeller, sellerTab, categoryFilter, currentUser]);

  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  // Toggle upvote
  const handleUpvote = async (id) => {
    try {
      const res = await suggestionsAPI.upvote(id);
      setSuggestions((prev) =>
        prev.map((s) =>
          s.id === id
            ? {
                ...s,
                upvotes_count: res.data.upvotes_count,
                has_upvoted: res.data.has_upvoted,
              }
            : s
        )
      );
    } catch (err) {
      setError(getErrorMessage(err, 'Please login to upvote.'));
    }
  };

  // Submit proposed dish
  const handleProposeSubmit = async () => {
    if (!proposeTitle.trim()) return;
    try {
      setSubmittingPropose(true);
      await suggestionsAPI.create({
        title: proposeTitle,
        description: proposeDesc || undefined,
        category: proposeCat,
        target_date: proposeDate || undefined,
      });
      setOpenPropose(false);
      setProposeTitle('');
      setProposeDesc('');
      fetchSuggestions();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to post dish craving.'));
    } finally {
      setSubmittingPropose(false);
    }
  };

  // Open Acceptance Modal
  const handleOpenClaimModal = (item) => {
    setSelectedSuggestion(item);
    setClaimTab(0);
    // Pre-fill default price or find existing matching dish
    if (item.matching_menu_items && item.matching_menu_items.length > 0) {
      setSelectedExistingMenuId(item.matching_menu_items[0].id);
      setClaimPrice(item.matching_menu_items[0].price);
    } else {
      setSelectedExistingMenuId('');
      setClaimPrice(item.category === 'non-veg' ? 220 : 150);
    }
  };

  // Submit Chef Acceptance
  const handleClaimSubmit = async () => {
    if (!selectedSuggestion) return;
    try {
      setSubmittingClaim(true);

      let payload;
      if (claimTab === 1) {
        // Link existing menu item
        if (!selectedExistingMenuId) {
          setError('Please choose an existing dish from your kitchen.');
          setSubmittingClaim(false);
          return;
        }
        payload = { existing_menu_id: parseInt(selectedExistingMenuId, 10) };
      } else {
        // Launch new pre-order batch
        payload = {
          price: parseFloat(claimPrice),
          max_batch_quantity: parseInt(claimBatch, 10),
          preorder_cutoff_time: claimCutoff,
          available_slots: selectedSlots,
        };
      }

      const res = await suggestionsAPI.claim(selectedSuggestion.id, payload);
      setClaimSuccessMsg(res.data.message || `Pre-order batch launched for "${selectedSuggestion.title}"!`);
      setSelectedSuggestion(null);
      fetchSuggestions();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to accept dish craving.'));
    } finally {
      setSubmittingClaim(false);
    }
  };

  // Compute Chef Stats for Demand Radar
  const matchedCount = suggestions.filter((s) => (s.match_score || 0) >= 40).length;
  const highDemandCount = suggestions.filter((s) => s.upvotes_count >= 2).length;
  const myAcceptedCount = suggestions.filter((s) => s.accepted_by_seller_id === currentUser?.id).length;

  return (
    <Container maxWidth="lg" sx={{ py: 4, color: '#fff' }}>
      {/* ── Header Banner: Buyer vs Chef Demand Radar ── */}
      {isSeller ? (
        <Box
          sx={{
            background: 'linear-gradient(135deg, #241D3B 0%, #161622 100%)',
            p: { xs: 3, md: 4 },
            borderRadius: 3,
            mb: 4,
            border: '1px solid rgba(224, 90, 43, 0.25)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          }}
        >
          <Box display="flex" flexDirection={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} gap={2} mb={3}>
            <Box>
              <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                <StarsIcon sx={{ color: '#F6BD60', fontSize: 32 }} />
                <Typography variant="h4" fontWeight="bold">
                  Chef Demand Radar 🎯
                </Typography>
              </Box>
              <Typography variant="body1" color="text.secondary">
                Match community cravings with your kitchen! Launch pre-order batches or fulfill requests with dishes already on your menu.
              </Typography>
            </Box>

            <Button
              variant="contained"
              startIcon={<AddCircleOutlineIcon />}
              onClick={() => setOpenPropose(true)}
              sx={{
                bgcolor: '#E05A2B',
                fontWeight: 'bold',
                px: 3,
                py: 1.2,
                borderRadius: 2,
                textTransform: 'none',
                '&:hover': { bgcolor: '#c9481c' },
              }}
            >
              Request a Dish
            </Button>
          </Box>

          {/* Quick Metrics Bar */}
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <Paper sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.04)', borderRadius: 2, border: '1px solid rgba(46, 196, 182, 0.2)' }}>
                <Typography variant="caption" color="#2EC4B6" fontWeight="bold" textTransform="uppercase">
                  🎯 Matched for Your Kitchen
                </Typography>
                <Typography variant="h5" fontWeight="bold" mt={0.5}>
                  {matchedCount} Dishes
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Paper sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.04)', borderRadius: 2, border: '1px solid rgba(246, 189, 96, 0.2)' }}>
                <Typography variant="caption" color="#F6BD60" fontWeight="bold" textTransform="uppercase">
                  🔥 High Demand in Society
                </Typography>
                <Typography variant="h5" fontWeight="bold" mt={0.5}>
                  {highDemandCount} Dishes
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Paper sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.04)', borderRadius: 2, border: '1px solid rgba(224, 90, 43, 0.2)' }}>
                <Typography variant="caption" color="#E05A2B" fontWeight="bold" textTransform="uppercase">
                  🍳 Batches You're Cooking
                </Typography>
                <Typography variant="h5" fontWeight="bold" mt={0.5}>
                  {myAcceptedCount} Batches
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        </Box>
      ) : (
        <Box
          sx={{
            background: 'linear-gradient(135deg, #1F1F35 0%, #161622 100%)',
            p: { xs: 3, md: 4 },
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
            <Box display="flex" alignItems="center" gap={1} mb={0.5}>
              <LocalFireDepartmentIcon sx={{ color: '#E05A2B', fontSize: 32 }} />
              <Typography variant="h4" fontWeight="bold">
                Community Cravings & Wishlist
              </Typography>
            </Box>
            <Typography variant="body1" color="text.secondary">
              Request homemade dishes you crave! Upvote neighbor favorites or discover when chefs accept requests.
            </Typography>
          </Box>

          <Button
            variant="contained"
            startIcon={<AddCircleOutlineIcon />}
            onClick={() => setOpenPropose(true)}
            sx={{
              bgcolor: '#E05A2B',
              fontWeight: 'bold',
              px: 3,
              py: 1.2,
              borderRadius: 2,
              textTransform: 'none',
              '&:hover': { bgcolor: '#c9481c' },
            }}
          >
            Request a Dish
          </Button>
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {claimSuccessMsg && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setClaimSuccessMsg(null)}>
          {claimSuccessMsg}
        </Alert>
      )}

      {/* ── Filters: Seller Navigation vs Buyer Categories ── */}
      {isSeller ? (
        <Box sx={{ mb: 3 }}>
          <Tabs
            value={sellerTab}
            onChange={(e, val) => setSellerTab(val)}
            textColor="inherit"
            indicatorColor="primary"
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              borderBottom: 1,
              borderColor: 'rgba(255,255,255,0.1)',
              '& .MuiTab-root': { fontWeight: 'bold', textTransform: 'none', fontSize: '1rem' },
            }}
          >
            <Tab value="matched" label="🎯 Matched for You" />
            <Tab value="high_demand" label="🔥 High Demand" />
            <Tab value="all" label="🍽️ All Cravings" />
            <Tab value="my_accepted" label="🍳 My Accepted Batches" />
          </Tabs>

          {sellerTab === 'all' && (
            <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
              {CATEGORIES.map((cat) => (
                <Chip
                  key={cat}
                  label={cat.toUpperCase()}
                  onClick={() => setCategoryFilter(cat)}
                  color={categoryFilter === cat ? 'primary' : 'default'}
                  variant={categoryFilter === cat ? 'filled' : 'outlined'}
                  sx={{ fontWeight: 'bold', cursor: 'pointer' }}
                />
              ))}
            </Box>
          )}
        </Box>
      ) : (
        <Box sx={{ borderBottom: 1, borderColor: 'rgba(255,255,255,0.1)', mb: 3 }}>
          <Tabs
            value={categoryFilter}
            onChange={(e, val) => setCategoryFilter(val)}
            textColor="inherit"
            indicatorColor="secondary"
            variant="scrollable"
            scrollButtons="auto"
          >
            {CATEGORIES.map((cat) => (
              <Tab
                key={cat}
                value={cat}
                label={cat.toUpperCase()}
                sx={{ fontWeight: '600', textTransform: 'capitalize' }}
              />
            ))}
          </Tabs>
        </Box>
      )}

      {/* ── Cards Grid ── */}
      {loading ? (
        <Box display="flex" justifyContent="center" py={8}>
          <CircularProgress sx={{ color: '#E05A2B' }} />
        </Box>
      ) : suggestions.length === 0 ? (
        <Box textAlign="center" py={8} color="text.secondary" bgcolor="#191928" borderRadius={3}>
          <RestaurantMenuIcon sx={{ fontSize: 60, mb: 1, opacity: 0.5 }} />
          <Typography variant="h6">
            {sellerTab === 'matched'
              ? 'No matching cravings found for your kitchen right now.'
              : sellerTab === 'my_accepted'
              ? 'You have not accepted any community cravings yet.'
              : 'No dish cravings yet in this category.'}
          </Typography>
          <Typography variant="body2" mt={0.5}>
            {sellerTab === 'matched'
              ? 'Check "All Cravings" or expand your kitchen categories!'
              : 'Be the first resident to request a meal!'}
          </Typography>
        </Box>
      ) : (
        <Grid container spacing={3}>
          {suggestions.map((item) => {
            const hasMatch = isSeller && item.match_score && item.match_score > 0;
            const isClaimed = item.status === 'claimed_by_chef';
            const isClaimedByMe = isClaimed && item.accepted_by_seller_id === currentUser?.id;

            return (
              <Grid item xs={12} sm={6} md={4} key={item.id}>
                <Card
                  sx={{
                    bgcolor: '#191928',
                    borderRadius: 3,
                    border: '1px solid',
                    borderColor:
                      isClaimedByMe
                        ? '#2EC4B6'
                        : hasMatch && item.match_score >= 70
                        ? 'rgba(246, 189, 96, 0.6)'
                        : 'rgba(255,255,255,0.08)',
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                    },
                  }}
                >
                  <CardContent sx={{ flexGrow: 1 }}>
                    {/* Category & Status & Match Badges */}
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5} flexWrap="wrap" gap={0.5}>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Chip
                          size="small"
                          label={item.category.toUpperCase()}
                          sx={{
                            bgcolor:
                              item.category === 'veg'
                                ? 'rgba(46, 196, 182, 0.2)'
                                : 'rgba(224, 90, 43, 0.2)',
                            color: item.category === 'veg' ? '#2EC4B6' : '#E05A2B',
                            fontWeight: 'bold',
                          }}
                        />

                        {/* Chef Match Score Badge */}
                        {hasMatch && !isClaimed && (
                          <Tooltip
                            title={
                              item.match_reasons && item.match_reasons.length > 0
                                ? item.match_reasons.join(' • ')
                                : 'Matches your kitchen specialties!'
                            }
                            arrow
                          >
                            <Chip
                              size="small"
                              label={`🎯 ${item.match_score}% Match`}
                              sx={{
                                bgcolor:
                                  item.match_score >= 75
                                    ? 'rgba(46, 196, 182, 0.25)'
                                    : 'rgba(246, 189, 96, 0.25)',
                                color: item.match_score >= 75 ? '#2EC4B6' : '#F6BD60',
                                fontWeight: 'bold',
                                border: '1px solid',
                                borderColor: item.match_score >= 75 ? '#2EC4B6' : '#F6BD60',
                              }}
                            />
                          </Tooltip>
                        )}
                      </Box>

                      {/* Status Tag */}
                      {isClaimed ? (
                        <Chip
                          size="small"
                          icon={<CheckCircleIcon sx={{ fontSize: '14px !important' }} />}
                          label={isClaimedByMe ? "You're Cooking This! 🍳" : 'Chef Cooking This!'}
                          color="success"
                          sx={{ fontWeight: 'bold' }}
                        />
                      ) : (
                        <Chip
                          size="small"
                          label="Open for Chefs"
                          sx={{ bgcolor: 'rgba(255,255,255,0.1)', color: '#aaa' }}
                        />
                      )}
                    </Box>

                    {/* Title & Description */}
                    <Typography variant="h6" fontWeight="bold" gutterBottom sx={{ color: '#fff' }}>
                      {item.title}
                    </Typography>

                    <Typography variant="body2" color="text.secondary" mb={2} sx={{ minHeight: 40 }}>
                      {item.description || 'Requested by a neighbor in the society.'}
                    </Typography>

                    {/* Chef Fulfillment Banner for Claimed Dishes (Fixing Screenshot Issue) */}
                    {isClaimed && (
                      <Box
                        sx={{
                          bgcolor: 'rgba(46, 196, 182, 0.08)',
                          p: 1.5,
                          borderRadius: 2,
                          mb: 2,
                          border: '1px solid rgba(46, 196, 182, 0.2)',
                        }}
                      >
                        <Typography variant="caption" display="block" color="#2EC4B6" fontWeight="bold">
                          {`🍳 Accepted by ${item.seller_name ? (item.seller_name.toLowerCase().startsWith('chef') ? item.seller_name : `Chef ${item.seller_name}`) : 'Home Cook'}${item.seller_flat ? ` (Flat #${item.seller_flat})` : ''}`}
                        </Typography>

                        {item.menu_price && (
                          <Typography variant="caption" display="block" color="#fff" mt={0.5}>
                            💰 Special Pre-Order Batch: <strong>₹{item.menu_price}</strong>
                          </Typography>
                        )}
                      </Box>
                    )}

                    {/* Match Reasons Highlight (for sellers on open items) */}
                    {hasMatch && !isClaimed && item.match_reasons && item.match_reasons.length > 0 && (
                      <Box sx={{ bgcolor: 'rgba(246, 189, 96, 0.08)', p: 1, borderRadius: 1.5, mb: 1.5 }}>
                        <Typography variant="caption" color="#F6BD60" display="block">
                          💡 {item.match_reasons[0]}
                        </Typography>
                      </Box>
                    )}

                    {/* Resident Info & Preferred Date */}
                    <Box display="flex" alignItems="center" gap={1} color="text.secondary">
                      <Typography variant="caption">
                        By: {item.user_name} {item.user_flat ? `(${item.user_flat})` : ''}
                      </Typography>
                      {item.target_date && (
                        <Box display="flex" alignItems="center" gap={0.5} ml="auto">
                          <CalendarMonthIcon sx={{ fontSize: 14, color: '#F6BD60' }} />
                          <Typography variant="caption" color="#F6BD60">
                            {item.target_date}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  </CardContent>

                  <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />

                  {/* ── Card Actions Bar ── */}
                  <CardActions sx={{ p: 2, justifyContent: 'space-between', alignItems: 'center' }}>
                    {/* Upvote Button */}
                    <Button
                      size="small"
                      variant={item.has_upvoted ? 'contained' : 'outlined'}
                      onClick={() => handleUpvote(item.id)}
                      startIcon={
                        item.has_upvoted ? (
                          <FavoriteIcon sx={{ color: '#E05A2B' }} />
                        ) : (
                          <FavoriteBorderIcon />
                        )
                      }
                      sx={{
                        color: item.has_upvoted ? '#fff' : '#E05A2B',
                        borderColor: '#E05A2B',
                        bgcolor: item.has_upvoted ? 'rgba(224, 90, 43, 0.2)' : 'transparent',
                        fontWeight: 'bold',
                        textTransform: 'none',
                      }}
                    >
                      {item.upvotes_count} {item.upvotes_count === 1 ? 'Vote' : 'Votes'}
                    </Button>

                    {/* Chef Actions vs Buyer Actions */}
                    {isSeller ? (
                      item.status === 'open' ? (
                        <Button
                          size="small"
                          variant="contained"
                          onClick={() => handleOpenClaimModal(item)}
                          startIcon={<DoneAllIcon />}
                          sx={{
                            bgcolor: '#2EC4B6',
                            color: '#000',
                            fontWeight: 'bold',
                            textTransform: 'none',
                            '&:hover': { bgcolor: '#249e92' },
                          }}
                        >
                          Accept & Cook 🍳
                        </Button>
                      ) : isClaimedByMe ? (
                        <Button
                          size="small"
                          variant="outlined"
                          component={Link}
                          to="/seller/dashboard"
                          sx={{
                            color: '#2EC4B6',
                            borderColor: '#2EC4B6',
                            fontWeight: 'bold',
                            textTransform: 'none',
                          }}
                        >
                          Kitchen Hub →
                        </Button>
                      ) : (
                        <Button
                          size="small"
                          variant="outlined"
                          component={Link}
                          to={`/menu/${item.accepted_by_seller_id}`}
                          sx={{ color: '#aaa', textTransform: 'none' }}
                        >
                          Chef's Menu
                        </Button>
                      )
                    ) : (
                      /* Buyer Actions */
                      isClaimed && item.accepted_by_seller_id ? (
                        <Button
                          size="small"
                          variant="contained"
                          component={Link}
                          to={`/menu/${item.accepted_by_seller_id}`}
                          startIcon={<ShoppingBagOutlinedIcon />}
                          sx={{
                            bgcolor: '#E05A2B',
                            fontWeight: 'bold',
                            textTransform: 'none',
                            '&:hover': { bgcolor: '#c9481c' },
                          }}
                        >
                          Pre-Order Now 🛒
                        </Button>
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          Awaiting Chef
                        </Typography>
                      )
                    )}
                  </CardActions>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      {/* ── Propose Dish Dialog ── */}
      <Dialog
        open={openPropose}
        onClose={() => setOpenPropose(false)}
        PaperProps={{ sx: { bgcolor: '#161622', color: '#fff', width: 480 } }}
      >
        <DialogTitle fontWeight="bold">Request a Homemade Dish</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Dish Name (e.g. Hyderabadi Dum Biryani)"
            value={proposeTitle}
            onChange={(e) => setProposeTitle(e.target.value)}
            margin="dense"
            sx={{ mb: 2, '& .MuiInputBase-input': { color: '#fff' } }}
          />

          <TextField
            fullWidth
            label="Category"
            select
            value={proposeCat}
            onChange={(e) => setProposeCat(e.target.value)}
            margin="dense"
            sx={{ mb: 2, '& .MuiInputBase-input': { color: '#fff' } }}
          >
            {CATEGORIES.filter((c) => c !== 'all').map((c) => (
              <MenuItem key={c} value={c}>
                {c.toUpperCase()}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            fullWidth
            multiline
            rows={2}
            label="Details / Specific Preferences"
            placeholder="e.g. looking for authentic home spices, mild spicy"
            value={proposeDesc}
            onChange={(e) => setProposeDesc(e.target.value)}
            margin="dense"
            sx={{ mb: 2, '& .MuiInputBase-input': { color: '#fff' } }}
          />

          <TextField
            fullWidth
            type="date"
            label="Preferred Meal Date"
            InputLabelProps={{ shrink: true }}
            value={proposeDate}
            onChange={(e) => setProposeDate(e.target.value)}
            margin="dense"
            sx={{ '& .MuiInputBase-input': { color: '#fff' } }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenPropose(false)} sx={{ color: '#aaa' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={submittingPropose || !proposeTitle.trim()}
            onClick={handleProposeSubmit}
            sx={{ bgcolor: '#E05A2B', fontWeight: 'bold' }}
          >
            {submittingPropose ? <CircularProgress size={20} /> : 'Post Request'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Dual Chef Acceptance Modal ── */}
      <Dialog
        open={Boolean(selectedSuggestion)}
        onClose={() => setSelectedSuggestion(null)}
        PaperProps={{ sx: { bgcolor: '#161622', color: '#fff', width: 520, borderRadius: 3 } }}
      >
        <DialogTitle fontWeight="bold">
          Accept Craving: "{selectedSuggestion?.title}"
        </DialogTitle>
        <DialogContent>
          {/* Dual Mode Switcher Tabs */}
          <Tabs
            value={claimTab}
            onChange={(e, val) => setClaimTab(val)}
            textColor="inherit"
            indicatorColor="primary"
            variant="fullWidth"
            sx={{ mb: 2.5, borderBottom: '1px solid rgba(255,255,255,0.1)' }}
          >
            <Tab label="🚀 Launch New Batch" sx={{ fontWeight: 'bold', textTransform: 'none' }} />
            <Tab label="🔗 Link Existing Dish" sx={{ fontWeight: 'bold', textTransform: 'none' }} />
          </Tabs>

          {claimTab === 0 ? (
            /* Mode A: Launch New Pre-Order Batch */
            <Box>
              <Typography variant="body2" color="text.secondary" mb={2}>
                Set your batch price, cutoff schedule, and available slots. A new pre-order dish will be published to your kitchen menu.
              </Typography>

              <TextField
                fullWidth
                type="number"
                label="Portion Price (₹)"
                value={claimPrice}
                onChange={(e) => setClaimPrice(e.target.value)}
                margin="dense"
                sx={{ mb: 2, '& .MuiInputBase-input': { color: '#fff' } }}
              />

              <TextField
                fullWidth
                type="number"
                label="Max Batch Capacity (Portions)"
                value={claimBatch}
                onChange={(e) => setClaimBatch(e.target.value)}
                margin="dense"
                sx={{ mb: 2, '& .MuiInputBase-input': { color: '#fff' } }}
              />

              <TextField
                fullWidth
                label="Pre-Order Booking Cutoff (e.g. 11:00 AM)"
                value={claimCutoff}
                onChange={(e) => setClaimCutoff(e.target.value)}
                margin="dense"
                sx={{ mb: 2, '& .MuiInputBase-input': { color: '#fff' } }}
              />

              <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                Available Delivery / Pickup Slots:
              </Typography>
              <Box display="flex" flexWrap="wrap" gap={1}>
                {DELIVERY_SLOTS.map((slot) => {
                  const isChecked = selectedSlots.includes(slot.id);
                  return (
                    <Chip
                      key={slot.id}
                      label={slot.label}
                      onClick={() => {
                        setSelectedSlots((prev) =>
                          isChecked ? prev.filter((s) => s !== slot.id) : [...prev, slot.id]
                        );
                      }}
                      color={isChecked ? 'primary' : 'default'}
                      variant={isChecked ? 'filled' : 'outlined'}
                      sx={{ cursor: 'pointer', fontWeight: 'bold' }}
                    />
                  );
                })}
              </Box>
            </Box>
          ) : (
            /* Mode B: Link Existing Menu Dish */
            <Box>
              <Typography variant="body2" color="text.secondary" mb={2}>
                Already prepare this dish? Select it from your kitchen to instantly fulfill this craving with zero duplicate setup!
              </Typography>

              <FormControl fullWidth margin="dense" sx={{ mb: 2 }}>
                <InputLabel sx={{ color: '#aaa' }}>Select Dish from Your Menu</InputLabel>
                <Select
                  value={selectedExistingMenuId}
                  onChange={(e) => setSelectedExistingMenuId(e.target.value)}
                  label="Select Dish from Your Menu"
                  sx={{ color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' } }}
                >
                  {chefMenuItems.length === 0 ? (
                    <MenuItem disabled value="">
                      No active dishes found in your kitchen.
                    </MenuItem>
                  ) : (
                    chefMenuItems.map((menu) => (
                      <MenuItem key={menu.id} value={menu.id}>
                        {menu.name} — ₹{menu.price} ({menu.category})
                      </MenuItem>
                    ))
                  )}
                </Select>
              </FormControl>

              {selectedExistingMenuId && (
                <Alert severity="info" sx={{ bgcolor: 'rgba(46, 196, 182, 0.1)', color: '#2EC4B6' }}>
                  This craving will immediately show your existing dish and route interested residents to your kitchen menu.
                </Alert>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setSelectedSuggestion(null)} sx={{ color: '#aaa' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={submittingClaim || (claimTab === 1 && !selectedExistingMenuId)}
            onClick={handleClaimSubmit}
            sx={{ bgcolor: '#2EC4B6', color: '#000', fontWeight: 'bold' }}
          >
            {submittingClaim ? <CircularProgress size={20} /> : claimTab === 1 ? 'Link & Fulfill 🔗' : 'Launch Batch 🚀'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

SuggestionsBoard.propTypes = {
  currentUser: PropTypes.shape({
    id: PropTypes.number,
    role: PropTypes.string,
    name: PropTypes.string,
    email: PropTypes.string,
    flat_number: PropTypes.string,
  }),
};
