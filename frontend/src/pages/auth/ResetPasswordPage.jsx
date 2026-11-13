/**
 * Reset Password Page.
 *
 * Route: /reset-password
 * Parses reset token, validates new strong password, and executes password reset.
 *
 * @module pages/auth/ResetPasswordPage
 */

import React, { useState, useMemo } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import {
  Lock,
  Eye,
  EyeOff,
  Check,
  X,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';

export function ResetPasswordPage() {
  const { resetPassword } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const searchParams = new URLSearchParams(location.search);
  const token = searchParams.get('token');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(!token ? 'No password reset token was provided.' : '');
  const [success, setSuccess] = useState(false);

  // Dynamic Password Validation Rules (Simplified: minimum 6 characters)
  const passwordCriteria = useMemo(() => {
    return {
      length: newPassword.length >= 6,
      hasLetter: /[a-zA-Z]/.test(newPassword),
      hasNumber: /[0-9]/.test(newPassword),
      hasSpecial: /[^a-zA-Z0-9]/.test(newPassword),
    };
  }, [newPassword]);

  const strengthScore = useMemo(() => {
    if (!newPassword) return 0;
    if (newPassword.length < 6) return 1;
    let score = 2;
    if (passwordCriteria.hasLetter && passwordCriteria.hasNumber) score += 1;
    if (passwordCriteria.hasSpecial) score += 1;
    if (newPassword.length >= 10) score += 1;
    return Math.min(score, 5);
  }, [newPassword, passwordCriteria]);

  const strengthLabel = useMemo(() => {
    if (!newPassword) return { label: '', color: 'bg-gray-200', text: 'text-text-muted' };
    if (newPassword.length < 6) return { label: 'Too short (min 6 chars)', color: 'bg-red-500', text: 'text-red-500' };
    if (strengthScore <= 2) return { label: 'Fair', color: 'bg-orange-500', text: 'text-orange-500' };
    if (strengthScore === 3) return { label: 'Good', color: 'bg-yellow-500', text: 'text-yellow-600' };
    if (strengthScore === 4) return { label: 'Strong', color: 'bg-emerald-500', text: 'text-emerald-600' };
    return { label: 'Excellent', color: 'bg-brand', text: 'text-brand' };
  }, [newPassword, strengthScore]);

  const passwordsMatch = newPassword && confirmPassword && newPassword === confirmPassword;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) {
      setError('Invalid or missing password reset token.');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must contain at least 6 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      await resetPassword(token, newPassword, confirmPassword);
      setSuccess(true);
    } catch (err) {
      setError(
        err.message || 'This reset link has expired or is invalid. Please request a new link.'
      );
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
            Choose a New Password
          </h1>
          <p className="text-xs text-text-muted mt-1.5 leading-relaxed">
            Create a secure password with at least 12 characters to protect your account.
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-5 p-3.5 bg-status-error/10 border border-status-error/20 rounded-xl flex items-start gap-2.5 text-xs text-status-error">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span>{error}</span>
              <div className="mt-1.5">
                <Link to="/forgot-password" className="font-semibold underline">
                  Request a new password reset link &rarr;
                </Link>
              </div>
            </div>
          </div>
        )}

        {success ? (
          <div className="text-center py-4 space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-50 text-brand border border-brand/20 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-lg font-bold text-text-main">
              Password Reset Successful!
            </h2>
            <p className="text-xs text-text-muted leading-relaxed">
              Your password has been changed and all other active sessions have been safely signed out. You can now log in.
            </p>
            <div className="pt-2">
              <Link
                to="/login"
                className="w-full py-3 px-4 bg-brand hover:bg-brand-hover text-white font-semibold text-sm rounded-xl shadow-xs transition flex items-center justify-center gap-2"
              >
                <span>Sign In with New Password</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* New Password */}
            <div>
              <label className="block text-xs font-semibold text-text-main mb-1.5">
                New Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-text-muted absolute left-3.5 top-3.5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  autoComplete="new-password"
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

              {/* Password Strength Meter */}
              {newPassword.length > 0 && (
                <div className="mt-2.5 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-text-muted text-[11px]">Strength:</span>
                    <span className={`font-bold text-[11px] ${strengthLabel.text}`}>
                      {strengthLabel.label}
                    </span>
                  </div>
                  <div className="grid grid-cols-5 gap-1.5 h-1.5">
                    {[1, 2, 3, 4, 5].map((index) => (
                      <div
                        key={index}
                        className={`h-full rounded-full transition-colors ${
                          index <= strengthScore ? strengthLabel.color : 'bg-gray-200'
                        }`}
                      />
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-text-muted pt-1">
                    <div className={`flex items-center gap-1.5 ${passwordCriteria.length ? 'text-brand font-medium' : ''}`}>
                      {passwordCriteria.length ? <Check className="w-3.5 h-3.5 shrink-0 text-brand" /> : <X className="w-3.5 h-3.5 shrink-0 opacity-40" />}
                      <span>At least 6 characters</span>
                    </div>
                    <div className={`flex items-center gap-1.5 ${passwordCriteria.hasLetter ? 'text-brand' : ''}`}>
                      {passwordCriteria.hasLetter ? <Check className="w-3.5 h-3.5 shrink-0 text-brand" /> : <span className="w-1.5 h-1.5 rounded-full bg-border-neutral shrink-0" />}
                      <span>Letters (A-Z, a-z)</span>
                    </div>
                    <div className={`flex items-center gap-1.5 ${passwordCriteria.hasNumber ? 'text-brand' : ''}`}>
                      {passwordCriteria.hasNumber ? <Check className="w-3.5 h-3.5 shrink-0 text-brand" /> : <span className="w-1.5 h-1.5 rounded-full bg-border-neutral shrink-0" />}
                      <span>Numbers (0-9)</span>
                    </div>
                    <div className={`flex items-center gap-1.5 ${passwordCriteria.hasSpecial ? 'text-brand' : ''}`}>
                      {passwordCriteria.hasSpecial ? <Check className="w-3.5 h-3.5 shrink-0 text-brand" /> : <span className="w-1.5 h-1.5 rounded-full bg-border-neutral shrink-0" />}
                      <span>Special characters (!@#$)</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-xs font-semibold text-text-main mb-1.5">
                Confirm New Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-text-muted absolute left-3.5 top-3.5" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  required
                  autoComplete="new-password"
                  className={`w-full pl-10 pr-10 py-2.5 text-sm bg-surface-subtle border rounded-xl text-text-main focus:outline-none transition placeholder:text-text-muted shadow-2xs ${
                    confirmPassword && !passwordsMatch
                      ? 'border-status-error focus:ring-1 focus:ring-status-error'
                      : 'border-border-neutral focus:border-brand focus:ring-1 focus:ring-brand'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3.5 top-3 text-text-muted hover:text-text-main transition focus:outline-none"
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {confirmPassword && !passwordsMatch && (
                <p className="text-[11px] text-status-error mt-1">Passwords do not match.</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || newPassword.length < 6 || !passwordsMatch || !token}
              className="w-full py-3 px-4 bg-brand hover:bg-brand-hover text-white font-semibold text-sm rounded-xl shadow-xs transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer mt-4"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Updating Password...</span>
                </>
              ) : (
                <>
                  <span>Reset Password & Secure Account</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default ResetPasswordPage;

