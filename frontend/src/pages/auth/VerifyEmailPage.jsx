/**
 * Email Verification Result Page.
 *
 * Route: /verify-email
 * Verifies email tokens and renders Success, Pending, or Expired/Failure states.
 *
 * @module pages/auth/VerifyEmailPage
 */

import React, { useState, useEffect } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, AlertCircle, RefreshCw, ArrowRight, Mail } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';

export function VerifyEmailPage() {
  const { verifyEmail, resendVerification } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const searchParams = new URLSearchParams(location.search);
  const token = searchParams.get('token');

  const [status, setStatus] = useState('verifying'); // 'verifying' | 'success' | 'error'
  const [errorMessage, setErrorMessage] = useState('');
  const [resendEmail, setResendEmail] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    let isMounted = true;

    async function executeVerification() {
      if (!token) {
        setStatus('error');
        setErrorMessage('No verification token was provided in the link.');
        return;
      }

      try {
        await verifyEmail(token);
        if (isMounted) {
          setStatus('success');
        }
      } catch (err) {
        if (isMounted) {
          setStatus('error');
          setErrorMessage(
            err.message || 'This verification link is invalid, expired, or has already been used.'
          );
        }
      }
    }

    executeVerification();

    return () => {
      isMounted = false;
    };
  }, [token]);

  // Cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((p) => (p > 0 ? p - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleResend = async (e) => {
    e.preventDefault();
    if (!resendEmail || resendCooldown > 0) return;

    setResendLoading(true);
    setResendSuccess('');

    try {
      const res = await resendVerification(resendEmail.trim().toLowerCase());
      setResendSuccess(res.message || 'New verification link sent to your email.');
      setResendCooldown(60);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to resend verification email.');
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-primary-bg">
      <div className="w-full max-w-md bg-surface border border-border-neutral rounded-2xl shadow-sm p-6 sm:p-8 text-center">
        {/* Status 1: Verifying */}
        {status === 'verifying' && (
          <div className="py-6">
            <RefreshCw className="w-12 h-12 text-brand animate-spin mx-auto mb-4" />
            <h1 className="text-xl font-bold font-heading text-text-main">
              Verifying Your Email Address...
            </h1>
            <p className="text-xs text-text-muted mt-2">
              Please wait while we confirm your activation token.
            </p>
          </div>
        )}

        {/* Status 2: Success */}
        {status === 'success' && (
          <div className="py-2">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-emerald-50 text-brand border border-brand/20 flex items-center justify-center">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <h1 className="text-2xl font-bold font-heading text-text-main tracking-tight">
              Email Verified Successfully!
            </h1>
            <p className="text-xs sm:text-sm text-text-muted mt-2 leading-relaxed">
              Your Khushboo Food Service account is now active and ready. You can log in to order pure, farm-fresh groceries.
            </p>

            <div className="mt-8">
              <Link
                to="/login"
                className="w-full py-3 px-4 bg-brand hover:bg-brand-hover text-white font-semibold text-sm rounded-xl shadow-xs transition flex items-center justify-center gap-2"
              >
                <span>Continue to Sign In</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}

        {/* Status 3: Error / Expired */}
        {status === 'error' && (
          <div className="py-2">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-status-error/10 text-status-error border border-status-error/20 flex items-center justify-center">
              <AlertCircle className="w-9 h-9" />
            </div>
            <h1 className="text-2xl font-bold font-heading text-text-main tracking-tight">
              Verification Failed or Expired
            </h1>
            <p className="text-xs text-text-muted mt-2 leading-relaxed">
              {errorMessage || 'The verification link has expired or is invalid.'}
            </p>

            {/* Resend Verification Form */}
            <div className="mt-6 pt-5 border-t border-border-neutral text-left">
              <h3 className="text-xs font-bold text-text-main mb-2">
                Need a new verification link?
              </h3>
              <form onSubmit={handleResend} className="space-y-3">
                <input
                  type="email"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  placeholder="Enter your registered email"
                  required
                  className="w-full px-3.5 py-2.5 text-xs bg-surface-subtle border border-border-neutral rounded-xl text-text-main focus:outline-none focus:border-brand"
                />
                <button
                  type="submit"
                  disabled={resendLoading || resendCooldown > 0 || !resendEmail}
                  className="w-full py-2.5 px-4 bg-brand hover:bg-brand-hover text-white font-semibold text-xs rounded-xl shadow-xs transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {resendLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : resendCooldown > 0 ? (
                    <span>Wait {resendCooldown}s</span>
                  ) : (
                    <span>Send New Verification Email</span>
                  )}
                </button>
              </form>

              {resendSuccess && (
                <p className="text-xs text-status-success mt-2 text-center">
                  {resendSuccess}
                </p>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-border-neutral text-xs text-text-muted">
              Already verified?{' '}
              <Link to="/login" className="text-brand font-semibold hover:underline">
                Sign In
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default VerifyEmailPage;

