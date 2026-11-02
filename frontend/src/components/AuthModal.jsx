/**
 * Authentication Modal Component.
 *
 * Supports Customer Phone OTP verification and Administrator credentials login.
 * Styled with light ivory & white surfaces, deep forest green primary buttons,
 * and charcoal typography.
 *
 * @module components/AuthModal
 */

import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { X, Phone, Lock, Mail, ShieldCheck, ArrowRight, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export function AuthModal({ isOpen, onClose }) {
  const { requestOtp, verifyOtp, adminLogin } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState('customer'); // 'customer' | 'admin'
  const [step, setStep] = useState('phone');     // 'phone' | 'otp'

  // Customer state
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpLength, setOtpLength] = useState(4);
  const [cooldown, setCooldown] = useState(0);
  const [isExistingCustomer, setIsExistingCustomer] = useState(false);
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);

  // Admin state
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Reset consent on open/close
  useEffect(() => {
    if (!isOpen) {
      setPrivacyConsent(false);
      setMarketingConsent(false);
      setError('');
      setSuccessMsg('');
    }
  }, [isOpen]);

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  if (!isOpen) return null;

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const data = await requestOtp(phone);
      if (data?.otpLength) {
        setOtpLength(data.otpLength);
      }
      setIsExistingCustomer(Boolean(data?.isExistingCustomer));
      setStep('otp');
      setCooldown(data?.cooldownSeconds || 45);
      setSuccessMsg(
        data?.devOtp ? `OTP (${data.devOtp}) sent to ${phone}!` : `OTP sent successfully to ${phone}!`
      );
    } catch (err) {
      setError(err.message || 'Failed to send OTP. Please check mobile number.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');

    // Mandatory privacy consent check
    if (!privacyConsent) {
      setError('You must read and agree to the Privacy Policy and Terms & Conditions to proceed.');
      return;
    }

    setLoading(true);

    try {
      await verifyOtp(phone, otp, {
        privacyConsent,
        marketingConsent,
        policyVersion: '1.0',
        termsVersion: '1.0',
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Invalid or expired OTP. Please try again.');
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
      // Directly redirect Super Admin & Admin to the Admin Dashboard
      navigate('/admin/dashboard', { replace: true });
    } catch (err) {
      setError(err.message || 'Invalid administrator email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fadeIn">
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
            Customer Login (Phone OTP)
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
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 bg-status-success/10 border border-status-success/20 rounded-xl flex items-start gap-2.5 text-xs text-status-success">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* ── Mode 1: Customer Phone OTP ──────────────────────────────────── */}
        {mode === 'customer' && (
          <div>
            <div className="text-center mb-6">
              <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-brand-light text-brand border border-brand/20 flex items-center justify-center">
                <Phone className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold font-heading text-text-main">
                {step === 'phone' ? 'Welcome to Khushboo Grocery Service' : 'Verify One-Time Password'}
              </h2>
              <p className="text-xs text-text-muted mt-1">
                {step === 'phone'
                  ? 'Enter your Indian mobile number to log in or register instantly.'
                  : `Enter the ${otpLength}-digit code sent to +91 ${phone}`}
              </p>
            </div>

            {step === 'phone' ? (
              <form onSubmit={handleRequestOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-text-main mb-1.5">
                    Mobile Number
                  </label>
                  <div className="flex rounded-xl border border-border-neutral bg-surface overflow-hidden focus-within:border-brand focus-within:ring-1 focus-within:ring-brand transition shadow-xs">
                    <span className="px-3.5 py-3 text-sm font-semibold text-text-muted bg-surface-subtle border-r border-border-neutral flex items-center">
                      🇮🇳 +91
                    </span>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="98260 12345"
                      required
                      className="w-full px-3.5 py-3 text-sm bg-transparent text-text-main focus:outline-none placeholder:text-text-muted tracking-wider"
                    />
                  </div>
                </div>

                <p className="text-[11px] text-text-muted leading-relaxed text-center px-1">
                  By continuing, you agree to our{' '}
                  <Link
                    to="/terms"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand font-semibold underline hover:text-brand-hover"
                  >
                    Terms & Conditions
                  </Link>{' '}
                  and acknowledge that you have read our{' '}
                  <Link
                    to="/privacy-policy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand font-semibold underline hover:text-brand-hover"
                  >
                    Privacy Policy
                  </Link>
                  .
                </p>

                <button
                  type="submit"
                  disabled={loading || phone.length < 10}
                  className="w-full py-3 px-4 bg-brand hover:bg-brand-hover text-white font-semibold text-sm rounded-xl shadow-xs transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Sending OTP...</span>
                    </>
                  ) : (
                    <>
                      <span>Get OTP</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-text-main mb-1.5">
                    {otpLength}-Digit Verification Code
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, otpLength))}
                    placeholder={'123456'.slice(0, otpLength)}
                    required
                    maxLength={otpLength}
                    className="w-full px-4 py-3 text-center tracking-[0.5em] text-xl font-bold bg-surface-subtle border border-border-neutral rounded-xl text-brand focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition placeholder:text-text-muted"
                  />
                  <div className="flex justify-between items-center text-xs mt-2 px-1">
                    <button
                      type="button"
                      onClick={() => setStep('phone')}
                      className="text-text-muted hover:text-text-main transition"
                    >
                      Change Number
                    </button>
                    {cooldown > 0 ? (
                      <span className="text-text-muted">Resend in {cooldown}s</span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleRequestOtp}
                        className="text-brand font-semibold hover:underline"
                      >
                        Resend OTP
                      </button>
                    )}
                  </div>
                </div>

                {/* Privacy Policy & Terms Mandatory Consent */}
                <div className="pt-2 border-t border-border-neutral space-y-2.5">
                  <label className="flex items-start gap-2.5 cursor-pointer text-xs text-text-main select-none">
                    <input
                      type="checkbox"
                      checked={privacyConsent}
                      onChange={(e) => setPrivacyConsent(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded border-border-neutral text-brand focus:ring-brand accent-brand cursor-pointer shrink-0"
                    />
                    <span className="leading-snug">
                      I have read and agree to the{' '}
                      <Link
                        to="/privacy-policy"
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-brand font-bold underline hover:text-brand-hover"
                      >
                        Privacy Policy
                      </Link>{' '}
                      and{' '}
                      <Link
                        to="/terms"
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-brand font-bold underline hover:text-brand-hover"
                      >
                        Terms & Conditions
                      </Link>
                      . <span className="text-status-error font-bold">*</span>
                    </span>
                  </label>

                  {/* Optional Marketing Consent */}
                  <label className="flex items-start gap-2.5 cursor-pointer text-xs text-text-muted select-none">
                    <input
                      type="checkbox"
                      checked={marketingConsent}
                      onChange={(e) => setMarketingConsent(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded border-border-neutral text-brand focus:ring-brand accent-brand cursor-pointer shrink-0"
                    />
                    <span className="leading-snug">
                      Send me updates about seasonal harvest discounts, festival offers, and new grocery arrivals via SMS (Optional).
                    </span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={loading || otp.length !== otpLength || !privacyConsent}
                  className="w-full py-3 px-4 bg-brand hover:bg-brand-hover text-white font-semibold text-sm rounded-xl shadow-xs transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <>
                      <span>Verify & Continue</span>
                      <ShieldCheck className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        )}

        {/* ── Mode 2: Store Admin Login ───────────────────────────────────── */}
        {mode === 'admin' && (
          <div>
            <div className="text-center mb-6">
              <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-brand-light text-brand border border-brand/20 flex items-center justify-center">
                <Lock className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold font-heading text-text-main">Store Administration</h2>
              <p className="text-xs text-text-muted mt-1">
                Authorized staff and managers only. All attempts are monitored.
              </p>
            </div>

            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-main mb-1.5">
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
                    className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-surface border border-border-neutral rounded-xl text-text-main focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition placeholder:text-text-muted shadow-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-main mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-text-muted absolute left-3.5 top-3.5" />
                  <input
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="••••••••••••"
                    required
                    className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-surface border border-border-neutral rounded-xl text-text-main focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition placeholder:text-text-muted shadow-xs"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !adminEmail || !adminPassword}
                className="w-full py-3 px-4 bg-brand hover:bg-brand-hover text-white font-semibold text-sm rounded-xl shadow-xs transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Signing In...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In to Admin Dashboard</span>
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
