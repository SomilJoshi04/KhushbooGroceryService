/**
 * Authentication Modal Component.
 *
 * Supports Customer Login (Email Address OR Username + Password)
 * and Store Administrator Portal login.
 * Styled with light ivory & white surfaces, deep forest green primary buttons,
 * and charcoal typography.
 *
 * @module components/AuthModal
 */

import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  X,
  User,
  Lock,
  Mail,
  Eye,
  EyeOff,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export function AuthModal({ isOpen, onClose }) {
  const { login, adminLogin } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState('customer'); // 'customer' | 'admin'

  // Customer state
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Admin state
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isUnverified, setIsUnverified] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState('');

  // Reset state on open/close
  useEffect(() => {
    if (!isOpen) {
      setError('');
      setSuccessMsg('');
      setIdentifier('');
      setPassword('');
      setIsUnverified(false);
      setUnverifiedEmail('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCustomerLogin = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setIsUnverified(false);
    setLoading(true);

    try {
      await login(identifier, password, rememberMe);
      onClose();
      navigate('/');
    } catch (err) {
      const msg = err.message || 'Invalid email/username or password.';
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

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await adminLogin(adminEmail, adminPassword);
      onClose();
      navigate('/admin/dashboard', { replace: true });
    } catch (err) {
      setError(err.message || 'Invalid administrator email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-md bg-surface border border-border-neutral rounded-2xl shadow-xl p-6 sm:p-8 text-text-main overflow-hidden">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full text-text-muted hover:text-text-main hover:bg-surface-subtle transition cursor-pointer"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Brand Header */}
        <div className="flex items-center gap-3 mb-5 pr-8">
          <img
            src="/websiteLogo.png"
            alt="Khushboo Grocery Service Logo"
            className="w-11 h-11 rounded-xl object-contain shadow-xs border border-border-neutral/60 bg-surface"
          />
          <div>
            <h3 className="font-heading font-extrabold text-base text-text-main leading-tight">
              Khushboo <span className="text-brand">Grocery Service</span>
            </h3>
            <p className="text-[11px] text-text-muted">Pure & Fresh Daily Essentials</p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-surface-subtle p-1 rounded-xl mb-6 border border-border-neutral text-xs font-semibold">
          <button
            type="button"
            onClick={() => {
              setMode('customer');
              setError('');
              setSuccessMsg('');
            }}
            className={`flex-1 py-2 rounded-lg transition ${
              mode === 'customer'
                ? 'bg-brand text-white shadow-xs font-semibold'
                : 'text-text-muted hover:text-text-main'
            }`}
          >
            Customer Login
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('admin');
              setError('');
              setSuccessMsg('');
            }}
            className={`flex-1 py-2 rounded-lg transition ${
              mode === 'admin'
                ? 'bg-brand text-white shadow-xs font-semibold'
                : 'text-text-muted hover:text-text-main'
            }`}
          >
            Store Admin Portal
          </button>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-4 p-3 bg-status-error/10 border border-status-error/20 rounded-xl flex items-start gap-2.5 text-xs text-status-error">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span>{error}</span>
              {isUnverified && unverifiedEmail && (
                <div className="mt-1.5">
                  <Link
                    to={`/verify-email-pending?email=${encodeURIComponent(unverifiedEmail)}`}
                    onClick={onClose}
                    className="font-bold underline"
                  >
                    Resend verification email &rarr;
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 bg-status-success/10 border border-status-success/20 rounded-xl flex items-start gap-2.5 text-xs text-status-success">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* ── Mode 1: Customer Login ──────────────────────────────────────── */}
        {mode === 'customer' && (
          <div>
            <div className="text-center mb-5">
              <h2 className="text-xl font-bold font-heading text-text-main">Welcome Back</h2>
              <p className="text-xs text-text-muted mt-1">
                Enter your email address to sign in.
              </p>
            </div>

            <form onSubmit={handleCustomerLogin} className="space-y-4">
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
                    className="absolute right-3.5 top-3 text-text-muted hover:text-text-main"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center">
                <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-text-main">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-border-neutral text-brand focus:ring-brand accent-brand cursor-pointer"
                  />
                  <span>Remember me</span>
                </label>
              </div>

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

            <div className="mt-5 pt-4 border-t border-border-neutral text-center text-xs text-text-muted">
              <div>
                Don't have an account?{' '}
                <Link
                  to="/register"
                  onClick={onClose}
                  className="text-brand font-bold hover:underline"
                >
                  Create one now
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* ── Mode 2: Store Admin Portal ──────────────────────────────────── */}
        {mode === 'admin' && (
          <div>
            <div className="text-center mb-5">
              <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-brand-light text-brand border border-brand/20 flex items-center justify-center">
                <Lock className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold font-heading text-text-main">Store Administration</h2>
              <p className="text-xs text-text-muted mt-1">
                Authorized staff and managers only.
              </p>
            </div>

            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-main mb-1.5">
                  Admin Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-text-muted absolute left-3.5 top-3.5" />
                  <input
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="admin@example.com"
                    required
                    autoComplete="email"
                    className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-surface-subtle border border-border-neutral rounded-xl text-text-main focus:outline-none focus:border-brand shadow-2xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-main mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-text-muted absolute left-3.5 top-3.5" />
                  <input
                    type={showAdminPassword ? 'text' : 'password'}
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="••••••••••••"
                    required
                    autoComplete="current-password"
                    className="w-full pl-10 pr-10 py-2.5 text-sm bg-surface-subtle border border-border-neutral rounded-xl text-text-main focus:outline-none focus:border-brand shadow-2xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAdminPassword(!showAdminPassword)}
                    className="absolute right-3.5 top-3 text-text-muted hover:text-text-main"
                  >
                    {showAdminPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !adminEmail || !adminPassword}
                className="w-full py-3 px-4 bg-brand hover:bg-brand-hover text-white font-semibold text-sm rounded-xl shadow-xs transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Signing In...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In to Admin Portal</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

export default AuthModal;
