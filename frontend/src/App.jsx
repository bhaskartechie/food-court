import React, { useState, useEffect, createContext, useContext } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useNavigate,
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
} from '@mui/material';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import StoreIcon from '@mui/icons-material/Store';
import { authAPI, sellersAPI } from './services/api';

// ── MUI Dark Theme ──────────────────────────────────────────────────────────
const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#FF6B35' },
    secondary: { main: '#FFD166' },
    background: { default: '#0f0f1a', paper: '#1a1a2e' },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h4: { fontWeight: 700 },
    h5: { fontWeight: 600 },
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: { borderRadius: 12, border: '1px solid rgba(255,107,53,0.15)' },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 8, textTransform: 'none', fontWeight: 600 },
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

const useAuth = () => useContext(AuthContext);

// ── Navigation Bar ───────────────────────────────────────────────────────────
function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try { await authAPI.logout(); } catch (_) { /* ignore */ }
    logout();
    navigate('/login');
  };

  return (
    <AppBar position="sticky" sx={{ background: 'rgba(26,26,46,0.95)', backdropFilter: 'blur(10px)' }}>
      <Toolbar>
        <RestaurantIcon sx={{ color: 'primary.main', mr: 1 }} />
        <Typography variant="h6" component={Link} to="/" sx={{ flexGrow: 1, textDecoration: 'none', color: 'inherit', fontWeight: 700 }}>
          Society Food
        </Typography>
        {user ? (
          <>
            <Chip
              label={`${user.email || 'User'} · ${user.role || 'buyer'}`}
              size="small"
              sx={{ mr: 2, bgcolor: 'rgba(255,107,53,0.15)', color: 'primary.main' }}
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

  const [step, setStep] = useState('email'); // 'email' | 'otp'
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [role, setRole] = useState('buyer');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const handleRequestOTP = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authAPI.register(email, role);
      // Dev mode: OTP may be returned in response for easy testing
      const devOtp = res.data?.dev_otp;
      setInfo(
        devOtp
          ? `OTP sent! (Dev mode: your OTP is ${devOtp})`
          : 'OTP sent to your email. Check your inbox.'
      );
      setStep('otp');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authAPI.login(email, otp);
      const { access_token, user: userData } = res.data;
      login(userData || { email, role }, access_token);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid OTP. Please try again.');
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
      }}
    >
      <Paper elevation={0} sx={{ p: 4, maxWidth: 420, width: '100%', border: '1px solid rgba(255,107,53,0.2)', borderRadius: 3 }}>
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <RestaurantIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
          <Typography variant="h5" gutterBottom>Welcome Back</Typography>
          <Typography variant="body2" color="text.secondary">
            {step === 'email' ? 'Enter your email to get started' : `Enter the OTP sent to ${email}`}
          </Typography>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {info && <Alert severity="info" sx={{ mb: 2 }}>{info}</Alert>}

        {step === 'email' ? (
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
            <Box sx={{ mb: 2, display: 'flex', gap: 1 }}>
              {['buyer', 'seller'].map((r) => (
                <Button
                  key={r}
                  variant={role === r ? 'contained' : 'outlined'}
                  color="primary"
                  onClick={() => setRole(r)}
                  sx={{ flex: 1 }}
                  size="small"
                >
                  {r === 'buyer' ? '🛒 Buyer' : '🍳 Seller'}
                </Button>
              ))}
            </Box>
            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={loading}
              startIcon={loading ? <CircularProgress size={18} /> : null}
            >
              {loading ? 'Sending OTP...' : 'Send OTP'}
            </Button>
          </Box>
        ) : (
          <Box component="form" onSubmit={handleVerifyOTP}>
            <TextField
              label="6-digit OTP"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              fullWidth
              required
              sx={{ mb: 2 }}
              inputProps={{ maxLength: 6 }}
              placeholder="123456"
            />
            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={loading}
              startIcon={loading ? <CircularProgress size={18} /> : null}
              sx={{ mb: 1 }}
            >
              {loading ? 'Verifying...' : 'Verify OTP & Login'}
            </Button>
            <Button variant="text" fullWidth onClick={() => { setStep('email'); setInfo(''); setError(''); }}>
              ← Back
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
          <Button variant="contained" component={Link} to="/login">
            Register as Seller
          </Button>
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
  return user ? children : <Navigate to="/login" replace />;
}

// ── App Root ──────────────────────────────────────────────────────────────────
function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <Router>
          <Navbar />
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
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
