/**
 * Authentication Context for Frontend.
 *
 * Manages customer session (Email, Username & Password),
 * administrator login state, rotating token refresh, and profile management.
 *
 * @module context/AuthContext
 */

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { apiClient } from '../config/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('khushboo_token') || null);
  const [loading, setLoading] = useState(true);
  const [isPreviewMode, setIsPreviewMode] = useState(() => {
    return typeof window !== 'undefined' && sessionStorage.getItem('khushboo_admin_preview') === 'true';
  });

  const isRefreshingRef = useRef(false);

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

  // Synchronize token and user from silent refresh events triggered by Axios interceptor
  useEffect(() => {
    const handleTokenRefreshed = (event) => {
      const newToken = event.detail?.token;
      const newUser = event.detail?.user;
      if (newToken) {
        setToken(newToken);
      }
      if (newUser) {
        setUser(newUser);
      }
    };

    const handleSessionExpired = () => {
      setToken(null);
      setUser(null);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('khushboo:token_refreshed', handleTokenRefreshed);
      window.addEventListener('khushboo:auth_session_expired', handleSessionExpired);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('khushboo:token_refreshed', handleTokenRefreshed);
        window.removeEventListener('khushboo:auth_session_expired', handleSessionExpired);
      }
    };
  }, []);

  // Proactive background refresh timer (schedules silent refresh 2 minutes before access token expiry)
  useEffect(() => {
    if (!token) return;

    let refreshTimeout = null;

    try {
      const base64Url = token.split('.')[1];
      if (base64Url && typeof window !== 'undefined') {
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
          window
            .atob(base64)
            .split('')
            .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
            .join('')
        );
        const payload = JSON.parse(jsonPayload);

        if (payload?.exp) {
          const expMs = payload.exp * 1000;
          const now = Date.now();
          const refreshLeadTimeMs = 2 * 60 * 1000;
          // Trigger 2 minutes before expiry, or after 10s if already nearing expiration
          const delay = Math.max(expMs - now - refreshLeadTimeMs, 10_000);

          refreshTimeout = setTimeout(async () => {
            try {
              const res = await apiClient.post('/auth/refresh');
              if (res.data?.success && res.data?.token) {
                setToken(res.data.token);
                if (res.data.user) setUser(res.data.user);
              }
            } catch (err) {
              // Non-blocking: request-driven 401 interceptor serves as primary fallback
              console.warn('[auth] Proactive refresh skipped:', err.message);
            }
          }, delay);
        }
      }
    } catch {
      // Non-blocking: rely on request-driven 401 interceptor
    }

    return () => {
      if (refreshTimeout) clearTimeout(refreshTimeout);
    };
  }, [token]);

  // Load current user profile from backend on startup or token refresh
  useEffect(() => {
    async function loadUser() {
      if (!token) {
        // Try silent refresh from HttpOnly cookie first
        try {
          const refreshRes = await apiClient.post('/auth/refresh');
          if (refreshRes.data?.success && refreshRes.data?.token) {
            setToken(refreshRes.data.token);
            const userRes = await apiClient.get('/auth/me', {
              headers: { Authorization: `Bearer ${refreshRes.data.token}` },
            });
            if (userRes.data?.success && userRes.data?.user) {
              setUser(userRes.data.user);
            }
          }
        } catch {
          // No active session cookie
        } finally {
          setLoading(false);
        }
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
        // Token might be expired, attempt a refresh
        try {
          const refreshRes = await apiClient.post('/auth/refresh');
          if (refreshRes.data?.success && refreshRes.data?.token) {
            setToken(refreshRes.data.token);
            const userRes = await apiClient.get('/auth/me', {
              headers: { Authorization: `Bearer ${refreshRes.data.token}` },
            });
            if (userRes.data?.success && userRes.data?.user) {
              setUser(userRes.data.user);
            }
          } else {
            setToken(null);
            setUser(null);
          }
        } catch {
          setToken(null);
          setUser(null);
        }
      } finally {
        setLoading(false);
      }
    }

    loadUser();
  }, []);

  /**
   * Customer Registration
   */
  const register = async (registrationData) => {
    const res = await apiClient.post('/auth/register', registrationData);
    return res.data;
  };

  /**
   * Customer / Unified Login (Email OR Username + Password)
   */
  const login = async (identifierOrEmail, password, rememberMe = false) => {
    const res = await apiClient.post('/auth/login', {
      identifier: identifierOrEmail,
      email: identifierOrEmail,
      password,
      rememberMe,
    });
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
   * Verify Email Link
   */
  const verifyEmail = async (verificationToken) => {
    const res = await apiClient.post('/auth/verify-email', { token: verificationToken });
    return res.data;
  };

  /**
   * Resend Verification Email
   */
  const resendVerification = async (email) => {
    const res = await apiClient.post('/auth/resend-verification', { email });
    return res.data;
  };

  /**
   * Request Password Reset Email
   */
  const forgotPassword = async (email) => {
    const res = await apiClient.post('/auth/forgot-password', { email });
    return res.data;
  };

  /**
   * Reset Password with Token
   */
  const resetPassword = async (resetToken, newPassword, confirmPassword) => {
    const res = await apiClient.post('/auth/reset-password', {
      token: resetToken,
      newPassword,
      confirmPassword,
    });
    return res.data;
  };

  /**
   * Authenticated Password Change
   */
  const changePassword = async (currentPassword, newPassword, confirmPassword) => {
    const res = await apiClient.post('/auth/change-password', {
      currentPassword,
      newPassword,
      confirmPassword,
    });
    if (res.data?.success && res.data?.token) {
      setToken(res.data.token);
    }
    return res.data;
  };

  /**
   * Legacy Phone Account Claim: Step 1 (Request OTP)
   */
  const claimLegacyRequestOtp = async (phone) => {
    const res = await apiClient.post('/auth/claim/request-otp', { phone });
    return res.data;
  };

  /**
   * Legacy Phone Account Claim: Step 2 (Complete Migration)
   */
  const claimLegacyComplete = async (claimData) => {
    const res = await apiClient.post('/auth/claim/complete', claimData);
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
   * Backward-compatible OTP helpers (for tests & legacy components)
   */
  const requestOtp = async (phone) => {
    const res = await apiClient.post('/auth/otp/request', { phone });
    return res.data;
  };

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
   * Update personal profile (name, avatar, sound)
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

  /**
   * Logout from all devices
   */
  const logoutAll = async () => {
    try {
      await apiClient.post('/auth/logout-all');
    } catch {
      // Ignore network errors
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
        register,
        login,
        verifyEmail,
        resendVerification,
        forgotPassword,
        resetPassword,
        changePassword,
        claimLegacyRequestOtp,
        claimLegacyComplete,
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
        logoutAll,
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
