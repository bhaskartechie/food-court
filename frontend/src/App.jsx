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
} from '@mui/material';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import StoreIcon from '@mui/icons-material/Store';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import ShoppingBagOutlinedIcon from '@mui/icons-material/ShoppingBagOutlined';
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

// ── Warm Culinary Theme ───────────────────────────────────────────────────────
const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#E05A2B' },       // Warm Terracotta
    secondary: { main: '#F6BD60' },     // Honey Saffron
    success: { main: '#2EC4B6' },       // Fresh Mint
    background: { default: '#12121A', paper: '#191928' },
  },
  typography: {
    fontFamily: '"Plus Jakarta Sans", "Inter", "Roboto", sans-serif',
    h4: { fontWeight: 700 },
    h5: { fontWeight: 600 },
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: { borderRadius: 16, border: '1px solid rgba(255,255,255,0.08)' },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 10, textTransform: 'none', fontWeight: 600 },
      },
    },
  },
});

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

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
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
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try { await authAPI.logout(); } catch (_) { /* ignore */ }
    logout();
    navigate('/login');
  };

  return (
    <AppBar position="sticky" sx={{ background: 'rgba(22,22,34,0.95)', backdropFilter: 'blur(10px)' }}>
      <Toolbar>
        <RestaurantIcon sx={{ color: 'primary.main', mr: 1 }} />
        <Typography variant="h6" component={Link} to="/" sx={{ flexGrow: 1, textDecoration: 'none', color: 'inherit', fontWeight: 700 }}>
          Society Food
        </Typography>

        <Button component={Link} to="/suggestions" color="inherit" size="small" sx={{ mr: 1, color: '#F6BD60' }} startIcon={<LocalFireDepartmentIcon />}>
          Cravings
        </Button>

        {user ? (
          <>
            {user.role === 'seller' || user.role === 'admin' ? (
              <Button component={Link} to="/seller/dashboard" color="inherit" size="small" sx={{ mr: 1 }}>
                Kitchen Hub
              </Button>
            ) : (
              <Button component={Link} to="/buyer" color="inherit" size="small" sx={{ mr: 1 }}>
                Dashboard
              </Button>
            )}
            <Button component={Link} to="/orders" color="inherit" size="small" sx={{ mr: 1 }}>
              Orders
            </Button>
            <IconButton onClick={onOpenCart} sx={{ color: '#fff', mr: 1.5 }}>
              <Badge badgeContent={cartCount} color="primary">
                <ShoppingBagOutlinedIcon />
              </Badge>
            </IconButton>
            <Chip
              label={`${user.name || user.email?.split('@')[0]} (${user.role || 'buyer'})`}
              size="small"
              sx={{ mr: 2, bgcolor: 'rgba(224,90,43,0.15)', color: 'primary.main', fontWeight: 'bold' }}
            />
            <Button color="inherit" onClick={handleLogout} size="small">
              Logout
            </Button>
          </>
        ) : (
          <Button color="primary" variant="outlined" component={Link} to="/login" size="small">
            Login
          </Button>
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
      const next = params.get('next') || (userData?.role === 'seller' ? '/seller-dashboard' : '/');
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
      const res = await authAPI.login(email, password);
      const { access_token, user: userData } = res.data;
      login(userData || { email, role }, access_token);
      const next = params.get('next') || (userData?.role === 'seller' ? '/seller-dashboard' : '/');
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
      const loginRes = await authAPI.login(email, password);
      const { access_token, user: userData } = loginRes.data;
      login(userData || { email, name, role }, access_token);
      const next = role === 'seller' ? '/seller-dashboard' : '/';
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
              sx={{ mb: 3 }}
              placeholder="••••••••"
            />
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
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
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

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 4, textAlign: 'center' }}>
        <Typography variant="h4" gutterBottom>
          🍽️ Available Home Cooks
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Fresh homemade food from your neighbours
        </Typography>
      </Box>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress color="primary" />
        </Box>
      )}

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {!loading && !error && sellers.length === 0 && (
        <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 3 }}>
          <StoreIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" gutterBottom>No sellers yet</Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            Be the first to register as a seller in your society!
          </Typography>
          {currentUser && currentUser.role === 'seller' ? (
            <Button variant="contained" component={Link} to="/seller/dashboard">
              Your Seller Dashboard
            </Button>
          ) : (
            <Button variant="contained" component={Link} to={`/login?role=seller&next=/seller/dashboard`}>
              Register as Seller
            </Button>
          )}
        </Paper>
      )}

      <Grid container spacing={3}>
        {sellers.map((seller) => (
          <Grid item xs={12} sm={6} md={4} key={seller.id}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Avatar sx={{ bgcolor: 'primary.main', mr: 2 }}>
                    {seller.name?.[0] || '?'}
                  </Avatar>
                  <Box>
                    <Typography variant="h6">{seller.name}</Typography>
                    <Chip
                      label={`⭐ ${seller.rating?.toFixed(1) || 'New'}`}
                      size="small"
                      color="secondary"
                      variant="outlined"
                    />
                  </Box>
                </Box>
                {seller.bio && (
                  <Typography variant="body2" color="text.secondary">
                    {seller.bio}
                  </Typography>
                )}
              </CardContent>
              <CardActions>
                <Button size="small" variant="outlined" color="primary">
                  View Menu
                </Button>
                <Button size="small" color="secondary">
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
function PrivateRoute({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  return user ? children : <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
}

PrivateRoute.propTypes = {
  children: PropTypes.node,
};

// ── App Root ──────────────────────────────────────────────────────────────────
function AppContent() {
  const { user } = useAuth();
  const [cartOpen, setCartOpen] = useState(false);
  const [cartItems, setCartItems] = useState([]);
  const [activeSellerId, setActiveSellerId] = useState(null);
  const [activeSellerName, setActiveSellerName] = useState(null);
  const navigate = useNavigate();

  const handleAddToCart = (item, sellerId, sellerName) => {
    // If switching sellers, reset basket
    if (activeSellerId && activeSellerId !== sellerId) {
      setCartItems([{ ...item, quantity: 1 }]);
    } else {
      setCartItems((prev) => {
        const existing = prev.find((it) => it.id === item.id);
        if (existing) {
          return prev.map((it) =>
            it.id === item.id ? { ...it, quantity: it.quantity + 1 } : it
          );
        }
        return [...prev, { ...item, quantity: 1 }];
      });
    }
    setActiveSellerId(sellerId);
    if (sellerName) setActiveSellerName(sellerName);
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
    setActiveSellerId(null);
    setActiveSellerName(null);
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
            <PrivateRoute>
              <SellerDashboardPage currentUser={user} />
            </PrivateRoute>
          }
        />
        <Route
          path="/seller/dashboard/menus"
          element={
            <PrivateRoute>
              <MenuPage onAddToCart={handleAddToCart} />
            </PrivateRoute>
          }
        />
        <Route
          path="/seller/dashboard/orders"
          element={
            <PrivateRoute>
              <OrdersPage />
            </PrivateRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* Global Slide-Out Cart Drawer */}
      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        cartItems={cartItems}
        onUpdateQuantity={handleUpdateQuantity}
        onClearCart={handleClearCart}
        sellerId={activeSellerId}
        sellerName={activeSellerName}
        onOrderSuccess={(newOrder) => {
          navigate('/orders');
        }}
      />
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

