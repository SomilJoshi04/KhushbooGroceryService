/**
 * Email Verification Pending Page.
 *
 * Route: /verify-email-pending
 * Informs the newly registered user to verify their email,
 * and provides a resend verification feature with cooldown timer.
 *
 * @module pages/auth/VerifyEmailPendingPage
 */

import React, { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Mail, CheckCircle2, AlertCircle, RefreshCw, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';

export function VerifyEmailPendingPage() {
  const { resendVerification } = useAuth();
  const location = useLocation();

  const queryParams = new URLSearchParams(location.search);
  const initialEmail = queryParams.get('email') || location.state?.email || '';

  const [email, setEmail] = useState(initialEmail);
  const [cooldown, setCooldown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Cooldown countdown
  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  const handleResend = async (e) => {
    e.preventDefault();
    if (!email || cooldown > 0) return;

    setError('');
    setMessage('');
    setLoading(true);

    try {
      const res = await resendVerification(email.trim().toLowerCase());
      setMessage(res.message || 'Verification link sent! Please check your inbox and spam folders.');
      setCooldown(60); // 60 seconds cooldown
    } catch (err) {
      setError(err.message || 'Failed to resend verification email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-primary-bg">
      <div className="w-full max-w-md bg-surface border border-border-neutral rounded-2xl shadow-sm p-6 sm:p-8 text-center">
        {/* Animated Mail Icon */}
        <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-brand-light text-brand border border-brand/20 flex items-center justify-center">
          <Mail className="w-8 h-8" />
        </div>

        <h1 className="text-2xl font-bold font-heading text-text-main tracking-tight">
          Verify Your Email
        </h1>

        <p className="text-xs sm:text-sm text-text-muted mt-2 leading-relaxed">
          We have sent an activation link to{' '}
          {email ? (
            <span className="font-semibold text-text-main underline decoration-brand">{email}</span>
          ) : (
            'your registered email address'
          )}
          . Please click the link to activate your account.
        </p>

        <div className="my-6 p-4 bg-surface-subtle border border-border-neutral rounded-xl text-left text-xs text-text-muted space-y-2">
          <div className="flex items-start gap-2">
            <span className="text-brand font-bold">1.</span>
            <span>The link is valid for <strong>30 minutes</strong>.</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-brand font-bold">2.</span>
            <span>If you don't see it in your inbox, please check your <strong>Spam</strong> or <strong>Promotions</strong> folder.</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-brand font-bold">3.</span>
            <span>Once verified, you will be able to sign in immediately.</span>
          </div>
        </div>

        {/* Status alerts */}
        {message && (
          <div className="mb-4 p-3 bg-status-success/10 border border-status-success/20 rounded-xl text-xs text-status-success flex items-center gap-2 text-left">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{message}</span>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-status-error/10 border border-status-error/20 rounded-xl text-xs text-status-error flex items-center gap-2 text-left">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Resend Form */}
        <form onSubmit={handleResend} className="space-y-3">
          {!initialEmail && (
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email address"
              required
              className="w-full px-3.5 py-2.5 text-xs bg-surface-subtle border border-border-neutral rounded-xl text-text-main focus:outline-none focus:border-brand text-center"
            />
          )}

          <button
            type="submit"
            disabled={loading || cooldown > 0 || !email}
            className="w-full py-2.5 px-4 bg-surface hover:bg-surface-subtle border border-border-neutral text-text-main font-semibold text-xs rounded-xl shadow-2xs transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Sending...</span>
              </>
            ) : cooldown > 0 ? (
              <span>Resend available in {cooldown}s</span>
            ) : (
              <span>Resend Verification Email</span>
            )}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-border-neutral text-xs text-text-muted">
          Already verified?{' '}
          <Link to="/login" className="text-brand font-semibold hover:underline">
            Sign In to your account
          </Link>
        </div>
      </div>
    </div>
  );
}

export default VerifyEmailPendingPage;

