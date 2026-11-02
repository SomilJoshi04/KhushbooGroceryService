/**
 * Admin Live Store Preview Banner.
 *
 * Rendered at the top of the customer-facing storefront when a Super Admin or Admin
 * is viewing the live store in preview mode.
 *
 * Provides a prominent indicator and an instant "Back to Admin Dashboard" navigation action.
 *
 * @module components/AdminLiveStoreBanner
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, LayoutDashboard, ArrowRight, Eye } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export function AdminLiveStoreBanner() {
  const { user, isAdmin, isSuperAdmin, exitPreviewMode } = useAuth();
  const navigate = useNavigate();

  if (!isAdmin) {
    return null;
  }

  const roleLabel = isSuperAdmin ? 'Super Admin' : user?.role === 'ADMIN' ? 'Store Admin' : 'Admin';

  const handleReturnToAdmin = () => {
    exitPreviewMode();
    navigate('/admin/dashboard');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div
      role="region"
      aria-label="Administrative Live Store Preview Banner"
      className="sticky top-0 z-50 bg-neutral-900 text-white border-b border-neutral-700/80 shadow-md backdrop-blur-md px-3 sm:px-6 py-2 transition-all"
    >
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2.5 text-center sm:text-left">
          <div className="w-6 h-6 rounded-lg bg-brand text-white flex items-center justify-center shrink-0 shadow-xs">
            <Eye className="w-3.5 h-3.5" />
          </div>
          <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5">
            <span className="font-heading font-extrabold tracking-wide uppercase text-[11px] bg-brand/30 border border-brand/50 text-brand-light px-2 py-0.5 rounded-full">
              {isSuperAdmin ? 'Super Admin — Live Store Preview' : `${roleLabel} — Live Store Preview`}
            </span>
            <span className="text-neutral-300 text-[11px] hidden md:inline">
              Viewing storefront as customers see it • Order placement is restricted in preview mode.
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleReturnToAdmin}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-brand hover:bg-brand-hover text-white font-semibold text-xs transition shadow-xs active:scale-98 shrink-0 cursor-pointer"
        >
          <LayoutDashboard className="w-3.5 h-3.5" />
          <span>Back to Admin Dashboard</span>
          <ArrowRight className="w-3 h-3 hidden sm:inline" />
        </button>
      </div>
    </div>
  );
}
