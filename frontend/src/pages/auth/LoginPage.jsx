/**
 * Customer & Admin Login Page.
 *
 * Route: /login
 * Supports logging in with Email Address OR Username + Password,
 * with remember-me, password visibility toggle, forgot password link,
 * and quick links to registration and legacy account claiming.
 *
 * @module pages/auth/LoginPage
 */

import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail, AlertCircle, ArrowRight, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';

export function LoginPage() {
  const { login, isAuthenticated, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(location.state?.error || '');
  const [isUnverified, setIsUnverified] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState('');

  // Redirect if already authenticated
  React.useEffect(() => {
    if (isAuthenticated) {
      if (isAdmin) {
        navigate('/admin/dashboard', { replace: true });
      } else {
        const from = location.state?.from?.pathname || '/';
        navigate(from, { replace: true });
      }
    }
  }, [isAuthenticated, isAdmin, navigate, location.state]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsUnverified(false);
    setLoading(true);

    try {
      await login(identifier, password, rememberMe);
      const from = location.state?.from?.pathname || '/';
      navigate(from, { replace: true });
    } catch (err) {
      const msg = err.message || 'Invalid credentials. Please try again.';
      setError(msg);

      if (msg.toLowerCase().includes('not yet verified') || msg.toLowerCase().includes('verify your email')) {
        setIsUnverified(true);
        if (identifier.includes('@')) {
          setUnverifiedEmail(identifier);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-primary-bg">
      <div className="w-full max-w-md bg-surface border border-border-neutral rounded-2xl shadow-sm p-6 sm:p-8">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-block mb-3">
            <img
              src="/websiteLogo.png"
              alt="Khushboo Food Service"
              className="w-14 h-14 mx-auto rounded-2xl object-contain shadow-xs border border-border-neutral/60 bg-surface"
            />
          </Link>
          <h1 className="text-2xl font-bold font-heading text-text-main tracking-tight">
            Sign In to Your Account
          </h1>
          <p className="text-xs text-text-muted mt-1.5">
            Welcome back! Enter your email address to continue.
          </p>
        </div>

        {/* Success Alert */}
        {location.state?.successMsg && !error && (
          <div className="mb-5 p-3.5 bg-status-success/10 border border-status-success/20 rounded-xl flex items-start gap-2.5 text-xs text-status-success">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{location.state.successMsg}</span>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="mb-5 p-3.5 bg-status-error/10 border border-status-error/20 rounded-xl flex items-start gap-2.5 text-xs text-status-error">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span>{error}</span>
              {isUnverified && unverifiedEmail && (
                <div className="mt-2">
                  <Link
                    to={`/verify-email-pending?email=${encodeURIComponent(unverifiedEmail)}`}
                    className="font-semibold underline hover:text-status-error/80"
                  >
                    Resend verification link &rarr;
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email Address */}
          <div>
            <label className="block text-xs font-semibold text-text-main mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-text-muted absolute left-3.5 top-3.5" />
              <input
                type="email"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
                className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-surface-subtle border border-border-neutral rounded-xl text-text-main focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition placeholder:text-text-muted shadow-2xs"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-semibold text-text-main mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-text-muted absolute left-3.5 top-3.5" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                autoComplete="current-password"
                className="w-full pl-10 pr-10 py-2.5 text-sm bg-surface-subtle border border-border-neutral rounded-xl text-text-main focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition placeholder:text-text-muted shadow-2xs"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-3 text-text-muted hover:text-text-main transition focus:outline-none"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Remember Me */}
          <div className="flex items-center">
            <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-text-main">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-border-neutral text-brand focus:ring-brand accent-brand cursor-pointer"
              />
              <span>Remember me on this device</span>
            </label>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || !identifier.trim() || !password}
            className="w-full py-3 px-4 bg-brand hover:bg-brand-hover text-white font-semibold text-sm rounded-xl shadow-xs transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer mt-2"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Signing In...</span>
              </>
            ) : (
              <>
                <span>Sign In</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Alternate Links */}
        <div className="mt-6 pt-5 border-t border-border-neutral text-center text-xs text-text-muted">
          <div>
            Don't have an account?{' '}
            <Link to="/register" className="text-brand font-semibold hover:underline">
              Create an account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
