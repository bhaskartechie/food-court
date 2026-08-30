import React, { useState, useEffect } from 'react';
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
  IconButton,
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
  Badge,
} from '@mui/material';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import FavoriteIcon from '@mui/icons-material/Favorite';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import RestaurantMenuIcon from '@mui/icons-material/RestaurantMenu';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { suggestionsAPI, getErrorMessage } from '../services/api';

const CATEGORIES = ['all', 'veg', 'non-veg', 'snacks', 'desserts'];

export default function SuggestionsBoard({ currentUser }) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [error, setError] = useState(null);

  // Propose Modal
  const [openPropose, setOpenPropose] = useState(false);
  const [proposeTitle, setProposeTitle] = useState('');
  const [proposeDesc, setProposeDesc] = useState('');
  const [proposeCat, setProposeCat] = useState('veg');
  const [proposeDate, setProposeDate] = useState('');
  const [submittingPropose, setSubmittingPropose] = useState(false);

  // Chef Claim Modal
  const [selectedSuggestion, setSelectedSuggestion] = useState(null);
  const [claimPrice, setClaimPrice] = useState(150);
  const [claimBatch, setClaimBatch] = useState(15);
  const [claimCutoff, setClaimCutoff] = useState('11:00');
  const [submittingClaim, setSubmittingClaim] = useState(false);
  const [claimSuccessMsg, setClaimSuccessMsg] = useState(null);

  const isSeller = currentUser?.role === 'seller' || currentUser?.role === 'admin';

  const fetchSuggestions = async () => {
    try {
      setLoading(true);
      const cat = categoryFilter === 'all' ? null : categoryFilter;
      const res = await suggestionsAPI.list(null, cat);
      setSuggestions(res.data.suggestions || []);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load community cravings.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuggestions();
  }, [categoryFilter]);

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

  const handleClaimSubmit = async () => {
    if (!selectedSuggestion) return;
    try {
      setSubmittingClaim(true);
      const res = await suggestionsAPI.claim(selectedSuggestion.id, {
        price: parseFloat(claimPrice),
        max_batch_quantity: parseInt(claimBatch, 10),
        preorder_cutoff_time: claimCutoff,
        available_slots: ['lunch_today', 'dinner_today'],
      });
      setClaimSuccessMsg(res.data.message);
      setSelectedSuggestion(null);
      fetchSuggestions();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to claim dish suggestion.'));
    } finally {
      setSubmittingClaim(false);
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4, color: '#fff' }}>
      {/* Header Banner */}
      <Box
        sx={{
          bgcolor: 'linear-gradient(135deg, #1F1F35 0%, #161622 100%)',
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
            Request homemade dishes you crave! Upvote neighbor favorites or launch pre-orders as a chef.
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

      {/* Category Tabs */}
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

      {/* Cards Grid */}
      {loading ? (
        <Box display="flex" justifyContent="center" py={8}>
          <CircularProgress sx={{ color: '#E05A2B' }} />
        </Box>
      ) : suggestions.length === 0 ? (
        <Box textAlign="center" py={8} color="text.secondary">
          <RestaurantMenuIcon sx={{ fontSize: 60, mb: 1, opacity: 0.5 }} />
          <Typography variant="h6">No dish cravings yet in this category.</Typography>
          <Typography variant="body2">Be the first resident to request a meal!</Typography>
        </Box>
      ) : (
        <Grid container spacing={3}>
          {suggestions.map((item) => (
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
                  {/* Category & Status */}
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5}>
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

                    {item.status === 'claimed_by_chef' ? (
                      <Chip
                        size="small"
                        icon={<CheckCircleIcon sx={{ fontSize: '14px !important' }} />}
                        label="Chef Cooking This!"
                        color="success"
                        sx={{ fontWeight: 'bold' }}
                      />
                    ) : (
                      <Chip
                        size="small"
                        label="Open for Votes"
                        sx={{ bgcolor: 'rgba(255,255,255,0.1)', color: '#aaa' }}
                      />
                    )}
                  </Box>

                  {/* Title & Description */}
                  <Typography variant="h6" fontWeight="bold" gutterBottom>
                    {item.title}
                  </Typography>

                  <Typography variant="body2" color="text.secondary" mb={2}>
                    {item.description || 'Requested by a resident in the society.'}
                  </Typography>

                  {/* Resident Info & Date */}
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

                {/* Actions */}
                <CardActions sx={{ p: 2, pt: 0, justifyContent: 'space-between' }}>
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

                  {/* Chef Action */}
                  {isSeller && item.status === 'open' && (
                    <Button
                      size="small"
                      variant="contained"
                      onClick={() => setSelectedSuggestion(item)}
                      sx={{
                        bgcolor: '#2EC4B6',
                        color: '#000',
                        fontWeight: 'bold',
                        textTransform: 'none',
                        '&:hover': { bgcolor: '#249e92' },
                      }}
                    >
                      I'll Cook This!
                    </Button>
                  )}
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Propose Dish Dialog */}
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

      {/* Chef Claim Dialog */}
      <Dialog
        open={Boolean(selectedSuggestion)}
        onClose={() => setSelectedSuggestion(null)}
        PaperProps={{ sx: { bgcolor: '#161622', color: '#fff', width: 480 } }}
      >
        <DialogTitle fontWeight="bold">
          Launch Pre-Order for "{selectedSuggestion?.title}"
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Set your batch price and pre-order cutoff time. An instant pre-order item will be added to your kitchen menu.
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
            sx={{ '& .MuiInputBase-input': { color: '#fff' } }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setSelectedSuggestion(null)} sx={{ color: '#aaa' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={submittingClaim}
            onClick={handleClaimSubmit}
            sx={{ bgcolor: '#2EC4B6', color: '#000', fontWeight: 'bold' }}
          >
            {submittingClaim ? <CircularProgress size={20} /> : 'Launch Batch'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
