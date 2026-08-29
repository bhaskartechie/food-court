import React, { useEffect, useState } from 'react';
import {
  Container,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  Button,
  Chip,
  CircularProgress,
  Alert,
  Divider,
} from '@mui/material';

import AccessTimeIcon from '@mui/icons-material/AccessTime';
import DeliveryDiningIcon from '@mui/icons-material/DeliveryDining';
import StorefrontIcon from '@mui/icons-material/Storefront';
import StarOutlineIcon from '@mui/icons-material/StarOutline';
import { ordersAPI, getErrorMessage } from '../services/api';
import RatingForm from '../components/RatingForm';

const SLOT_LABELS = {
  lunch_today: '☀️ Lunch Today',
  dinner_today: '🌙 Dinner Today',
  lunch_tomorrow: '☀️ Lunch Tomorrow',
  dinner_tomorrow: '🌙 Dinner Tomorrow',
  weekend_special: '🎉 Weekend Special',
};

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ratingOrderId, setRatingOrderId] = useState(null);

  const fetchOrders = () => {
    setLoading(true);
    ordersAPI
      .list(0, 50)
      .then((res) => setOrders(res.data?.orders || []))
      .catch((err) => setError(getErrorMessage(err, 'Failed to load orders')))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  return (
    <Container maxWidth="md" sx={{ py: 4, color: '#fff' }}>
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        Order History & Tracking
      </Typography>
      <Typography variant="body1" color="text.secondary" mb={4}>
        View your past orders, active meals, and scheduled pre-orders.
      </Typography>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress sx={{ color: '#E05A2B' }} />
        </Box>
      )}

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {!loading && !error && orders.length === 0 && (
        <Box textAlign="center" py={8} bgcolor="#191928" borderRadius={3}>
          <Typography variant="body1" color="text.secondary">
            You haven't placed any orders yet.
          </Typography>
        </Box>
      )}

      {!loading && !error && orders.length > 0 && (
        <Grid container spacing={3}>
          {orders.map((o) => (
            <Grid item xs={12} key={o.id}>
              <Card
                sx={{
                  bgcolor: '#191928',
                  borderRadius: 3,
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5}>
                    <Typography variant="h6" fontWeight="bold">
                      Order #{o.id}
                    </Typography>

                    <Chip
                      size="small"
                      label={o.status.toUpperCase()}
                      sx={{
                        bgcolor:
                          o.status === 'completed'
                            ? 'rgba(46, 196, 182, 0.2)'
                            : o.status === 'ready'
                            ? 'rgba(246, 189, 96, 0.2)'
                            : 'rgba(224, 90, 43, 0.2)',
                        color:
                          o.status === 'completed'
                            ? '#2EC4B6'
                            : o.status === 'ready'
                            ? '#F6BD60'
                            : '#E05A2B',
                        fontWeight: 'bold',
                      }}
                    />
                  </Box>

                  {/* Pre-order Slot and Delivery Type Badges */}
                  <Box display="flex" gap={1} mb={2} flexWrap="wrap">
                    {o.is_preorder && (
                      <Chip
                        size="small"
                        icon={<AccessTimeIcon fontSize="small" />}
                        label={SLOT_LABELS[o.delivery_slot] || o.delivery_slot || 'Pre-Order'}
                        sx={{ bgcolor: 'rgba(246, 189, 96, 0.15)', color: '#F6BD60', fontWeight: 'bold' }}
                      />
                    )}
                    <Chip
                      size="small"
                      icon={o.delivery_type === 'doorstep' ? <DeliveryDiningIcon fontSize="small" /> : <StorefrontIcon fontSize="small" />}
                      label={o.delivery_type === 'doorstep' ? 'Doorstep Delivery' : 'Self-Pickup'}
                      sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: '#fff' }}
                    />
                    <Typography variant="caption" color="text.secondary" ml="auto" alignSelf="center">
                      Placed: {new Date(o.created_at).toLocaleDateString()}
                    </Typography>
                  </Box>

                  {/* Line Items */}
                  <Box mb={2}>
                    {(o.items || []).map((it, idx) => (
                      <Typography key={idx} variant="body2">
                        {it.quantity}x {it.name} <span style={{ color: '#aaa' }}>— ₹{it.price * it.quantity}</span>
                      </Typography>
                    ))}
                  </Box>

                  <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', mb: 2 }} />

                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="h6" fontWeight="bold" color="#E05A2B">
                      Total: ₹{o.total_price || o.total || 0}
                    </Typography>

                    {o.status === 'completed' && (
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<StarOutlineIcon />}
                        onClick={() => setRatingOrderId(o.id)}
                        sx={{ color: '#F6BD60', borderColor: '#F6BD60', textTransform: 'none', fontWeight: 'bold' }}
                      >
                        Rate Meal
                      </Button>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Star Rating Dialog */}
      {ratingOrderId && (
        <RatingForm
          orderId={ratingOrderId}
          onSuccess={() => {
            setRatingOrderId(null);
            fetchOrders();
          }}
          onCancel={() => setRatingOrderId(null)}
        />
      )}
    </Container>
  );
}

