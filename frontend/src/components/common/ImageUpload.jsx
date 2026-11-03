/**
 * Reusable Production-Ready Image Upload Component.
 *
 * Implements:
 * - Direct file selection (Windows/macOS file dialog, Android/iOS gallery/camera).
 * - Drag-and-drop file uploading with visual drag-over state.
 * - Live image preview with aspect ratio fit and clear/remove action.
 * - Upload progress bar, loading spinner, and success/error toasts.
 * - Image replacement with safe preservation of previous image if upload fails.
 * - Optional Image URL mode fallback.
 * - Client-side validation: 5 MB limit, whitelisted JPEG/PNG/WebP types.
 *
 * @module components/common/ImageUpload
 */

import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, Image as ImageIcon, X, CheckCircle2, AlertCircle, RefreshCw, Link as LinkIcon, FileCheck } from 'lucide-react';
import { apiClient, resolveImageUrl, getApiUploadUrl } from '../../config/api.js';

export function ImageUpload({
  value = '',
  onChange,
  label = 'Product Image',
  hint = 'Recommended: 800x800px or 1:1 square. Max 5 MB (JPEG, PNG, WebP).',
  required = false,
  className = '',
  /**
   * Upload subfolder on the VPS: 'products' | 'categories' | 'banners' | 'customers' | 'admin'.
   * If provided, the image is POSTed to /v1/upload/{folder} (e.g. /v1/upload/banners) which stores
   * it in the dedicated subfolder (/uploads/banners/) instead of the generic /uploads/products/.
   * If omitted, falls back to the general /v1/upload/image endpoint (products subfolder).
   */
  uploadFolder = '',
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [mode, setMode] = useState('upload'); // 'upload' | 'url'
  const [manualUrl, setManualUrl] = useState(value || '');
  const [imageLoadFailed, setImageLoadFailed] = useState(false);

  const fileInputRef = useRef(null);
  const fallbackAttemptedRef = useRef(false);

  // Reset one-time fallback tracking and error state when the image value changes
  useEffect(() => {
    fallbackAttemptedRef.current = false;
    setImageLoadFailed(false);
  }, [value]);

  // Allowlist for dedicated storage subfolders
  const ALLOWED_UPLOAD_FOLDERS = ['products', 'categories', 'banners'];
  const safeFolder = ALLOWED_UPLOAD_FOLDERS.includes(uploadFolder) ? uploadFolder : '';

  // Validate file size and mime before uploading
  const validateFile = (file) => {
    if (!file) return 'No file selected.';
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return 'Invalid format. Only JPEG, PNG, and WebP images are permitted.';
    }
    const maxSizeBytes = 5 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return 'File size exceeds 5 MB. Please compress or choose a smaller image.';
    }
    return null;
  };

  const uploadFile = async (file) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    setSuccess('');
    setUploading(true);
    setProgress(15);

    const formData = new FormData();
    formData.append('file', file);

    try {
      setProgress(45);
      // Dedicated upload endpoints for validated folders; fall back to general /v1/upload/image
      const uploadEndpoint = safeFolder
        ? `/v1/upload/${safeFolder}`
        : '/v1/upload/image';
      const res = await apiClient.post(uploadEndpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percent = Math.round((progressEvent.loaded * 90) / progressEvent.total);
            setProgress(Math.max(20, percent));
          }
        },
      });

      if (res.data?.success && res.data?.data?.url) {
        setProgress(100);
        const uploadedUrl = res.data.data.url;
        onChange(uploadedUrl);
        setManualUrl(uploadedUrl);
        setSuccess('Image uploaded and secured successfully!');
        setTimeout(() => setSuccess(''), 3500);
      } else {
        // Preserve previous image on failure
        setError(res.data?.message || 'Upload failed. Previous image was retained.');
      }
    } catch (err) {
      // Preserve previous image on error
      const serverMsg = err.response?.data?.message || err.message || 'Network error during upload. Previous image was retained.';
      setError(serverMsg);
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadFile(file);
    }
    // Reset file input so re-selecting same file triggers change
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      uploadFile(file);
    }
  };

  const handleRemove = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onChange('');
    setManualUrl('');
    setError('');
    setSuccess('');
  };

  const handleManualUrlSubmit = (e) => {
    e.preventDefault();
    if (!manualUrl.trim()) {
      onChange('');
      return;
    }
    onChange(manualUrl.trim());
    setSuccess('Image URL updated.');
    setTimeout(() => setSuccess(''), 3000);
  };

  // Resolve preview image URL using centralized resolver
  const previewUrl = resolveImageUrl(value);

  const handleImageError = (e) => {
    // Only attempt the API proxy fallback once per image value
    if (!fallbackAttemptedRef.current) {
      fallbackAttemptedRef.current = true;
      const apiFallback = getApiUploadUrl(value);
      if (apiFallback && apiFallback !== previewUrl && apiFallback !== e.currentTarget.src) {
        e.currentTarget.src = apiFallback;
        return;
      }
    }
    setImageLoadFailed(true);
    setError('File saved on server, but browser could not render preview. Verify Nginx /uploads proxy.');
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between">
        <label className="block text-[11px] font-semibold text-text-main">
          {label} {required && <span className="text-status-error">*</span>}
        </label>
        <div className="flex items-center gap-1.5 text-[10px]">
          <button
            type="button"
            onClick={() => setMode('upload')}
            className={`px-2 py-0.5 rounded-md transition font-medium ${
              mode === 'upload'
                ? 'bg-brand text-white shadow-xs'
                : 'text-text-muted hover:text-text-main hover:bg-surface-subtle'
            }`}
          >
            File Upload
          </button>
          <button
            type="button"
            onClick={() => setMode('url')}
            className={`px-2 py-0.5 rounded-md transition font-medium ${
              mode === 'url'
                ? 'bg-brand text-white shadow-xs'
                : 'text-text-muted hover:text-text-main hover:bg-surface-subtle'
            }`}
          >
            External URL
          </button>
        </div>
      </div>

      {mode === 'upload' ? (
        <div className="space-y-2">
          {/* File Droppable Area */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative border-2 border-dashed rounded-2xl p-4 sm:p-5 text-center transition cursor-pointer flex flex-col items-center justify-center min-h-[140px] ${
              isDragging
                ? 'border-brand bg-brand-light/30 ring-2 ring-brand/20'
                : previewUrl
                ? 'border-border-neutral bg-surface hover:bg-surface-subtle'
                : 'border-border-neutral bg-primary-bg hover:border-brand/50 hover:bg-surface-subtle'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              className="hidden"
            />

            {previewUrl ? (
              <div className="relative group w-full flex items-center justify-center">
                <div className="relative max-h-48 max-w-full rounded-xl overflow-hidden shadow-xs border border-border-neutral bg-white p-1">
                  {imageLoadFailed ? (
                    <div className="w-48 h-32 flex flex-col items-center justify-center p-3 text-center bg-surface-subtle text-text-muted rounded-lg border border-dashed border-border-neutral">
                      <AlertCircle className="w-6 h-6 text-status-error mb-1 shrink-0" />
                      <span className="text-xs font-semibold text-text-main">Preview Unavailable</span>
                      <span className="text-[10px] text-text-muted mt-0.5 max-w-[170px] truncate">{value}</span>
                    </div>
                  ) : (
                    <img
                      key={previewUrl}
                      src={previewUrl}
                      alt="Uploaded preview"
                      className="max-h-40 max-w-full object-contain rounded-lg mx-auto"
                      onError={handleImageError}
                    />
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2 rounded-xl">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                      className="px-3 py-1.5 rounded-lg bg-surface text-text-main text-xs font-semibold hover:bg-white flex items-center gap-1 shadow-md transition"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-brand" />
                      <span>Replace</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleRemove}
                      className="p-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 shadow-md transition"
                      title="Remove Image"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2 py-2">
                <div className="w-11 h-11 rounded-2xl bg-brand-light text-brand flex items-center justify-center mx-auto shadow-xs">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-bold text-text-main">
                    Click to select from device or drag image here
                  </p>
                  <p className="text-[11px] text-text-muted mt-0.5">{hint}</p>
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-surface border border-border-neutral text-[11px] font-semibold text-brand shadow-xs">
                  <FileCheck className="w-3.5 h-3.5" />
                  <span>Choose from Computer or Phone</span>
                </div>
              </div>
            )}

            {/* Progress overlay */}
            {uploading && (
              <div className="absolute inset-0 bg-surface/90 backdrop-blur-2xs rounded-2xl flex flex-col items-center justify-center p-4 z-10 animate-fadeIn">
                <RefreshCw className="w-6 h-6 text-brand animate-spin mb-2" />
                <span className="text-xs font-bold text-text-main">Uploading & Validating Image...</span>
                <div className="w-48 bg-border-neutral rounded-full h-1.5 mt-2 overflow-hidden">
                  <div
                    className="bg-brand h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* External URL Mode Fallback */
        <div className="space-y-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <LinkIcon className="absolute left-3 top-2.5 w-3.5 h-3.5 text-text-muted" />
              <input
                type="url"
                value={manualUrl}
                onChange={(e) => setManualUrl(e.target.value)}
                placeholder="https://images.unsplash.com/..."
                className="w-full pl-8 pr-3 py-2 bg-primary-bg border border-border-neutral rounded-xl text-xs text-text-main placeholder:text-text-muted focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
              />
            </div>
            <button
              type="button"
              onClick={handleManualUrlSubmit}
              className="px-3 py-2 bg-surface hover:bg-surface-subtle border border-border-neutral rounded-xl text-xs font-semibold text-brand transition"
            >
              Apply
            </button>
          </div>
          {previewUrl && (
            <div className="p-2 bg-surface border border-border-neutral rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                {imageLoadFailed ? (
                  <div className="w-10 h-10 rounded-lg bg-surface-subtle border border-border-neutral flex items-center justify-center text-status-error shrink-0">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                ) : (
                  <img
                    key={previewUrl}
                    src={previewUrl}
                    alt="Preview"
                    className="w-10 h-10 object-contain rounded-lg border border-border-neutral bg-white"
                    onError={handleImageError}
                  />
                )}
                <span className="text-[11px] text-text-muted truncate max-w-[200px]">{previewUrl}</span>
              </div>
              <button
                type="button"
                onClick={handleRemove}
                className="p-1 rounded-lg text-text-muted hover:text-status-error hover:bg-red-50 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Notifications */}
      {error && (
        <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-[11px] text-status-error animate-fadeIn">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-[11px] text-status-success animate-fadeIn">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span>{success}</span>
        </div>
      )}
    </div>
  );
}
