import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  TextField,
  Button,
  Chip,
  Alert,
  CircularProgress,
  Divider,
  Stack,
  Card,
  CardContent,
} from '@mui/material';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import QrCodeIcon from '@mui/icons-material/QrCode';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import CardGiftcardIcon from '@mui/icons-material/CardGiftcard';
import { sellersAPI, paymentsAPI, getErrorMessage } from '../services/api';

export default function ProfilePage() {
  let user = null;
  try {
    user = JSON.parse(localStorage.getItem('user'));
  } catch {
    user = null;
  }

  const isSeller = user?.role === 'seller';

  // Seller profile states
  const [loading, setLoading] = useState(isSeller);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [upiId, setUpiId] = useState('');
  const [upiAccountName, setUpiAccountName] = useState('');
  const [bio, setBio] = useState('');
  const [freeOrders, setFreeOrders] = useState(50);
  const [maintenanceBalance, setMaintenanceBalance] = useState(0.0);
  const [isUpiVerified, setIsUpiVerified] = useState(false);

  useEffect(() => {
    if (!isSeller) return;

    let isMounted = true;
    const fetchSellerData = async () => {
      try {
        setLoading(true);
        const res = await sellersAPI.getMe();
        if (isMounted && res.data) {
          setUpiId(res.data.upi_id || '');
          setUpiAccountName(res.data.upi_account_name || res.data.name || '');
          setBio(res.data.bio || '');
          setFreeOrders(res.data.free_orders_remaining ?? 50);
          setMaintenanceBalance(res.data.maintenance_balance ?? 0.0);
          setIsUpiVerified(Boolean(res.data.upi_id));
        }
      } catch (err) {
        if (isMounted) {
          setError(getErrorMessage(err, 'Failed to load seller profile details.'));
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchSellerData();
    return () => {
      isMounted = false;
    };
  }, [isSeller]);

  const isValidUpi = upiId.trim().length > 0 && /^[a-zA-Z0-9.\-_]+@[a-zA-Z]{3,}$/.test(upiId.trim());

  const handleSaveUpi = async (e) => {
    e.preventDefault();
    if (upiId.trim() && !isValidUpi) {
      setError('Please enter a valid UPI ID (e.g. yourname@oksbi or mobile@paytm)');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      await sellersAPI.updateProfile({
        upi_id: upiId.trim() || null,
        upi_account_name: upiAccountName.trim() || null,
        bio: bio.trim() || null,
      });

      setIsUpiVerified(Boolean(upiId.trim()));
      setSuccess('Kitchen payment details updated successfully!');
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to save payment details.'));
    } finally {
      setSaving(false);
    }
  };

  const testUpiUri = upiId.trim()
    ? `upi://pay?pa=${encodeURIComponent(upiId.trim())}&pn=${encodeURIComponent(
        upiAccountName.trim() || user?.name || 'Chef'
      )}&am=1.00&cu=INR&tn=UPI_Test_Verification`
    : '';

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Stack spacing={3}>
        {/* User Card */}
        <Paper
          sx={{
            p: 3,
            bgcolor: '#141420',
            color: '#fff',
            borderRadius: 2,
            border: '1px solid #232336',
          }}
        >
          <Typography variant="h5" fontWeight="bold" gutterBottom>
            User Profile
          </Typography>
          {user ? (
            <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Typography>
                <strong>Name:</strong> {user.name || '—'}
              </Typography>
              <Typography>
                <strong>Email:</strong> {user.email || '—'}
              </Typography>
              <Typography>
                <strong>Flat / Door No:</strong> {user.flat_number || '—'}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                <Typography component="span">
                  <strong>Active Role:</strong>
                </Typography>
                <Chip
                  label={user.role ? user.role.toUpperCase() : 'BUYER'}
                  color={isSeller ? 'warning' : 'primary'}
                  size="small"
                />
              </Box>
            </Box>
          ) : (
            <Typography color="text.secondary">Not logged in.</Typography>
          )}
        </Paper>

        {/* Seller Specific: Direct P2PM UPI Configuration */}
        {isSeller && (
          <Paper
            sx={{
              p: 3,
              bgcolor: '#141420',
              color: '#fff',
              borderRadius: 2,
              border: '1px solid #232336',
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <AccountBalanceWalletIcon sx={{ color: '#E05A2B', fontSize: 28 }} />
                <Typography variant="h6" fontWeight="bold">
                  Direct P2PM UPI Payment Configuration
                </Typography>
              </Box>
              {isUpiVerified ? (
                <Chip
                  icon={<CheckCircleIcon />}
                  label="Direct UPI Active"
                  color="success"
                  size="small"
                  sx={{ fontWeight: 'bold' }}
                />
              ) : (
                <Chip
                  icon={<WarningAmberIcon />}
                  label="UPI Setup Required"
                  color="warning"
                  size="small"
                  sx={{ fontWeight: 'bold' }}
                />
              )}
            </Box>

            <Typography variant="body2" sx={{ color: '#aaa', mb: 3 }}>
              Buyers pay directly into your personal or business UPI account. <strong>0% aggregator commission</strong>.
              Funds settle directly into your bank account via UPI rails.
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                {error}
              </Alert>
            )}
            {success && (
              <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
                {success}
              </Alert>
            )}

            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress size={32} />
              </Box>
            ) : (
              <Box component="form" onSubmit={handleSaveUpi}>
                <Stack spacing={2.5}>
                  <TextField
                    label="Your UPI ID / VPA"
                    placeholder="e.g. chef.name@oksbi or 9876543210@paytm"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    required
                    fullWidth
                    helperText={
                      upiId && !isValidUpi
                        ? 'Invalid UPI ID format (expected: handle@bank)'
                        : 'Exact UPI ID where buyers will transfer meal payments.'
                    }
                    error={Boolean(upiId && !isValidUpi)}
                    InputLabelProps={{ sx: { color: '#bbb' } }}
                    InputProps={{ sx: { color: '#fff', bgcolor: '#1b1b2a' } }}
                  />

                  <TextField
                    label="Account Holder / Display Name"
                    placeholder="e.g. Lakshmi Devi"
                    value={upiAccountName}
                    onChange={(e) => setUpiAccountName(e.target.value)}
                    fullWidth
                    helperText="Display name as shown on your bank account / UPI app."
                    InputLabelProps={{ sx: { color: '#bbb' } }}
                    InputProps={{ sx: { color: '#fff', bgcolor: '#1b1b2a' } }}
                  />

                  <TextField
                    label="Kitchen Bio / Specialties"
                    multiline
                    rows={2}
                    placeholder="e.g. Authentic homemade Andhra meals and evening snacks."
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    fullWidth
                    InputLabelProps={{ sx: { color: '#bbb' } }}
                    InputProps={{ sx: { color: '#fff', bgcolor: '#1b1b2a' } }}
                  />

                  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', pt: 1 }}>
                    <Button
                      type="submit"
                      variant="contained"
                      disabled={saving || (upiId.trim() && !isValidUpi)}
                      sx={{
                        bgcolor: '#E05A2B',
                        '&:hover': { bgcolor: '#c84e24' },
                        px: 3,
                        fontWeight: 'bold',
                      }}
                    >
                      {saving ? 'Saving...' : 'Save Payment Details'}
                    </Button>

                    {upiId.trim() && isValidUpi && (
                      <Button
                        variant="outlined"
                        href={testUpiUri}
                        target="_blank"
                        rel="noreferrer"
                        startIcon={<OpenInNewIcon />}
                        sx={{
                          color: '#4caf50',
                          borderColor: '#4caf50',
                          '&:hover': { borderColor: '#81c784', bgcolor: 'rgba(76, 175, 80, 0.08)' },
                        }}
                      >
                        Test UPI Intent Link
                      </Button>
                    )}
                  </Box>
                </Stack>
              </Box>
            )}

            <Divider sx={{ my: 3, borderColor: '#232336' }} />

            {/* SaaS Pass & Maintenance Status */}
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                <CardGiftcardIcon sx={{ color: '#4caf50', fontSize: 24 }} />
                <Typography variant="subtitle1" fontWeight="bold">
                  SaaS Pass & Platform Quota
                </Typography>
              </Box>

              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                <Card sx={{ bgcolor: '#1b1b2a', border: '1px solid #2d2d42', color: '#fff' }}>
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Typography variant="caption" sx={{ color: '#aaa' }}>
                      Free Orders Remaining
                    </Typography>
                    <Typography variant="h5" fontWeight="bold" sx={{ color: '#4caf50', mt: 0.5 }}>
                      {freeOrders} / 50
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#888', display: 'block', mt: 0.5 }}>
                      First 50 orders are 100% free of maintenance fees!
                    </Typography>
                  </CardContent>
                </Card>

                <Card sx={{ bgcolor: '#1b1b2a', border: '1px solid #2d2d42', color: '#fff' }}>
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Typography variant="caption" sx={{ color: '#aaa' }}>
                      Platform Maintenance Balance
                    </Typography>
                    <Typography variant="h5" fontWeight="bold" sx={{ color: '#E05A2B', mt: 0.5 }}>
                      ₹{Number(maintenanceBalance).toFixed(2)}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#888', display: 'block', mt: 0.5 }}>
                      ₹5.00/order charged only after 50 free orders.
                    </Typography>
                  </CardContent>
                </Card>
              </Box>
            </Box>
          </Paper>
        )}
      </Stack>
    </Container>
  );
}
