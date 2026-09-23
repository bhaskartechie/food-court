import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
  TextField,
  Alert,
  CircularProgress,
  Divider,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import LaunchIcon from '@mui/icons-material/Launch';
import { paymentsAPI, getErrorMessage } from '../services/api';

export default function DirectUPIPaymentModal({
  open,
  onClose,
  orderId,
  orderAmount,
  sellerName,
  onSuccess,
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [paymentData, setPaymentData] = useState(null);
  const [utrNumber, setUtrNumber] = useState('');
  const [submittingUtr, setSubmittingUtr] = useState(false);
  const [copied, setCopied] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);

  useEffect(() => {
    if (!open || !orderId) return;

    let isMounted = true;
    setLoading(true);
    setError(null);
    setPaymentData(null);
    setSuccessMsg(null);
    setUtrNumber('');

    paymentsAPI
      .initiateDirectUPI(orderId)
      .then((res) => {
        if (isMounted) setPaymentData(res.data);
      })
      .catch((err) => {
        if (isMounted) setError(getErrorMessage(err, 'Failed to fetch chef UPI details.'));
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [open, orderId]);

  const handleCopyVpa = () => {
    if (paymentData?.seller_vpa) {
      navigator.clipboard.writeText(paymentData.seller_vpa);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleLaunchUpi = () => {
    if (paymentData?.upi_uri) {
      window.location.href = paymentData.upi_uri;
    }
  };

  const handleSubmitUtr = async (e) => {
    e.preventDefault();
    const cleanUtr = utrNumber.trim();
    if (!cleanUtr || cleanUtr.length < 6) {
      setError('Please enter a valid 12-digit UPI reference / UTR number from your payment app.');
      return;
    }

    try {
      setSubmittingUtr(true);
      setError(null);
      await paymentsAPI.submitUTR(orderId, cleanUtr);
      setSuccessMsg('Payment reference submitted! The chef will confirm receipt.');
      setTimeout(() => {
        if (onSuccess) onSuccess(orderId, cleanUtr);
        onClose();
      }, 1800);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to submit payment UTR reference.'));
    } finally {
      setSubmittingUtr(false);
    }
  };

  const qrImageUrl = paymentData?.upi_uri
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
        paymentData.upi_uri
      )}`
    : null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: '#141420',
          color: '#fff',
          borderRadius: 3,
          border: '1px solid #232336',
          p: 1,
        },
      }}
    >
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
        <Box>
          <Typography variant="h6" fontWeight="bold">
            Direct UPI Payment
          </Typography>
          <Typography variant="caption" sx={{ color: '#4caf50', fontWeight: 'bold' }}>
            0% Platform Fee • Direct to Chef
          </Typography>
        </Box>
        <IconButton onClick={onClose} sx={{ color: '#aaa' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ borderColor: '#232336', pt: 2 }}>
        {loading && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4, gap: 2 }}>
            <CircularProgress sx={{ color: '#E05A2B' }} />
            <Typography variant="body2" sx={{ color: '#aaa' }}>
              Connecting with Chef's UPI rails...
            </Typography>
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {successMsg && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {successMsg}
          </Alert>
        )}

        {!loading && paymentData && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Amount & Payee Summary */}
            <Box
              sx={{
                bgcolor: '#1c1c2e',
                p: 2,
                borderRadius: 2,
                border: '1px solid #2e2e48',
                textAlign: 'center',
              }}
            >
              <Typography variant="caption" sx={{ color: '#aaa', textTransform: 'uppercase', letterSpacing: 1 }}>
                Pay Exactly
              </Typography>
              <Typography variant="h4" fontWeight="bold" sx={{ color: '#E05A2B', my: 0.5 }}>
                ₹{Number(paymentData.amount).toFixed(2)}
              </Typography>
              <Typography variant="body2" sx={{ color: '#ddd' }}>
                To <strong>{paymentData.seller_name}</strong>
              </Typography>

              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 1,
                  mt: 1,
                  p: 0.75,
                  bgcolor: '#131320',
                  borderRadius: 1.5,
                }}
              >
                <Typography variant="caption" sx={{ color: '#4caf50', fontFamily: 'monospace', fontWeight: 'bold' }}>
                  {paymentData.seller_vpa}
                </Typography>
                <Tooltip title={copied ? 'Copied!' : 'Copy UPI ID'}>
                  <IconButton size="small" onClick={handleCopyVpa} sx={{ color: '#fff', p: 0.5 }}>
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>

            {/* Mobile 1-Tap Trigger */}
            <Button
              variant="contained"
              fullWidth
              size="large"
              onClick={handleLaunchUpi}
              startIcon={<LaunchIcon />}
              sx={{
                bgcolor: '#E05A2B',
                '&:hover': { bgcolor: '#c84e24' },
                fontWeight: 'bold',
                py: 1.2,
              }}
            >
              Pay via any UPI App (GPay / PhonePe)
            </Button>

            <Divider sx={{ my: 1, borderColor: '#232336' }}>
              <Typography variant="caption" sx={{ color: '#888' }}>
                OR SCAN VIA QR
              </Typography>
            </Divider>

            {/* Dynamic QR Code for Desktop */}
            {qrImageUrl && (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                <Box
                  component="img"
                  src={qrImageUrl}
                  alt="UPI QR Code"
                  sx={{
                    width: 170,
                    height: 170,
                    p: 1,
                    bgcolor: '#fff',
                    borderRadius: 2,
                  }}
                />
                <Typography variant="caption" sx={{ color: '#888' }}>
                  Scan with GPay, PhonePe, Paytm, or BHIM
                </Typography>
              </Box>
            )}

            <Divider sx={{ my: 1, borderColor: '#232336' }} />

            {/* UTR Input Form */}
            <Box component="form" onSubmit={handleSubmitUtr}>
              <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                Step 2: Confirm Payment UTR
              </Typography>
              <Typography variant="caption" sx={{ color: '#aaa', display: 'block', mb: 1.5 }}>
                After completing the payment in your UPI app, paste the 12-digit UTR / Reference number from your receipt:
              </Typography>

              <TextField
                placeholder="e.g. 412345678901"
                value={utrNumber}
                onChange={(e) => setUtrNumber(e.target.value)}
                required
                fullWidth
                size="small"
                InputLabelProps={{ sx: { color: '#bbb' } }}
                InputProps={{ sx: { color: '#fff', bgcolor: '#1b1b2a', fontFamily: 'monospace' } }}
              />

              <Button
                type="submit"
                variant="outlined"
                fullWidth
                disabled={submittingUtr || utrNumber.trim().length < 6}
                startIcon={<CheckCircleOutlineIcon />}
                sx={{
                  mt: 1.5,
                  color: '#4caf50',
                  borderColor: '#4caf50',
                  '&:hover': { borderColor: '#81c784', bgcolor: 'rgba(76, 175, 80, 0.08)' },
                  fontWeight: 'bold',
                }}
              >
                {submittingUtr ? 'Submitting...' : "I've Transferred Payment"}
              </Button>
            </Box>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 2, pb: 2 }}>
        <Button onClick={onClose} sx={{ color: '#aaa' }}>
          Pay Later from Orders
        </Button>
      </DialogActions>
    </Dialog>
  );
}

DirectUPIPaymentModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  orderId: PropTypes.number,
  orderAmount: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  sellerName: PropTypes.string,
  onSuccess: PropTypes.func,
};

