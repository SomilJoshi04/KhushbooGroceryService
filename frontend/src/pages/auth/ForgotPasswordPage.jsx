/**
 * Forgot Password Page.
 *
 * Route: /forgot-password
 * Collects registered email address and triggers password recovery email.
 *
 * @module pages/auth/ForgotPasswordPage
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowRight, RefreshCw, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';

export function ForgotPasswordPage() {
  const { forgotPassword } = useAuth();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) return;

    setError('');
    setLoading(true);

    try {
      await forgotPassword(email.trim().toLowerCase());
      setSubmitted(true);
    } catch (err) {
      setError(err.message || 'Failed to submit password reset request. Please try again.');
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
            Reset Your Password
          </h1>
          <p className="text-xs text-text-muted mt-1.5 leading-relaxed">
            Enter your registered email address and we'll send you a secure link to reset your password.
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-5 p-3.5 bg-status-error/10 border border-status-error/20 rounded-xl flex items-start gap-2.5 text-xs text-status-error">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {submitted ? (
          <div className="text-center py-4 space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-50 text-brand border border-brand/20 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-lg font-bold text-text-main">
              Check Your Inbox
            </h2>
            <p className="text-xs text-text-muted leading-relaxed">
              If an account with <strong className="text-text-main">{email}</strong> exists, we've sent instructions to reset your password.
            </p>
            <div className="p-3.5 bg-surface-subtle border border-border-neutral rounded-xl text-left text-xs text-text-muted space-y-1.5">
              <p>• The reset link is valid for <strong>15 minutes</strong>.</p>
              <p>• Check your spam or junk folder if you don't receive it.</p>
            </div>
            <div className="pt-2">
              <Link
                to="/login"
                className="w-full py-2.5 px-4 bg-brand hover:bg-brand-hover text-white font-semibold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Return to Sign In</span>
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-text-main mb-1.5">
                Registered Email Address
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
            </div>

            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full py-3 px-4 bg-brand hover:bg-brand-hover text-white font-semibold text-sm rounded-xl shadow-xs transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Sending Reset Link...</span>
                </>
              ) : (
                <>
                  <span>Send Password Reset Link</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="mt-6 pt-5 border-t border-border-neutral text-center text-xs text-text-muted">
              Remember your password?{' '}
              <Link to="/login" className="text-brand font-semibold hover:underline">
                Sign In
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default ForgotPasswordPage;

