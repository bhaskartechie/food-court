import React, { useState, useEffect, createContext, useContext } from 'react';
import PropTypes from 'prop-types';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
  Link,
} from 'react-router-dom';
import {
  ThemeProvider,
  createTheme,
  CssBaseline,
  AppBar,
  Toolbar,
  Typography,
  Button,
  Container,
  Box,
  Card,
  CardContent,
  CardActions,
  Grid,
  TextField,
  Alert,
  CircularProgress,
  Chip,
  Avatar,
  Divider,
  Paper,
  Badge,
  IconButton,
  Tabs,
  Tab,
  InputAdornment,
  Popover,
} from '@mui/material';

import RestaurantIcon from '@mui/icons-material/Restaurant';
import StoreIcon from '@mui/icons-material/Store';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import ShoppingBagOutlinedIcon from '@mui/icons-material/ShoppingBagOutlined';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import DeliveryDiningIcon from '@mui/icons-material/DeliveryDining';
import HomeIcon from '@mui/icons-material/Home';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import { authAPI, sellersAPI, getErrorMessage } from './services/api';

import MenuPage from './pages/Menu';
import OrdersPage from './pages/Orders';
import ProfilePage from './pages/Profile';
import SellerDashboardPage from './pages/SellerDashboard';
import BuyerDashboardPage from './pages/BuyerDashboard';
import SuggestionsBoard from './pages/SuggestionsBoard';
import CartDrawer from './components/CartDrawer';
import Footer from './components/Footer';
import './App.css';
import LandingPage from './pages/Landing';

// ── Warm Culinary Theme (Modern Coffee/Food Ordering Inspired) ───────────────
const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#E05A2B', dark: '#C9481C', light: '#FF7D4D' },       // Warm Terracotta
    forest: { main: '#1B4332', light: '#2D6A4F', contrastText: '#FFFFFF' }, // Dark Forest Green
    secondary: { main: '#F6BD60' },     // Honey Saffron
    success: { main: '#2D6A4F' },       // Deep Forest Mint
    background: { default: '#0F0F1A', paper: '#181828' },
  },
  typography: {
    fontFamily: '"Poppins", "Plus Jakarta Sans", "Inter", -apple-system, sans-serif',
    h4: { fontWeight: 700 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: { borderRadius: 16, border: '1px solid rgba(255,255,255,0.08)' },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 12, textTransform: 'none', fontWeight: 600 },
      },
    },
  },
});

// ── Auth Context ─────────────────────────────────────────────────────────────
// ── Auth Context ─────────────────────────────────────────────────────────────
const AuthContext = createContext(null);

function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('user'));
    } catch {
      return null;
    }
  });

  const login = (userData, token) => {
    localStorage.setItem('access_token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    setUser(null);
  };

  const switchRole = async (targetRole) => {
    const res = await authAPI.switchRole(targetRole);
    const { access_token, user: updatedUser } = res.data;
    localStorage.setItem('access_token', access_token);
    localStorage.setItem('user', JSON.stringify(updatedUser));
    setUser(updatedUser);
    return updatedUser;
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, switchRole }}>
      {children}
    </AuthContext.Provider>
  );
}

AuthProvider.propTypes = {
  children: PropTypes.node,
};

const useAuth = () => useContext(AuthContext);

