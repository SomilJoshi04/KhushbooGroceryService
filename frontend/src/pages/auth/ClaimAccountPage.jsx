/**
 * Legacy Account Claim & Credential Setup Page.
 *
 * Route: /claim-account
 * Allows existing customers who registered via Phone OTP to securely claim
 * their account by verifying phone ownership and attaching their unique username,
 * email, and secure password. Preserves all past orders, addresses, and carts.
 *
 * @module pages/auth/ClaimAccountPage
 */

import React, { useState, useMemo, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Phone,
  ShieldCheck,
  User,
  AtSign,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Check,
  X,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';

export function ClaimAccountPage() {
  const { claimLegacyRequestOtp, claimLegacyComplete } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(1); // 1: Phone & OTP, 2: Setup Credentials, 3: Success

  // Step 1 State
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Step 2 State
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  // Cooldown countdown
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Dynamic Password Validation
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
    return Object.values(passwordCriteria).filter(Boolean).length;
  }, [passwordCriteria]);

  const passwordsMatch = password && confirmPassword && password === confirmPassword;

  // Step 1: Request Phone OTP
  const handleRequestOtp = async (e) => {
    e.preventDefault();
    if (phone.length < 10) return;

    setError('');
    setInfoMessage('');
    setLoading(true);

    try {
      const data = await claimLegacyRequestOtp(phone);
      setOtpSent(true);
      setCooldown(data?.cooldownSeconds || 45);
      setInfoMessage(
        data?.devOtp ? `OTP (${data.devOtp}) sent to +91 ${phone}` : `OTP sent to +91 ${phone}`
      );
    } catch (err) {
      setError(err.message || 'Failed to verify phone number. Please check your number.');
    } finally {
      setLoading(false);
    }
  };

  // Move from Step 1 to Step 2
  const handleVerifyPhoneStep = (e) => {
    e.preventDefault();
    if (otp.length < 4) {
      setError('Please enter the verification code sent to your phone.');
      return;
    }
    setError('');
    setStep(2);
  };

  // Step 2: Complete Credentials Setup
  const handleCompleteClaim = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 12 || strengthScore < 4) {
      setError('Password must meet complexity requirements (12+ characters, upper, lower, number, special).');
      return;
    }

    if (!passwordsMatch) {
      setError('Passwords do not match.');
      return;
    }

    if (!acceptTerms) {
      setError('You must accept the Terms & Conditions.');
      return;
    }

    setLoading(true);

    try {
      await claimLegacyComplete({
        phone,
        otp,
        fullName: fullName.trim(),
        username: username.trim().toLowerCase(),
        email: email.trim().toLowerCase(),
        password,
        confirmPassword,
        acceptTerms: Boolean(acceptTerms),
      });

      setStep(3);
    } catch (err) {
      setError(err.message || 'Failed to complete account setup. Please check your information.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-primary-bg">
      <div className="w-full max-w-lg bg-surface border border-border-neutral rounded-2xl shadow-sm p-6 sm:p-8">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <Link to="/" className="inline-block mb-3">
            <img
              src="/websiteLogo.png"
              alt="Khushboo Food Service"
              className="w-14 h-14 mx-auto rounded-2xl object-contain shadow-xs border border-border-neutral/60 bg-surface"
            />
          </Link>
          <h1 className="text-2xl font-bold font-heading text-text-main tracking-tight">
            Claim Your Legacy Account
          </h1>
          <p className="text-xs text-text-muted mt-1.5 leading-relaxed">
            Previously signed in using SMS OTP? Upgrade your account to secure email, username, and password authentication while keeping all your past orders and saved addresses.
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-6 text-xs font-semibold">
          <span className={`px-3 py-1 rounded-full ${step >= 1 ? 'bg-brand text-white' : 'bg-surface-subtle text-text-muted'}`}>
            1. Verify Phone
          </span>
          <span className="text-text-muted">&rarr;</span>
          <span className={`px-3 py-1 rounded-full ${step >= 2 ? 'bg-brand text-white' : 'bg-surface-subtle text-text-muted'}`}>
            2. Setup Login
          </span>
          <span className="text-text-muted">&rarr;</span>
          <span className={`px-3 py-1 rounded-full ${step === 3 ? 'bg-brand text-white' : 'bg-surface-subtle text-text-muted'}`}>
            3. Complete
          </span>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-5 p-3.5 bg-status-error/10 border border-status-error/20 rounded-xl flex items-start gap-2.5 text-xs text-status-error">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {infoMessage && (
          <div className="mb-5 p-3.5 bg-status-success/10 border border-status-success/20 rounded-xl flex items-start gap-2.5 text-xs text-status-success">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{infoMessage}</span>
          </div>
        )}

        {/* ── STEP 1: VERIFY PHONE OWNERSHIP ─────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-4">
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-main mb-1.5">
                  Your Registered Mobile Number
                </label>
                <div className="flex rounded-xl border border-border-neutral bg-surface-subtle overflow-hidden focus-within:border-brand focus-within:ring-1 focus-within:ring-brand shadow-2xs">
                  <span className="px-3.5 py-2.5 text-xs font-semibold text-text-muted bg-surface border-r border-border-neutral flex items-center">
                    🇮🇳 +91
                  </span>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="98260 12345"
                    required
                    disabled={otpSent}
                    className="w-full px-3.5 py-2.5 text-sm bg-transparent text-text-main focus:outline-none placeholder:text-text-muted font-mono"
                  />
                </div>
              </div>

              {!otpSent ? (
                <button
                  type="submit"
                  disabled={loading || phone.length < 10}
                  className="w-full py-3 px-4 bg-brand hover:bg-brand-hover text-white font-semibold text-sm rounded-xl shadow-xs transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Sending Code...</span>
                    </>
                  ) : (
                    <>
                      <span>Send Verification Code</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              ) : null}
            </form>

            {otpSent && (
              <form onSubmit={handleVerifyPhoneStep} className="space-y-4 pt-3 border-t border-border-neutral">
                <div>
                  <label className="block text-xs font-semibold text-text-main mb-1.5">
                    Enter Verification Code
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 8))}
                    placeholder="1234"
                    required
                    className="w-full px-4 py-2.5 text-center tracking-[0.4em] text-lg font-bold bg-surface-subtle border border-border-neutral rounded-xl text-brand focus:outline-none focus:border-brand"
                  />
                  <div className="flex justify-between items-center text-xs mt-2 text-text-muted">
                    <button
                      type="button"
                      onClick={() => {
                        setOtpSent(false);
                        setOtp('');
                      }}
                      className="hover:underline"
                    >
                      Change Number
                    </button>
                    {cooldown > 0 ? (
                      <span>Resend in {cooldown}s</span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleRequestOtp}
                        className="text-brand font-semibold hover:underline"
                      >
                        Resend Code
                      </button>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={otp.length < 4}
                  className="w-full py-3 px-4 bg-brand hover:bg-brand-hover text-white font-semibold text-sm rounded-xl shadow-xs transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Verify & Proceed to Setup</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            )}
          </div>
        )}

        {/* ── STEP 2: SETUP CREDENTIALS ──────────────────────────────────── */}
        {step === 2 && (
          <form onSubmit={handleCompleteClaim} className="space-y-4">
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
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-surface-subtle border border-border-neutral rounded-xl text-text-main focus:outline-none focus:border-brand"
                />
              </div>
            </div>

            {/* Username */}
            <div>
              <label className="block text-xs font-semibold text-text-main mb-1.5">
                Choose a Unique Username
              </label>
              <div className="relative">
                <AtSign className="w-4 h-4 text-text-muted absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ''))}
                  placeholder="ramesh_sharma"
                  required
                  minLength={3}
                  maxLength={30}
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-surface-subtle border border-border-neutral rounded-xl text-text-main focus:outline-none focus:border-brand font-mono"
                />
              </div>
            </div>

            {/* Email Address */}
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
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-surface-subtle border border-border-neutral rounded-xl text-text-main focus:outline-none focus:border-brand"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-text-main mb-1.5">
                New Password (12+ characters)
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-text-muted absolute left-3.5 top-3.5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="w-full pl-10 pr-10 py-2.5 text-sm bg-surface-subtle border border-border-neutral rounded-xl text-text-main focus:outline-none focus:border-brand"
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
                  className={`w-full pl-10 pr-10 py-2.5 text-sm bg-surface-subtle border rounded-xl text-text-main focus:outline-none ${
                    confirmPassword && !passwordsMatch ? 'border-status-error' : 'border-border-neutral focus:border-brand'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3.5 top-3 text-text-muted hover:text-text-main"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {confirmPassword && !passwordsMatch && (
                <p className="text-[11px] text-status-error mt-1">Passwords do not match.</p>
              )}
            </div>

            {/* Terms */}
            <label className="flex items-start gap-2.5 cursor-pointer text-xs text-text-main select-none pt-1">
              <input
                type="checkbox"
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-border-neutral text-brand focus:ring-brand accent-brand cursor-pointer"
              />
              <span className="leading-snug">
                I agree to the Terms & Conditions and link this email to my account.
              </span>
            </label>

            <button
              type="submit"
              disabled={
                loading ||
                !fullName.trim() ||
                !username.trim() ||
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
                  <span>Upgrading Account...</span>
                </>
              ) : (
                <>
                  <span>Save Credentials & Claim Account</span>
                  <ShieldCheck className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* ── STEP 3: SUCCESS ────────────────────────────────────────────── */}
        {step === 3 && (
          <div className="text-center py-4 space-y-4">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-50 text-brand border border-brand/20 flex items-center justify-center">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <h2 className="text-xl font-bold text-text-main">
              Account Successfully Upgraded!
            </h2>
            <p className="text-xs text-text-muted leading-relaxed">
              We have attached your new username and password to your existing account. An activation link has been sent to <strong className="text-text-main">{email}</strong>.
            </p>
            <div className="p-3.5 bg-surface-subtle border border-border-neutral rounded-xl text-left text-xs text-text-muted space-y-1.5">
              <p>• All your previous orders and delivery addresses remain safe.</p>
              <p>• Please check your inbox and verify your email to log in.</p>
            </div>
            <div className="pt-2">
              <Link
                to={`/verify-email-pending?email=${encodeURIComponent(email)}`}
                className="w-full py-3 px-4 bg-brand hover:bg-brand-hover text-white font-semibold text-sm rounded-xl shadow-xs transition flex items-center justify-center gap-2"
              >
                <span>Check Verification Status</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}

        <div className="mt-6 pt-5 border-t border-border-neutral text-center text-xs text-text-muted">
          Back to{' '}
          <Link to="/login" className="text-brand font-semibold hover:underline">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}

export default ClaimAccountPage;

