/**
 * Public Privacy Policy Page.
 *
 * Fetches the authoritative published Privacy Policy from the backend.
 * Provides clear typography, effective date, and compliance contact details.
 *
 * @module pages/PrivacyPolicyPage
 */

import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ShieldCheck, Calendar, ArrowLeft, Loader2, Lock, AlertCircle } from 'lucide-react';
import { apiClient } from '../config/api.js';

export function PrivacyPolicyPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [policy, setPolicy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Dynamic back navigation based on referring context
  const fromState = location.state?.from;
  const backLabel = location.state?.label || (fromState?.includes('/account') ? 'Back to Profile Details' : 'Back to Storefront');

  const handleBack = () => {
    if (fromState) {
      navigate(fromState, { state: { tab: location.state?.tab } });
    } else if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  useEffect(() => {
    async function loadPolicy() {
      try {
        const res = await apiClient.get('/content/privacy-policy');
        if (res.data?.success && res.data?.data) {
          setPolicy(res.data.data);
          return;
        }
      } catch {
        // Fallback to fetch
        try {
          const res = await fetch('/api/v1/content/privacy-policy');
          const data = await res.json();
          if (data?.success && data?.data) {
            setPolicy(data.data);
            return;
          }
        } catch {}
        setError('Privacy Policy is currently being updated.');
      } finally {
        setLoading(false);
      }
    }
    loadPolicy();
  }, []);

  return (
    <div className="min-h-screen bg-primary-bg py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Dynamic Contextual Back Button */}
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-muted hover:text-brand transition cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{backLabel}</span>
        </button>

        {/* Page Header */}
        <div className="bg-surface border border-border-neutral rounded-2xl p-6 sm:p-8 shadow-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-brand-light text-brand flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold font-heading text-text-main">
                  {policy?.title || 'Khushboo Grocery Service — Privacy Policy'}
                </h1>
                <p className="text-xs text-text-muted">Customer Privacy, Data Security & Compliance Standards</p>
              </div>
            </div>

            {policy && (
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-brand-light text-brand">
                  Version {policy.version}
                </span>
                <div className="flex items-center gap-1 text-[11px] text-text-muted">
                  <Calendar className="w-3.5 h-3.5 text-text-muted" />
                  <span>Effective: {new Date(policy.effectiveDate || policy.publishedAt).toLocaleDateString()}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Policy Body */}
        <div className="bg-surface border border-border-neutral rounded-2xl p-6 sm:p-8 shadow-xs">
          {loading ? (
            <div className="py-16 text-center text-text-muted space-y-2">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-brand" />
              <p className="text-xs">Loading published privacy policy...</p>
            </div>
          ) : error ? (
            <div className="p-6 bg-status-error/10 border border-status-error/20 rounded-xl text-center space-y-2">
              <AlertCircle className="w-8 h-8 text-status-error mx-auto" />
              <p className="text-xs font-bold text-status-error">{error}</p>
            </div>
          ) : (
            <div className="prose prose-sm max-w-none text-xs sm:text-sm text-text-main leading-relaxed space-y-4 whitespace-pre-wrap font-sans">
              {policy?.content}
            </div>
          )}
        </div>

        {/* Footer Support Card */}
        <div className="p-5 bg-surface-subtle border border-border-neutral rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-0.5">
            <span className="text-xs font-bold text-text-main">Questions regarding your personal data?</span>
            <p className="text-[11px] text-text-muted">
              Our Indore customer support team can assist with data privacy, address updates, or account inquiries.
            </p>
          </div>
          <Link
            to="/help"
            className="px-4 py-2 bg-brand hover:bg-brand-hover text-white text-xs font-bold rounded-xl transition shadow-xs self-start sm:self-auto"
          >
            Contact Help Desk
          </Link>
        </div>
      </div>
    </div>
  );
}