// ── Navigation Bar ───────────────────────────────────────────────────────────
function Navbar({ cartCount, onOpenCart }) {
  const { user, logout, switchRole } = useAuth();
  const navigate = useNavigate();
  const [userMenuAnchor, setUserMenuAnchor] = useState(null);

  const handleLogout = async () => {
    try { await authAPI.logout(); } catch (_) { /* ignore */ }
    logout();
    navigate('/login');
  };

  const handleSwitchRole = async (targetRole) => {
    try {
      const updated = await switchRole(targetRole);
      if (updated.role === 'seller') {
        navigate('/seller/dashboard');
      } else {
        navigate('/buyer');
      }
    } catch (err) {
      console.error('Failed to switch role', err);
    }
  };

  return (
    <AppBar position="sticky" sx={{ background: 'rgba(22,22,34,0.95)', backdropFilter: 'blur(10px)' }}>
      <Toolbar>
        <RestaurantIcon sx={{ color: 'primary.main', mr: 1 }} />
        <Typography variant="h6" component={Link} to="/" sx={{ flexGrow: 1, textDecoration: 'none', color: 'inherit', fontWeight: 700 }}>
          Society Food
        </Typography>

        {user ? (
          <>
            {/* Seller Mode Navigation */}
            {user.role === 'seller' ? (
              <>
                <Button component={Link} to="/seller/dashboard" color="inherit" size="small" sx={{ mr: 1 }}>
                  Kitchen Hub
                </Button>
                <Button component={Link} to="/orders" color="inherit" size="small" sx={{ mr: 1 }}>
                  Orders
                </Button>
                <Button component={Link} to="/suggestions" color="inherit" size="small" sx={{ mr: 1, color: '#F6BD60' }} startIcon={<LocalFireDepartmentIcon />}>
                  Cravings
                </Button>
              </>
            ) : (
              /* Buyer Mode Navigation: Strictly Cravings, Orders, Cart */
              <>
                <Button component={Link} to="/suggestions" color="inherit" size="small" sx={{ mr: 1, color: '#F6BD60' }} startIcon={<LocalFireDepartmentIcon />}>
                  Cravings
                </Button>
                <Button component={Link} to="/orders" color="inherit" size="small" sx={{ mr: 1 }}>
                  Orders
                </Button>
              </>
            )}

            {/* Cart Icon */}
            <IconButton onClick={onOpenCart} sx={{ color: '#fff', mr: 1.5 }}>
              <Badge badgeContent={cartCount} color="primary">
                <ShoppingBagOutlinedIcon />
              </Badge>
            </IconButton>

            {/* Instant Role Persona Switcher Button */}
            <Button
              size="small"
              onClick={() => handleSwitchRole(user.role === 'seller' ? 'buyer' : 'seller')}
              sx={{
                mr: 1.5,
                textTransform: 'none',
                fontWeight: 'bold',
                bgcolor: user.role === 'seller' ? 'rgba(46,196,182,0.15)' : 'rgba(224,90,43,0.15)',
                color: user.role === 'seller' ? '#2EC4B6' : '#E05A2B',
                border: '1px solid',
                borderColor: user.role === 'seller' ? 'rgba(46,196,182,0.3)' : 'rgba(224,90,43,0.3)',
                '&:hover': {
                  bgcolor: user.role === 'seller' ? 'rgba(46,196,182,0.25)' : 'rgba(224,90,43,0.25)',
                },
              }}
            >
              {user.role === 'seller' ? '🛒 Switch to Buyer Mode' : '🍳 Switch to Chef Mode'}
            </Button>

            {/* User Info Chip with Interactive Popover */}
            <Chip
              avatar={
                <Avatar sx={{ bgcolor: user.role === 'seller' ? '#2EC4B6' : '#E05A2B', color: '#fff', fontWeight: 'bold' }}>
                  {user.name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || 'U'}
                </Avatar>
              }
              label={`${user.name || user.email?.split('@')[0]} (${user.role || 'buyer'})`}
              size="small"
              onClick={(e) => setUserMenuAnchor(e.currentTarget)}
              sx={{
                mr: 1.5,
                cursor: 'pointer',
                bgcolor: 'rgba(224,90,43,0.15)',
                color: 'primary.main',
                fontWeight: 'bold',
                '&:hover': { bgcolor: 'rgba(224,90,43,0.25)' },
              }}
            />

            {/* User Info Popover */}
            <Popover
              open={Boolean(userMenuAnchor)}
              anchorEl={userMenuAnchor}
              onClose={() => setUserMenuAnchor(null)}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
              PaperProps={{
                sx: {
                  p: 2.5,
                  width: 290,
                  bgcolor: '#191928',
                  color: '#fff',
                  borderRadius: 3,
                  border: '1px solid rgba(255,255,255,0.12)',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                },
              }}
            >
              <Box display="flex" alignItems="center" gap={1.5} mb={1.5}>
                <Avatar sx={{ bgcolor: user.role === 'seller' ? '#2EC4B6' : '#E05A2B', width: 44, height: 44, fontWeight: 'bold' }}>
                  {user.name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || 'U'}
                </Avatar>
                <Box sx={{ overflow: 'hidden' }}>
                  <Typography variant="subtitle1" fontWeight="bold" noWrap>
                    {user.name || 'Society Resident'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap display="block">
                    {user.email}
                  </Typography>
                </Box>
              </Box>

              <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', my: 1.5 }} />

              <Box display="flex" flexDirection="column" gap={1} mb={2}>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Typography variant="caption" color="text.secondary">Active Mode:</Typography>
                  <Chip
                    size="small"
                    label={user.role === 'seller' ? '🍳 Home Chef' : '🛒 Resident Buyer'}
                    sx={{
                      bgcolor: user.role === 'seller' ? 'rgba(46,196,182,0.15)' : 'rgba(224,90,43,0.15)',
                      color: user.role === 'seller' ? '#2EC4B6' : '#E05A2B',
                      fontWeight: 'bold',
                      fontSize: '0.75rem',
                    }}
                  />
                </Box>

                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Typography variant="caption" color="text.secondary">Flat / Unit:</Typography>
                  <Typography variant="caption" fontWeight="bold" color="#F6BD60">
                    {user.flat_number ? `Flat #${user.flat_number}` : 'Society Resident'}
                  </Typography>
                </Box>

                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Typography variant="caption" color="text.secondary">Status:</Typography>
                  <Chip
                    size="small"
                    label="✅ Verified Resident"
                    sx={{ bgcolor: 'rgba(46,196,182,0.15)', color: '#2EC4B6', fontSize: '0.7rem', height: 20 }}
                  />
                </Box>
              </Box>

              <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', mb: 2 }} />

              {/* Shortcut to the Profile */}
              <Button
                fullWidth
                variant="outlined"
                component={Link}
                to="/profile"
                onClick={() => setUserMenuAnchor(null)}
                size="small"
                sx={{ mb: 1, color: '#fff', borderColor: 'rgba(255,255,255,0.2)', textTransform: 'none', fontWeight: 'bold' }}
              >
                👤 View Full Profile
              </Button>

              <Button
                fullWidth
                variant="contained"
                color="error"
                size="small"
                onClick={() => {
                  setUserMenuAnchor(null);
                  handleLogout();
                }}
                sx={{ textTransform: 'none', fontWeight: 'bold' }}
              >
                Sign Out
              </Button>
            </Popover>

            <Button color="inherit" onClick={handleLogout} size="small">
              Logout
            </Button>
          </>
        ) : (
          <>
            <Button component={Link} to="/suggestions" color="inherit" size="small" sx={{ mr: 1, color: '#F6BD60' }} startIcon={<LocalFireDepartmentIcon />}>
              Cravings
            </Button>
            <Button color="primary" variant="outlined" component={Link} to="/login" size="small">
              Login
            </Button>
          </>
        )}
      </Toolbar>
    </AppBar>
  );
}


// ── Login Page ───────────────────────────────────────────────────────────────
function LoginPage() {
  const { login } = useAuth();

  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);

  const [tab, setTab] = useState(0); // 0: OTP Login, 1: Password Login, 2: Register
  const [otpStep, setOtpStep] = useState('email'); // 'email' | 'otp'
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState(params.get('role') || 'buyer');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  // ── 1. Passwordless OTP Authentication Flow ──────────────────────────────
  const handleRequestOTP = async (e) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    try {
      const res = await authAPI.requestOtp(email, role, 'email');
      const devOtp = res.data?.dev_otp;
      setInfo(
        devOtp
          ? `Verification code sent to ${email}! (Dev mode code: ${devOtp})`
          : `Verification code sent to ${email}. Please check your inbox.`
      );
      setOtpStep('otp');
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to send verification code. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authAPI.verifyOtp(email, otp, name, role);
      const { access_token, user: userData } = res.data;
      login(userData || { email, role }, access_token);
      const next = params.get('next') || (userData?.role === 'seller' ? '/seller/dashboard' : '/');
      const safeNext = next && next.startsWith('/') ? next : '/';
      navigate(safeNext);
    } catch (err) {
      setError(getErrorMessage(err, 'Invalid or expired code. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  // ── 2. Password Login Flow ───────────────────────────────────────────────
  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authAPI.login(email, password, role);
      const { access_token, user: userData } = res.data;
      login(userData || { email, role }, access_token);
      const next = params.get('next') || (userData?.role === 'seller' ? '/seller/dashboard' : '/');
      const safeNext = next && next.startsWith('/') ? next : '/';
      navigate(safeNext);
    } catch (err) {
      setError(getErrorMessage(err, 'Invalid email or password. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  // ── 3. Register Flow ─────────────────────────────────────────────────────
  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    try {
      await authAPI.register(email, password, name, role);
      const loginRes = await authAPI.login(email, password, role);
      const { access_token, user: userData } = loginRes.data;
      login(userData || { email, name, role }, access_token);
      const next = role === 'seller' ? '/seller/dashboard' : '/';
      navigate(next);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to create account. Please check your information.'));
    } finally {
      setLoading(false);
    }
  };


  return (
    <Box
      sx={{
        minHeight: '90vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(circle at 50% 30%, rgba(255,107,53,0.08), transparent 60%)',
        p: 2,
      }}
    >
      <Paper
        elevation={0}
        sx={{
          p: 4,
          maxWidth: 460,
          width: '100%',
          border: '1px solid rgba(255,107,53,0.2)',
          borderRadius: 3,
          bgcolor: '#191928',
          color: '#fff',
        }}
      >
        <Box sx={{ textAlign: 'center', mb: 2 }}>
          <RestaurantIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
          <Typography variant="h5" fontWeight="bold">
            {tab === 0 ? 'Instant Login' : tab === 1 ? 'Welcome Back' : 'Join Society Food'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {tab === 0
              ? 'Passwordless sign in with verification code'
              : tab === 1
              ? 'Sign in with your email & password'
              : 'Connect with home cooks and neighbors'}
          </Typography>
        </Box>

        {/* Tab Toggle */}
        <Box sx={{ borderBottom: 1, borderColor: 'rgba(255,255,255,0.1)', mb: 3 }}>
          <Tabs
            value={tab}
            onChange={(_, val) => {
              setTab(val);
              setOtpStep('email');
              setError('');
              setInfo('');
            }}
            variant="fullWidth"
            textColor="inherit"
            indicatorColor="primary"
          >
            <Tab label="✨ Instant OTP" sx={{ fontWeight: 'bold', textTransform: 'none' }} />
            <Tab label="🔑 Password" sx={{ fontWeight: 'bold', textTransform: 'none' }} />
            <Tab label="📝 Register" sx={{ fontWeight: 'bold', textTransform: 'none' }} />
          </Tabs>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {info && <Alert severity="info" sx={{ mb: 2 }}>{info}</Alert>}

        {tab === 0 ? (
          /* Instant OTP Flow */
          otpStep === 'email' ? (
            <Box component="form" onSubmit={handleRequestOTP}>
              <TextField
                label="Email Address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                fullWidth
                required
                sx={{ mb: 2 }}
                placeholder="you@example.com"
              />
              <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                I am signing in as:
              </Typography>
              <Box sx={{ mb: 3, display: 'flex', gap: 1.5 }}>
                {['buyer', 'seller'].map((r) => (
                  <Button
                    key={r}
                    variant={role === r ? 'contained' : 'outlined'}
                    color="primary"
                    onClick={() => setRole(r)}
                    sx={{ flex: 1, py: 1, fontWeight: 'bold' }}
                  >
                    {r === 'buyer' ? '🛒 Resident Buyer' : '🍳 Home Chef'}
                  </Button>
                ))}
              </Box>
              <Button
                type="submit"
                variant="contained"
                fullWidth
                size="large"
                disabled={loading}
                startIcon={loading ? <CircularProgress size={18} /> : null}
                sx={{ bgcolor: '#E05A2B', fontWeight: 'bold', '&:hover': { bgcolor: '#c9481c' } }}
              >
                {loading ? 'Sending Code...' : 'Send Verification Code'}
              </Button>
            </Box>
          ) : (
            <Box component="form" onSubmit={handleVerifyOTP}>
              <TextField
                label="6-Digit Verification Code"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                fullWidth
                required
                inputProps={{ maxLength: 6, style: { textAlign: 'center', letterSpacing: '6px', fontSize: '20px', fontWeight: 'bold' } }}
                placeholder="123456"
                sx={{ mb: 3 }}
              />
              <Button
                type="submit"
                variant="contained"
                fullWidth
                size="large"
                disabled={loading}
                startIcon={loading ? <CircularProgress size={18} /> : null}
                sx={{ bgcolor: '#E05A2B', fontWeight: 'bold', mb: 1.5, '&:hover': { bgcolor: '#c9481c' } }}
              >
                {loading ? 'Verifying...' : 'Verify Code & Sign In'}
              </Button>
              <Button
                variant="text"
                fullWidth
                onClick={() => {
                  setOtpStep('email');
                  setOtp('');
                  setError('');
                }}
                sx={{ color: 'text.secondary', textTransform: 'none' }}
              >
                ← Change Email or Resend
              </Button>
            </Box>
          )
        ) : tab === 1 ? (
          /* Password Login Form */
          <Box component="form" onSubmit={handlePasswordLogin}>
            <TextField
              label="Email Address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              fullWidth
              required
              sx={{ mb: 2 }}
              placeholder="you@example.com"
            />
            <TextField
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              fullWidth
              required
              sx={{ mb: 2 }}
              placeholder="••••••••"
            />
            <Typography variant="caption" color="text.secondary" display="block" mb={1}>
              Sign in as:
            </Typography>
            <Box sx={{ mb: 3, display: 'flex', gap: 1.5 }}>
              {['buyer', 'seller'].map((r) => (
                <Button
                  key={r}
                  variant={role === r ? 'contained' : 'outlined'}
                  color="primary"
                  onClick={() => setRole(r)}
                  sx={{ flex: 1, py: 1, fontWeight: 'bold' }}
                >
                  {r === 'buyer' ? '🛒 Resident Buyer' : '🍳 Home Chef'}
                </Button>
              ))}
            </Box>
            <Button
              type="submit"
              variant="contained"
              fullWidth
              size="large"
              disabled={loading}
              startIcon={loading ? <CircularProgress size={18} /> : null}
              sx={{ bgcolor: '#E05A2B', fontWeight: 'bold', '&:hover': { bgcolor: '#c9481c' } }}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>

          </Box>
        ) : (
          /* Create Account Form */
          <Box component="form" onSubmit={handleRegister}>
            <TextField
              label="Full Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              fullWidth
              required
              sx={{ mb: 2 }}
              placeholder="e.g. Meera Sharma"
            />
            <TextField
              label="Email Address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              fullWidth
              required
              sx={{ mb: 2 }}
              placeholder="you@example.com"
            />
            <TextField
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              fullWidth
              required
              helperText="Minimum 8 characters"
              sx={{ mb: 2 }}
              placeholder="••••••••"
            />
            <Typography variant="caption" color="text.secondary" display="block" mb={1}>
              I want to use Society Food as:
            </Typography>
            <Box sx={{ mb: 3, display: 'flex', gap: 1.5 }}>
              {['buyer', 'seller'].map((r) => (
                <Button
                  key={r}
                  variant={role === r ? 'contained' : 'outlined'}
                  color="primary"
                  onClick={() => setRole(r)}
                  sx={{ flex: 1, py: 1, fontWeight: 'bold' }}
                >
                  {r === 'buyer' ? '🛒 Resident Buyer' : '🍳 Home Chef'}
                </Button>
              ))}
            </Box>
            <Button
              type="submit"
              variant="contained"
              fullWidth
              size="large"
              disabled={loading}
              startIcon={loading ? <CircularProgress size={18} /> : null}
              sx={{ bgcolor: '#E05A2B', fontWeight: 'bold', '&:hover': { bgcolor: '#c9481c' } }}
            >
              {loading ? 'Creating Account...' : 'Create Account & Start'}
            </Button>
          </Box>
        )}
      </Paper>
    </Box>
  );
}



// ── Sellers Listing Page ─────────────────────────────────────────────────────
function SellersPage() {
  const location = useLocation();
  const initialSearch = new URLSearchParams(location.search).get('search') || '';
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const { user } = useAuth();

  // Fallback: some flows may not have context hydrated yet — read localStorage
  const currentUser = user || (() => {
    try {
      const raw = localStorage.getItem('user');
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  })();

  useEffect(() => {
    sellersAPI.list()
      .then((res) => {
        setSellers(res.data?.sellers || []);
      })
      .catch((err) => {
        setError(err.response?.data?.detail || 'Failed to load sellers.');
      })
      .finally(() => setLoading(false));
  }, []);

  const filteredSellers = sellers.filter((seller) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      seller.name?.toLowerCase().includes(q) ||
      seller.bio?.toLowerCase().includes(q) ||
      (seller.flat_number && String(seller.flat_number).toLowerCase().includes(q));

    let matchesFilter = true;
    if (selectedFilter === 'top_rated') {
      matchesFilter = (seller.rating || 0) >= 4.0;
    } else if (selectedFilter === 'punctual') {
      matchesFilter = (seller.on_time_delivery_rate ?? 100) >= 90;
    } else if (selectedFilter === 'open_now') {
      matchesFilter = seller.is_open !== false;
    }

    return matchesSearch && matchesFilter;
  });

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 4, textAlign: 'center' }}>
        <Typography variant="h4" fontWeight="bold" gutterBottom>
          🍽️ Society Home Chefs
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Discover verified home cooks, daily kitchens, and special weekend bakers in your community.
        </Typography>
      </Box>

      {/* Chef Search & Filter Toolbar */}
      <Box sx={{ mb: 4 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              placeholder="Search chef name, flat number, or special dishes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: 'rgba(255,255,255,0.5)' }} />
                  </InputAdornment>
                ),
                endAdornment: searchQuery ? (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setSearchQuery('')} sx={{ color: '#aaa' }}>
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ) : null,
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
          </Grid>

          <Grid item xs={12} md={6}>
            <Box display="flex" gap={1} flexWrap="wrap" justifyContent={{ xs: 'flex-start', md: 'flex-end' }}>
              {[
                { id: 'all', label: 'All Chefs' },
                { id: 'top_rated', label: '⭐ Top Rated' },
                { id: 'punctual', label: '⚡ High Punctuality' },
                { id: 'open_now', label: '🟢 Open Now' },
              ].map((f) => (
                <Chip
                  key={f.id}
                  label={f.label}
                  clickable
                  onClick={() => setSelectedFilter(f.id)}
                  sx={{
                    bgcolor: selectedFilter === f.id ? '#E05A2B' : '#191928',
                    color: '#fff',
                    fontWeight: selectedFilter === f.id ? 'bold' : 'normal',
                    border: '1px solid',
                    borderColor: selectedFilter === f.id ? '#E05A2B' : 'rgba(255,255,255,0.1)',
                    '&:hover': { bgcolor: selectedFilter === f.id ? '#c9481c' : '#252538' },
                  }}
                />
              ))}
            </Box>
          </Grid>
        </Grid>
      </Box>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress color="primary" />
        </Box>
      )}

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {!loading && !error && filteredSellers.length === 0 && (
        <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 3, bgcolor: '#191928', color: '#fff' }}>
          <StoreIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            {searchQuery || selectedFilter !== 'all'
              ? `No chefs found matching your search filter.`
              : 'No sellers yet in your society.'}
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            {searchQuery || selectedFilter !== 'all' ? (
              <Button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedFilter('all');
                }}
                sx={{ color: '#E05A2B', fontWeight: 'bold' }}
              >
                Clear Filters
              </Button>
            ) : (
              'Be the first to register as a chef in your residential building!'
            )}
          </Typography>
          {!searchQuery && selectedFilter === 'all' && (
            currentUser && currentUser.role === 'seller' ? (
              <Button variant="contained" component={Link} to="/seller/dashboard">
                Your Seller Dashboard
              </Button>
            ) : (
              <Button variant="contained" component={Link} to={`/login?role=seller&next=/seller/dashboard`}>
                Register as Seller
              </Button>
            )
          )}
        </Paper>
      )}

      <Grid container spacing={3}>
        {filteredSellers.map((seller) => (
          <Grid item xs={12} sm={6} md={4} key={seller.id}>
            <Card
              sx={{
                bgcolor: '#191928',
                borderRadius: 3,
                border: '1px solid rgba(255,255,255,0.08)',
                color: '#fff',
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                transition: 'transform 0.2s',
                '&:hover': { transform: 'translateY(-4px)' },
              }}
            >
              <CardContent sx={{ flexGrow: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Avatar sx={{ bgcolor: '#E05A2B', width: 50, height: 50, mr: 2, fontWeight: 'bold', fontSize: '1.2rem' }}>
                    {seller.name?.[0] || 'C'}
                  </Avatar>
                  <Box>
                    <Typography variant="h6" fontWeight="bold">{seller.name}</Typography>
                    <Box display="flex" gap={0.8} mt={0.5} flexWrap="wrap">
                      <Chip
                        label={`⭐ ${seller.rating?.toFixed(1) || 'New'}`}
                        size="small"
                        sx={{ bgcolor: 'rgba(246, 189, 96, 0.15)', color: '#F6BD60', fontWeight: 'bold' }}
                      />
                      {seller.flat_number && (
                        <Chip
                          label={`Flat ${seller.flat_number}`}
                          size="small"
                          sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: '#fff' }}
                        />
                      )}
                    </Box>
                  </Box>
                </Box>

                <Typography variant="body2" color="text.secondary" mb={2}>
                  {seller.bio || 'Authentic home cook preparing homemade fresh food for neighbors.'}
                </Typography>

                {/* Badges: Punctuality & Fulfillment */}
                <Box display="flex" gap={1} flexWrap="wrap">
                  <Chip
                    size="small"
                    label={`⚡ ${seller.on_time_delivery_rate ?? 100}% on-time`}
                    sx={{ bgcolor: 'rgba(46, 196, 182, 0.15)', color: '#2EC4B6', fontWeight: 'bold', fontSize: 11 }}
                  />
                  <Chip
                    size="small"
                    icon={<DeliveryDiningIcon sx={{ fontSize: '14px !important', color: '#fff !important' }} />}
                    label="Doorstep & Pickup"
                    sx={{ bgcolor: 'rgba(255,255,255,0.06)', color: '#ddd', fontSize: 11 }}
                  />
                </Box>
              </CardContent>

              <CardActions sx={{ px: 2, pb: 2, gap: 1 }}>
                <Button
                  size="small"
                  variant="outlined"
                  color="primary"
                  component={Link}
                  to={`/menu/${seller.id}`}
                  sx={{ textTransform: 'none', fontWeight: 'bold', flex: 1 }}
                >
                  View Menu
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  color="primary"
                  component={Link}
                  to={`/menu/${seller.id}`}
                  sx={{ bgcolor: '#E05A2B', textTransform: 'none', fontWeight: 'bold', flex: 1, '&:hover': { bgcolor: '#c9481c' } }}
                >
                  Order Now
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Container>
  );
}

// ── Home / Dashboard Page ────────────────────────────────────────────────────
function HomePage() {
  const { user } = useAuth();

  return (
    <Box
      sx={{
        minHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        px: 2,
        background: 'radial-gradient(circle at 50% 20%, rgba(255,107,53,0.07), transparent 55%)',
      }}
    >
      <RestaurantIcon sx={{ fontSize: 72, color: 'primary.main', mb: 2 }} />
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>
        Society Food Platform
      </Typography>
      <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
        Homemade food from your neighbours
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 4, maxWidth: 500 }}>
        Connect with home cooks in your residential society. Discover fresh,
        authentic meals and support your community.
      </Typography>
      <Divider sx={{ width: 60, mb: 4, borderColor: 'primary.main' }} />
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
        <Button
          variant="contained"
          size="large"
          component={Link}
          to="/sellers"
          startIcon={<StoreIcon />}
        >
          Browse Sellers
        </Button>
        {!user && (
          <Button
            variant="outlined"
            size="large"
            component={Link}
            to="/login"
          >
            Login / Register
          </Button>
        )}
      </Box>
    </Box>
  );
}

