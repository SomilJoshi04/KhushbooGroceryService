/**
 * Authentication Context for Frontend.
 *
 * Manages customer session (Phone OTP) and administrator login state.
 *
 * @module context/AuthContext
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiClient } from '../config/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('khushboo_token') || null);
  const [loading, setLoading] = useState(true);
  const [isPreviewMode, setIsPreviewMode] = useState(() => {
    return typeof window !== 'undefined' && sessionStorage.getItem('khushboo_admin_preview') === 'true';
  });

  const enterPreviewMode = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('khushboo_admin_preview', 'true');
      setIsPreviewMode(true);
    }
  };

  const exitPreviewMode = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('khushboo_admin_preview');
      setIsPreviewMode(false);
    }
  };

  // Set default auth header when token changes
  useEffect(() => {
    if (token) {
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      localStorage.setItem('khushboo_token', token);
    } else {
      delete apiClient.defaults.headers.common['Authorization'];
      localStorage.removeItem('khushboo_token');
    }
  }, [token]);

  // Load current user profile from backend on startup
  useEffect(() => {
    async function loadUser() {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await apiClient.get('/auth/me');
        if (res.data?.success && res.data?.user) {
          setUser(res.data.user);
        } else {
          setToken(null);
          setUser(null);
        }
      } catch {
        // Token invalid or expired
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    }
    loadUser();
  }, [token]);

  /**
   * Request OTP for customer phone
   */
  const requestOtp = async (phone) => {
    const res = await apiClient.post('/auth/otp/request', { phone });
    return res.data;
  };

  /**
   * Verify customer OTP and log in
   * Accepts optional consentData { privacyConsent, marketingConsent, policyVersion, termsVersion }
   */
  const verifyOtp = async (phone, otp, consentData = {}) => {
    const payload = {
      phone,
      otp,
      privacyConsent: consentData.privacyConsent !== undefined ? Boolean(consentData.privacyConsent) : undefined,
      marketingConsent: consentData.marketingConsent !== undefined ? Boolean(consentData.marketingConsent) : undefined,
      policyVersion: consentData.policyVersion || '1.0',
      termsVersion: consentData.termsVersion || '1.0',
    };
    const res = await apiClient.post('/auth/otp/verify', payload);
    if (res.data?.success && res.data?.token) {
      setToken(res.data.token);
      setUser(res.data.user);
    }
    return res.data;
  };

  /**
   * Administrator credentials login
   */
  const adminLogin = async (email, password) => {
    const res = await apiClient.post('/auth/admin/login', { email, password });
    if (res.data?.success && res.data?.token) {
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('khushboo_admin_preview');
      }
      setIsPreviewMode(false);
      setToken(res.data.token);
      setUser(res.data.user);
    }
    return res.data;
  };

  /**
   * Refresh current user profile from server
   */
  const refreshUser = async () => {
    try {
      const res = await apiClient.get('/auth/me');
      if (res.data?.success && res.data?.user) {
        setUser(res.data.user);
        return res.data.user;
      }
    } catch (err) {
      console.error('[auth] Failed to refresh user profile:', err.message);
    }
    return null;
  };

  /**
   * Update personal profile (name, email)
   */
  const updateProfile = async (profileData) => {
    const res = await apiClient.patch('/auth/profile', profileData);
    if (res.data?.success && res.data?.user) {
      setUser(res.data.user);
    }
    return res.data;
  };

  /**
   * Upload customer profile avatar
   */
  const uploadAvatar = async (file) => {
    const formData = new FormData();
    formData.append('avatar', file);
    const res = await apiClient.post('/auth/profile/avatar', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    if (res.data?.success && res.data?.user) {
      setUser(res.data.user);
    }
    return res.data;
  };

  /**
   * Remove customer profile avatar
   */
  const removeAvatar = async () => {
    const res = await apiClient.delete('/auth/profile/avatar');
    if (res.data?.success && res.data?.user) {
      setUser(res.data.user);
    }
    return res.data;
  };

  /**
   * Address management functions
   */
  const addAddress = async (addressData) => {
    const res = await apiClient.post('/auth/addresses', addressData);
    await refreshUser();
    return res.data;
  };

  const updateAddress = async (id, addressData) => {
    const res = await apiClient.put(`/auth/addresses/${id}`, addressData);
    await refreshUser();
    return res.data;
  };

  const deleteAddress = async (id) => {
    const res = await apiClient.delete(`/auth/addresses/${id}`);
    await refreshUser();
    return res.data;
  };

  const setDefaultAddress = async (id) => {
    const res = await apiClient.patch(`/auth/addresses/${id}/default`);
    await refreshUser();
    return res.data;
  };

  /**
   * Submit an account deletion request
   */
  const submitDeletionRequest = async (reason) => {
    const res = await apiClient.post('/auth/deletion-request', { reason });
    await refreshUser();
    return res.data;
  };

  /**
   * Get account deletion request status
   */
  const getDeletionRequestStatus = async () => {
    const res = await apiClient.get('/auth/deletion-request');
    return res.data;
  };

  /**
   * Logout user and clear tokens
   */
  const logout = async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // Ignore network errors on logout
    }
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('khushboo_admin_preview');
    }
    setIsPreviewMode(false);
    setToken(null);
    setUser(null);
  };

  const isAuthenticated = Boolean(user);
  const isAdmin = Boolean(user && (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN'));
  const isSuperAdmin = Boolean(user && user.role === 'SUPER_ADMIN');

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isAuthenticated,
        isAdmin,
        isSuperAdmin,
        isPreviewMode,
        enterPreviewMode,
        exitPreviewMode,
        requestOtp,
        verifyOtp,
        adminLogin,
        refreshUser,
        updateProfile,
        uploadAvatar,
        removeAvatar,
        addAddress,
        updateAddress,
        deleteAddress,
        setDefaultAddress,
        submitDeletionRequest,
        getDeletionRequestStatus,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
