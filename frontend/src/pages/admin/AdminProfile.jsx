/**
 * Admin Profile & Security View.
 *
 * Route: /admin/profile
 * Allows store administrators to view account privileges, update contact name
 * and email address, view session timestamps, and safely log out.
 *
 * @module pages/admin/AdminProfile
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { apiClient } from '../../config/api.js';
import { SkeletonAvatar, SkeletonTitle, SkeletonText, SkeletonBase, SkeletonButton, SkeletonBadge } from '../../components/skeleton/index.js';
import {
  User as UserIcon,
  ShieldCheck,
  Mail,
  Phone,
  Calendar,
  Clock,
  Save,
  LogOut,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  Lock,
} from 'lucide-react';

export function AdminProfile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  const fetchProfile = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await apiClient.get('/v1/admin/profile');
      if (res.data?.success && res.data?.data) {
        setProfile(res.data.data);
        setName(res.data.data.name || '');
        setEmail(res.data.data.email || '');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load profile details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Name cannot be empty.');
      return;
    }

    setSaving(true);
    setSuccessMsg('');
    setErrorMsg('');

    try {
      const res = await apiClient.patch('/v1/admin/profile', {
        name: name.trim(),
        email: email.trim(),
      });

      if (res.data?.success) {
        setSuccessMsg('Admin profile updated successfully.');
        setProfile((prev) => ({ ...prev, ...res.data.data }));
        setTimeout(() => setSuccessMsg(''), 4000);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || err.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    if (window.confirm('Are you sure you want to log out from the admin session?')) {
      await logout();
      navigate('/');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-4xl" aria-busy="true" aria-label="Loading admin profile">
        <div className="space-y-2">
          <SkeletonTitle height="h-7" width="240px" />
          <SkeletonText width="320px" height="h-3" />
        </div>

        {/* Profile Card */}
        <div className="bg-surface border border-border-neutral rounded-2xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <SkeletonAvatar size="w-14 h-14" />
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <SkeletonTitle height="h-5" width="160px" />
                <SkeletonBadge width="w-24" height="h-5" />
              </div>
              <SkeletonText width="140px" height="h-3" />
            </div>
          </div>
          <SkeletonButton className="w-36 h-9" />
        </div>

        {/* Details Card */}
        <div className="bg-surface border border-border-neutral rounded-2xl p-6 shadow-xs space-y-4">
          <SkeletonTitle height="h-5" width="180px" />
          <div className="space-y-3">
            <SkeletonBase className="h-10 w-full rounded-xl" />
            <SkeletonBase className="h-10 w-full rounded-xl" />
          </div>
          <SkeletonButton className="w-28 h-9" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold font-heading text-text-main flex items-center gap-2.5">
          <UserIcon className="w-6 h-6 text-brand" />
          Admin Profile & Security
        </h1>
        <p className="text-xs text-text-muted mt-1">
          Review your administrator role credentials, session activity, and contact details.
        </p>
      </div>

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-status-success text-xs flex items-center gap-3 animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-status-error text-xs flex items-center gap-3 animate-fadeIn">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Role & Privileges Badge Card */}
      <div className="bg-surface border border-border-neutral rounded-2xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-brand-light text-brand border border-brand/20 flex items-center justify-center text-xl font-bold font-heading">
            {profile?.name ? profile.name.charAt(0).toUpperCase() : 'A'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-text-main font-heading">{profile?.name || 'Administrator'}</h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-brand-light text-brand border border-brand/20">
                {profile?.role || user?.role || 'SUPER_ADMIN'}
              </span>
            </div>
            <p className="text-xs text-text-muted mt-0.5">{profile?.email || '—'}</p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="px-4 py-2 rounded-xl bg-surface hover:bg-red-50 border border-border-neutral hover:border-red-200 text-status-error text-xs font-semibold flex items-center gap-2 transition self-start sm:self-auto shadow-xs"
        >
          <LogOut className="w-4 h-4" />
          <span>Terminate Session</span>
        </button>
      </div>

      {/* Form: Editable Information */}
      <div className="bg-surface border border-border-neutral rounded-2xl p-6 shadow-xs space-y-4">
        <h2 className="text-sm font-bold font-heading text-text-main flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-brand" />
          Personal & Contact Details
        </h2>

        <form onSubmit={handleUpdate} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-text-main font-semibold mb-1">Full Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-primary-bg border border-border-neutral rounded-xl px-3 py-2 text-text-main focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
              />
            </div>

            <div>
              <label className="block text-text-main font-semibold mb-1">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-primary-bg border border-border-neutral rounded-xl px-3 py-2 text-text-main focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-text-muted font-semibold mb-1">Phone Number (Read-only)</label>
              <input
                type="text"
                disabled
                value={profile?.phone || 'Not configured'}
                className="w-full bg-surface-subtle border border-border-neutral rounded-xl px-3 py-2 text-text-muted font-mono cursor-not-allowed"
              />
              <span className="text-[10px] text-text-muted block mt-1">
                Phone numbers require OTP re-verification for security.
              </span>
            </div>

            <div>
              <label className="block text-text-muted font-semibold mb-1">Role Privileges (Locked)</label>
              <input
                type="text"
                disabled
                value={profile?.role || 'SUPER_ADMIN'}
                className="w-full bg-surface-subtle border border-border-neutral rounded-xl px-3 py-2 text-text-muted font-mono cursor-not-allowed"
              />
              <span className="text-[10px] text-text-muted block mt-1">
                Administrative roles cannot be self-escalated.
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end pt-3">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 bg-brand hover:bg-brand-hover text-white font-semibold text-xs rounded-xl shadow-xs flex items-center gap-2 transition"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Saving Changes...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Update Profile</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Account Audit Information */}
      <div className="bg-surface border border-border-neutral rounded-2xl p-6 shadow-xs space-y-4">
        <h2 className="text-sm font-bold font-heading text-text-main flex items-center gap-2">
          <Clock className="w-4 h-4 text-brand" />
          Audit & Security Activity
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-3.5 bg-surface-subtle rounded-xl border border-border-neutral">
            <span className="text-text-muted text-[11px] block">Account Created On</span>
            <span className="text-text-main font-mono font-semibold block mt-0.5">
              {profile?.createdAt
                ? new Date(profile.createdAt).toLocaleString('en-IN', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })
                : 'Initial Setup'}
            </span>
          </div>

          <div className="p-3.5 bg-surface-subtle rounded-xl border border-border-neutral">
            <span className="text-text-muted text-[11px] block">Last Login Activity</span>
            <span className="text-status-success font-mono font-semibold block mt-0.5">
              {profile?.lastLoginAt
                ? new Date(profile.lastLoginAt).toLocaleString('en-IN', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })
                : 'Current Active Session'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