// ── Route Guard ───────────────────────────────────────────────────────────────
function PrivateRoute({ children, allowedRoles }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={user.role === 'seller' ? '/seller/dashboard' : '/buyer'} replace />;
  }

  return children;
}

PrivateRoute.propTypes = {
  children: PropTypes.node,
  allowedRoles: PropTypes.arrayOf(PropTypes.string),
};

// ── App Root ──────────────────────────────────────────────────────────────────
function AppContent() {
  const { user } = useAuth();
  const [cartOpen, setCartOpen] = useState(false);
  const [cartItems, setCartItems] = useState([]);
  const navigate = useNavigate();
  const location = useLocation();

  const handleAddToCart = (item, sellerId, sellerName, sellerFlat) => {
    setCartItems((prev) => {
      const existing = prev.find((it) => it.id === item.id);
      if (existing) {
        return prev.map((it) =>
          it.id === item.id ? { ...it, quantity: it.quantity + 1 } : it
        );
      }
      return [
        ...prev,
        {
          ...item,
          quantity: 1,
          sellerId: sellerId || item.sellerId || item.seller_id,
          sellerName: sellerName || item.sellerName || item.seller_name || 'Home Chef',
          sellerFlat: sellerFlat || item.sellerFlat || item.seller_flat || null,
        },
      ];
    });
    setCartOpen(true);
  };

  const handleUpdateQuantity = (itemId, newQty) => {
    if (newQty <= 0) {
      setCartItems((prev) => prev.filter((it) => it.id !== itemId));
    } else {
      setCartItems((prev) =>
        prev.map((it) => (it.id === itemId ? { ...it, quantity: newQty } : it))
      );
    }
  };

  const handleClearCart = () => {
    setCartItems([]);
  };

  const totalCartCount = cartItems.reduce((sum, it) => sum + it.quantity, 0);


  return (
    <>
      <Navbar cartCount={totalCartCount} onOpenCart={() => setCartOpen(true)} />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/sellers"
          element={
            <PrivateRoute>
              <SellersPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/menu/:sellerId"
          element={<MenuPage onAddToCart={handleAddToCart} />}
        />
        <Route
          path="/menus/:sellerId"
          element={<MenuPage onAddToCart={handleAddToCart} />}
        />

        <Route
          path="/suggestions"
          element={<SuggestionsBoard currentUser={user} />}
        />
        <Route path="/landing" element={<LandingPage />} />
        <Route
          path="/orders"
          element={
            <PrivateRoute>
              <OrdersPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <PrivateRoute>
              <ProfilePage />
            </PrivateRoute>
          }
        />
        <Route
          path="/buyer"
          element={
            <PrivateRoute>
              <BuyerDashboardPage currentUser={user} />
            </PrivateRoute>
          }
        />
        <Route
          path="/seller/dashboard"
          element={
            <PrivateRoute allowedRoles={['seller', 'admin']}>
              <SellerDashboardPage currentUser={user} />
            </PrivateRoute>
          }
        />
        <Route path="/seller-dashboard" element={<Navigate to="/seller/dashboard" replace />} />

        <Route
          path="/seller/dashboard/menus"
          element={
            <PrivateRoute allowedRoles={['seller', 'admin']}>
              <MenuPage onAddToCart={handleAddToCart} />
            </PrivateRoute>
          }
        />
        <Route
          path="/seller/dashboard/orders"
          element={
            <PrivateRoute allowedRoles={['seller', 'admin']}>
              <OrdersPage />
            </PrivateRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>


      {/* Global Slide-Out Multi-Chef Cart Drawer */}
      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        cartItems={cartItems}
        onUpdateQuantity={handleUpdateQuantity}
        onClearCart={handleClearCart}
        onOrderSuccess={() => {
          navigate('/orders');
        }}
      />

      {/* Mobile Bottom Navigation Bar (Modern Food App Inspiration) */}
      {user && (
        <>
          <Box sx={{ display: { xs: 'block', md: 'none' }, height: 68 }} />
          <Paper
            elevation={12}
            sx={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 1100,
              display: { xs: 'flex', md: 'none' },
              justifyContent: 'space-around',
              alignItems: 'center',
              py: 0.8,
              px: 1,
              bgcolor: 'rgba(24, 24, 40, 0.95)',
              backdropFilter: 'blur(16px)',
              borderTop: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <IconButton
              component={Link}
              to={user.role === 'seller' ? '/seller/dashboard' : '/buyer'}
              aria-label="Mobile Navigation Home"
              sx={{
                flexDirection: 'column',
                color: location.pathname === '/buyer' || location.pathname.startsWith('/seller') ? '#2EC4B6' : 'text.secondary',
                py: 0.5,
              }}
            >
              <HomeIcon fontSize="small" />
              <Typography variant="caption" sx={{ fontSize: '0.68rem', mt: 0.2, fontWeight: 600 }}>Home</Typography>
            </IconButton>

            <IconButton
              component={Link}
              to="/suggestions"
              aria-label="Mobile Navigation Cravings"
              sx={{
                flexDirection: 'column',
                color: location.pathname === '/suggestions' ? '#2EC4B6' : 'text.secondary',
                py: 0.5,
              }}
            >
              <LocalFireDepartmentIcon fontSize="small" />
              <Typography variant="caption" sx={{ fontSize: '0.68rem', mt: 0.2, fontWeight: 600 }}>Cravings</Typography>
            </IconButton>

            <IconButton
              component={Link}
              to="/orders"
              aria-label="Mobile Navigation Orders"
              sx={{
                flexDirection: 'column',
                color: location.pathname === '/orders' ? '#2EC4B6' : 'text.secondary',
                py: 0.5,
              }}
            >
              <DeliveryDiningIcon fontSize="small" />
              <Typography variant="caption" sx={{ fontSize: '0.68rem', mt: 0.2, fontWeight: 600 }}>Orders</Typography>
            </IconButton>

            <IconButton
              onClick={() => setCartOpen(true)}
              aria-label="Mobile Navigation Cart"
              sx={{
                flexDirection: 'column',
                color: 'text.secondary',
                py: 0.5,
              }}
            >
              <Badge badgeContent={cartItems.reduce((acc, item) => acc + item.quantity, 0)} color="error">
                <ShoppingBagOutlinedIcon fontSize="small" />
              </Badge>
              <Typography variant="caption" sx={{ fontSize: '0.68rem', mt: 0.2, fontWeight: 600 }}>Cart</Typography>
            </IconButton>

            <IconButton
              component={Link}
              to="/profile"
              aria-label="Mobile Navigation Profile"
              sx={{
                flexDirection: 'column',
                color: location.pathname === '/profile' ? '#2EC4B6' : 'text.secondary',
                py: 0.5,
              }}
            >
              <PersonOutlineIcon fontSize="small" />
              <Typography variant="caption" sx={{ fontSize: '0.68rem', mt: 0.2, fontWeight: 600 }}>Profile</Typography>
            </IconButton>
          </Paper>
        </>
      )}

      <Footer />

    </>
  );
}

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <Router>
          <AppContent />
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;

