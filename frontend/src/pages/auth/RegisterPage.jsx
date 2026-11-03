/**
 * Customer Registration Page.
 *
 * Route: /register
 * Fields: Full Name, Email, Password, Confirm Password, Terms Agreement.
 * Features: Password visibility toggles, dynamic password strength score,
 * client & server validation feedback, and verification dispatch.
 *
 * @module pages/auth/RegisterPage
 */

import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Check,
  X,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';

export function RegisterPage() {
  const { register, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Redirect if already logged in
  React.useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // Dynamic Password Validation Rules
  const passwordCriteria = useMemo(() => {
    return {
      length: password.length >= 12,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[^A-Za-z0-9]/.test(password),
    };
  }, [password]);

  const strengthScore = useMemo(() => {
    const passedCount = Object.values(passwordCriteria).filter(Boolean).length;
    return passedCount; // 0 to 5
  }, [passwordCriteria]);

  const strengthLabel = useMemo(() => {
    if (strengthScore <= 1) return { label: 'Very Weak', color: 'bg-red-500', text: 'text-red-500' };
    if (strengthScore === 2) return { label: 'Weak', color: 'bg-orange-500', text: 'text-orange-500' };
    if (strengthScore === 3) return { label: 'Medium', color: 'bg-yellow-500', text: 'text-yellow-600' };
    if (strengthScore === 4) return { label: 'Strong', color: 'bg-emerald-500', text: 'text-emerald-600' };
    return { label: 'Excellent', color: 'bg-brand', text: 'text-brand' };
  }, [strengthScore]);

  const passwordsMatch = password && confirmPassword && password === confirmPassword;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 12) {
      setError('Password must contain at least 12 characters.');
      return;
    }

    if (strengthScore < 4) {
      setError('Password must include uppercase, lowercase, numbers, and special characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (!acceptTerms) {
      setError('You must accept the Terms & Conditions and Privacy Policy.');
      return;
    }

    setLoading(true);

    try {
      const regRes = await register({
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
        confirmPassword,
        acceptTerms: Boolean(acceptTerms),
      });

      // If account is already verified (e.g. SMTP unconfigured), proceed directly to login
      if (regRes?.isEmailVerified) {
        navigate('/login', {
          replace: true,
          state: { successMsg: 'Account created successfully! You can now sign in.' },
        });
      } else {
        // Redirect to verification pending screen
        navigate(`/verify-email-pending?email=${encodeURIComponent(email.trim().toLowerCase())}`, {
          replace: true,
        });
      }
    } catch (err) {
      setError(err.message || 'Failed to create account. Please check your information.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-primary-bg">
      <div className="w-full max-w-lg bg-surface border border-border-neutral rounded-2xl shadow-sm p-6 sm:p-8">
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
            Create Your Account
          </h1>
          <p className="text-xs text-text-muted mt-1.5">
            Join Khushboo Food Service for fresh, pure groceries delivered to your door.
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-5 p-3.5 bg-status-error/10 border border-status-error/20 rounded-xl flex items-start gap-2.5 text-xs text-status-error">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Full Name */}
          <div>
            <label className="block text-xs font-semibold text-text-main mb-1.5">
              Full Name
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-text-muted absolute left-3.5 top-3.5" />
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ramesh Sharma"
                required
                autoComplete="name"
                className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-surface-subtle border border-border-neutral rounded-xl text-text-main focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition placeholder:text-text-muted shadow-2xs"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-semibold text-text-main mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-text-muted absolute left-3.5 top-3.5" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ramesh@example.com"
                required
                autoComplete="email"
                className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-surface-subtle border border-border-neutral rounded-xl text-text-main focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition placeholder:text-text-muted shadow-2xs"
              />
            </div>
            <p className="text-[11px] text-text-muted mt-1">
              We'll send an activation link to verify this email address.
            </p>
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
            {password.length > 0 && (
              <div className="mt-2.5 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-text-muted text-[11px]">Password strength:</span>
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

                {/* Criteria checklist */}
                <div className="grid grid-cols-2 gap-1 text-[11px] text-text-muted pt-1">
                  <div className={`flex items-center gap-1.5 ${passwordCriteria.length ? 'text-brand' : ''}`}>
                    {passwordCriteria.length ? <Check className="w-3.5 h-3.5 shrink-0" /> : <X className="w-3.5 h-3.5 shrink-0 opacity-40" />}
                    <span>12+ characters</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${passwordCriteria.uppercase ? 'text-brand' : ''}`}>
                    {passwordCriteria.uppercase ? <Check className="w-3.5 h-3.5 shrink-0" /> : <X className="w-3.5 h-3.5 shrink-0 opacity-40" />}
                    <span>Uppercase letter</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${passwordCriteria.lowercase ? 'text-brand' : ''}`}>
                    {passwordCriteria.lowercase ? <Check className="w-3.5 h-3.5 shrink-0" /> : <X className="w-3.5 h-3.5 shrink-0 opacity-40" />}
                    <span>Lowercase letter</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${passwordCriteria.number ? 'text-brand' : ''}`}>
                    {passwordCriteria.number ? <Check className="w-3.5 h-3.5 shrink-0" /> : <X className="w-3.5 h-3.5 shrink-0 opacity-40" />}
                    <span>Number</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${passwordCriteria.special ? 'text-brand' : ''}`}>
                    {passwordCriteria.special ? <Check className="w-3.5 h-3.5 shrink-0" /> : <X className="w-3.5 h-3.5 shrink-0 opacity-40" />}
                    <span>Special character</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-xs font-semibold text-text-main mb-1.5">
              Confirm Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-text-muted absolute left-3.5 top-3.5" />
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••••••"
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

          {/* Terms Agreement */}
          <div className="pt-2">
            <label className="flex items-start gap-2.5 cursor-pointer text-xs text-text-main select-none">
              <input
                type="checkbox"
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-border-neutral text-brand focus:ring-brand accent-brand cursor-pointer shrink-0"
              />
              <span className="leading-snug">
                I agree to the{' '}
                <Link
                  to="/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand font-bold underline hover:text-brand-hover"
                >
                  Terms & Conditions
                </Link>{' '}
                and have read the{' '}
                <Link
                  to="/privacy-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand font-bold underline hover:text-brand-hover"
                >
                  Privacy Policy
                </Link>
                . <span className="text-status-error font-bold">*</span>
              </span>
            </label>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={
              loading ||
              !fullName.trim() ||
              !email.trim() ||
              strengthScore < 4 ||
              !passwordsMatch ||
              !acceptTerms
            }
            className="w-full py-3 px-4 bg-brand hover:bg-brand-hover text-white font-semibold text-sm rounded-xl shadow-xs transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer mt-4"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Creating Account...</span>
              </>
            ) : (
              <>
                <span>Create Khushboo Account</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Alternate Links */}
        <div className="mt-6 pt-5 border-t border-border-neutral text-center text-xs text-text-muted">
          Already have an account?{' '}
          <Link to="/login" className="text-brand font-semibold hover:underline">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}

export default RegisterPage;
