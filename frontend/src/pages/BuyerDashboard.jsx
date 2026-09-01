import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  Button,
  Chip,
  Stepper,
  Step,
  StepLabel,
  CircularProgress,
  Alert,
  Divider,
  TextField,
  InputAdornment,
} from '@mui/material';
import { Link, useNavigate } from 'react-router-dom';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import DeliveryDiningIcon from '@mui/icons-material/DeliveryDining';
import StoreIcon from '@mui/icons-material/Store';
import SearchIcon from '@mui/icons-material/Search';
import { ordersAPI, sellersAPI, suggestionsAPI, getErrorMessage } from '../services/api';


const ORDER_STEPS = ['Order Placed', 'Chef Cooking', 'Ready / Out for Delivery', 'Delivered'];

const STATUS_TO_STEP = {
  pending: 0,
  accepted: 1,
  ready: 2,
  completed: 3,
};

export default function BuyerDashboardPage({ currentUser }) {
  const [activeOrders, setActiveOrders] = useState([]);
  const [preorders, setPreorders] = useState([]);
  const [topSellers, setTopSellers] = useState([]);
  const [trendingCravings, setTrendingCravings] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [ordersRes, sellersRes, suggRes] = await Promise.all([
          ordersAPI.list(0, 20).catch(() => ({ data: { orders: [] } })),
          sellersAPI.list(0, 4).catch(() => ({ data: { sellers: [] } })),
          suggestionsAPI.list(null, null, 0, 3).catch(() => ({ data: { suggestions: [] } })),
        ]);

        const allOrders = ordersRes.data.orders || [];
        setActiveOrders(allOrders.filter((o) => o.status !== 'completed' && o.status !== 'cancelled' && !o.is_preorder));
        setPreorders(allOrders.filter((o) => o.is_preorder && o.status !== 'completed' && o.status !== 'cancelled'));
        setTopSellers(sellersRes.data.sellers || []);
        setTrendingCravings(suggRes.data.suggestions || []);
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to load dashboard.'));
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <Container maxWidth="lg" sx={{ py: 4, color: '#fff' }}>
      {/* Welcome Banner */}
      <Box
        sx={{
          bgcolor: 'linear-gradient(135deg, #1F1F35 0%, #161622 100%)',
          p: { xs: 3, md: 4 },
          borderRadius: 3,
          mb: 4,
          border: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <Box>
          <Typography variant="h4" fontWeight="bold">
            Welcome back, {currentUser?.name || 'Neighbor'}! 👋
          </Typography>
          <Typography variant="body1" color="text.secondary" mt={0.5}>
            Fresh, authentic home-cooked meals from passionate chefs in your society.
          </Typography>
        </Box>

        <Box display="flex" gap={1.5}>
          <Button
            component={Link}
            to="/suggestions"
            variant="contained"
            startIcon={<LocalFireDepartmentIcon />}
            sx={{ bgcolor: '#E05A2B', fontWeight: 'bold', textTransform: 'none', borderRadius: 2 }}
          >
            Community Cravings
          </Button>
          <Button
            component={Link}
            to="/sellers"
            variant="outlined"
            sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.2)', fontWeight: 'bold', textTransform: 'none', borderRadius: 2 }}
          >
            Browse Chefs
          </Button>
        </Box>
      </Box>

      {/* Quick Marketplace Search */}
      <Box sx={{ mb: 4 }}>
        <TextField
          fullWidth
          placeholder="Search home chefs, authentic dishes, or your favorite building specialties..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && searchQuery.trim()) {
              navigate(`/sellers?search=${encodeURIComponent(searchQuery.trim())}`);
            }
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: 'rgba(255,255,255,0.5)' }} />
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                <Button
                  size="small"
                  variant="contained"
                  onClick={() => {
                    if (searchQuery.trim()) {
                      navigate(`/sellers?search=${encodeURIComponent(searchQuery.trim())}`);
                    }
                  }}
                  sx={{ bgcolor: '#E05A2B', textTransform: 'none', fontWeight: 'bold', '&:hover': { bgcolor: '#c9481c' } }}
                >
                  Search Chefs
                </Button>
              </InputAdornment>
            ),
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
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}


      {loading ? (
        <Box display="flex" justifyContent="center" py={6}>
          <CircularProgress sx={{ color: '#E05A2B' }} />
        </Box>
      ) : (
        <Grid container spacing={4}>
          {/* Left Column: Live Orders & Pre-Orders */}
          <Grid item xs={12} md={8}>
            {/* Live Instant Order Tracker */}
            <Typography variant="h5" fontWeight="bold" mb={2}>
              🚀 Live Kitchen Order Tracker
            </Typography>

            {activeOrders.length === 0 ? (
              <Box bgcolor="#191928" p={3} borderRadius={3} mb={4} textAlign="center" border="1px solid rgba(255,255,255,0.08)">
                <Typography variant="body1" color="text.secondary">
                  No active orders right now. Craving something delicious?
                </Typography>
                <Button component={Link} to="/sellers" sx={{ color: '#E05A2B', fontWeight: 'bold', mt: 1 }}>
                  Explore Society Menus →
                </Button>
              </Box>
            ) : (
              activeOrders.map((order) => (
                <Card key={order.id} sx={{ bgcolor: '#191928', borderRadius: 3, border: '1px solid rgba(255,255,255,0.08)', mb: 3 }}>
                  <CardContent sx={{ p: 3 }}>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                      <Typography variant="h6" fontWeight="bold">
                        Order #{order.id}
                      </Typography>
                      <Chip
                        size="small"
                        icon={<DeliveryDiningIcon />}
                        label={order.delivery_type === 'doorstep' ? 'Doorstep Delivery' : 'Self-Pickup'}
                        sx={{ bgcolor: 'rgba(46, 196, 182, 0.2)', color: '#2EC4B6', fontWeight: 'bold' }}
                      />
                    </Box>

                    {/* Progress Stepper */}
                    <Box my={3}>
                      <Stepper activeStep={STATUS_TO_STEP[order.status] ?? 0} alternativeLabel>
                        {ORDER_STEPS.map((label, idx) => (
                          <Step key={label}>
                            <StepLabel
                              StepIconProps={{
                                sx: {
                                  '&.Mui-active': { color: '#E05A2B' },
                                  '&.Mui-completed': { color: '#2EC4B6' },
                                },
                              }}
                            >
                              <Typography variant="caption" sx={{ color: '#fff' }}>
                                {label}
                              </Typography>
                            </StepLabel>
                          </Step>
                        ))}
                      </Stepper>
                    </Box>

                    <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', mb: 2 }} />

                    <Box display="flex" justifyContent="space-between" alignItems="center">
                      <Box>
                        {(order.items || []).map((it, idx) => (
                          <Typography key={idx} variant="body2" color="text.secondary">
                            {it.quantity}x {it.name}
                          </Typography>
                        ))}
                      </Box>
                      <Typography variant="h6" fontWeight="bold" color="#E05A2B">
                        ₹{order.total_price}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              ))
            )}

            {/* Scheduled Pre-Orders */}
            <Typography variant="h5" fontWeight="bold" mb={2} mt={4}>
              📅 Scheduled Pre-Orders ({preorders.length})
            </Typography>

            {preorders.length === 0 ? (
              <Box bgcolor="#191928" p={3} borderRadius={3} textAlign="center" border="1px solid rgba(255,255,255,0.08)">
                <Typography variant="body2" color="text.secondary">
                  No upcoming scheduled pre-orders. Check chefs' weekend and dinner specials!
                </Typography>
              </Box>
            ) : (
              preorders.map((po) => (
                <Card key={po.id} sx={{ bgcolor: '#191928', borderRadius: 3, border: '1px solid rgba(255,255,255,0.08)', mb: 2 }}>
                  <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                      <Box display="flex" alignItems="center" gap={1}>
                        <AccessTimeIcon sx={{ color: '#F6BD60' }} />
                        <Typography variant="subtitle1" fontWeight="bold">
                          Pre-Order #{po.id}
                        </Typography>
                      </Box>
                      <Chip
                        size="small"
                        label={po.delivery_slot || 'Scheduled'}
                        sx={{ bgcolor: 'rgba(246, 189, 96, 0.2)', color: '#F6BD60', fontWeight: 'bold' }}
                      />
                    </Box>
                    <Typography variant="body2" color="text.secondary" mt={1}>
                      {(po.items || []).map((it) => `${it.quantity}x ${it.name}`).join(', ')} • Total: ₹{po.total_price}
                    </Typography>
                  </CardContent>
                </Card>
              ))
            )}
          </Grid>

          {/* Right Column: Trending Cravings & Quick Actions */}
          <Grid item xs={12} md={4}>
            {/* Trending Community Cravings */}
            <Card sx={{ bgcolor: '#191928', borderRadius: 3, border: '1px solid rgba(255,255,255,0.08)', mb: 3 }}>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1} mb={2}>
                  <LocalFireDepartmentIcon sx={{ color: '#E05A2B' }} />
                  <Typography variant="h6" fontWeight="bold">
                    Community Cravings
                  </Typography>
                </Box>

                {trendingCravings.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    No active dish requests yet.
                  </Typography>
                ) : (
                  trendingCravings.map((crave) => (
                    <Box key={crave.id} mb={2} p={1.5} bgcolor="#1F1F35" borderRadius={2}>
                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Typography variant="subtitle2" fontWeight="bold">
                          {crave.title}
                        </Typography>
                        <Chip size="small" label={`${crave.upvotes_count} votes`} sx={{ bgcolor: 'rgba(224, 90, 43, 0.2)', color: '#E05A2B', fontWeight: 'bold', fontSize: 11 }} />
                      </Box>
                      <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
                        {crave.description || 'Requested by resident'}
                      </Typography>
                    </Box>
                  ))
                )}

                <Button component={Link} to="/suggestions" fullWidth variant="outlined" sx={{ color: '#E05A2B', borderColor: '#E05A2B', fontWeight: 'bold', textTransform: 'none', mt: 1 }}>
                  View All Cravings & Upvote →
                </Button>
              </CardContent>
            </Card>

            {/* Top Recommended Chefs */}
            {topSellers.length > 0 && (
              <Card sx={{ bgcolor: '#191928', borderRadius: 3, border: '1px solid rgba(255,255,255,0.08)' }}>
                <CardContent>
                  <Box display="flex" alignItems="center" gap={1} mb={2}>
                    <StoreIcon sx={{ color: '#2EC4B6' }} />
                    <Typography variant="h6" fontWeight="bold">
                      Society Top Chefs
                    </Typography>
                  </Box>

                  {topSellers.slice(0, 3).map((seller) => (
                    <Box key={seller.id} mb={1.5} p={1.5} bgcolor="#1F1F35" borderRadius={2} display="flex" justifyContent="space-between" alignItems="center">
                      <Box>
                        <Typography variant="subtitle2" fontWeight="bold">
                          {seller.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          ⚡ {seller.on_time_delivery_rate ?? 100}% on-time • ~{seller.avg_delivery_minutes ?? 25}m
                        </Typography>
                      </Box>
                      <Button component={Link} to={`/menus/${seller.id}`} size="small" variant="text" sx={{ color: '#2EC4B6', fontWeight: 'bold', textTransform: 'none' }}>
                        Menu →
                      </Button>
                    </Box>
                  ))}
                </CardContent>
              </Card>
            )}
          </Grid>
        </Grid>
      )}
    </Container>
  );
}


