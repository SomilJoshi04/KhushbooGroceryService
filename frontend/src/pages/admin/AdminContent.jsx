/**
 * Admin Content Management Page — Privacy Policy, FAQs, and Help & Support Tickets.
 *
 * Implements:
 * - Responsive mobile tab navigation with smooth horizontal scroll and clear active indicators.
 * - Privacy Policy editor with Drafts, Live Customer Preview, and Version History.
 * - Categorized FAQs CRUD with publication toggle and individual + bulk selection/actions.
 * - Help & Support contact channel settings and Customer Support Inquiries Inbox.
 * - Robust Support Ticket Lifecycle: OPEN, IN_PROGRESS, RESOLVED, CLOSED, REJECTED.
 * - Dedicated Rejection Workflow with mandatory audit reason and optional internal note.
 * - Reversible soft deletion with audit trail preservation and confirmation dialogs.
 * - Production-ready Bulk Selection with Mode A (current page) and Mode B (all matching).
 *
 * @module pages/admin/AdminContent
 */

import React, { useState, useEffect } from 'react';
import {
  FileText,
  Scale,
  HelpCircle,
  Headphones,
  Save,
  Send,
  Eye,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  Clock,
  AlertCircle,
  X,
  Loader2,
  Inbox,
  Check,
  ChevronDown,
  ChevronUp,
  Tag,
  ShieldCheck,
  MessageSquare,
  Ban,
  CheckSquare,
  Square,
  AlertTriangle,
  RotateCcw,
  EyeOff,
  Phone,
  PhoneOff,
} from 'lucide-react';
import { apiClient } from '../../config/api.js';
import { useBulkSelection } from '../../hooks/useBulkSelection.js';
import { BulkActionBar } from '../../components/BulkActionBar.jsx';
import { BulkConfirmModal } from '../../components/BulkConfirmModal.jsx';

export function AdminContent() {
  const [activeTab, setActiveTab] = useState('privacy'); // 'privacy' | 'terms' | 'faqs' | 'support'
  const [notification, setNotification] = useState(null);
  const [loading, setLoading] = useState(false);

  // ── 1. Privacy Policy State ──
  const [policyData, setPolicyData] = useState(null);
  const [draftContent, setDraftContent] = useState('');
  const [policyTitle, setPolicyTitle] = useState('');
  const [publishVersion, setPublishVersion] = useState('');
  const [changeSummary, setChangeSummary] = useState('');
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  // ── 1b. Terms & Conditions State ──
  const [termsData, setTermsData] = useState(null);
  const [termsDraftContent, setTermsDraftContent] = useState('');
  const [termsTitle, setTermsTitle] = useState('');
  const [publishTermsVersion, setPublishTermsVersion] = useState('');
  const [termsChangeSummary, setTermsChangeSummary] = useState('');
  const [showPublishTermsModal, setShowPublishTermsModal] = useState(false);
  const [termsPreviewMode, setTermsPreviewMode] = useState(false);

  // ── 2. FAQ State & Bulk Selection ──
  const [faqs, setFaqs] = useState([]);
  const [faqCategoryFilter, setFaqCategoryFilter] = useState('ALL');
  const [editingFaq, setEditingFaq] = useState(null);
  const [faqModalOpen, setFaqModalOpen] = useState(false);
  const [faqForm, setFaqForm] = useState({
    question: '',
    answer: '',
    category: 'General',
    order: 0,
    isPublished: true,
  });
  const faqBulk = useBulkSelection(faqs.length);

  // ── 3. Help & Support State, Ticket Lifecycle & Bulk Selection ──
  const [supportSettings, setSupportSettings] = useState({
    verifiedPhone: '+91 98260 12345',
    verifiedEmail: 'support@khushboofood.com',
    businessHours: 'Monday to Sunday: 7:00 AM – 10:00 PM IST',
    instructions: '',
    escalationPolicy: '',
  });
  const [inquiries, setInquiries] = useState([]);
  const [inquiryStatusFilter, setInquiryStatusFilter] = useState('ALL');
  const [inquirySearch, setInquirySearch] = useState('');
  const [selectedInquiry, setSelectedInquiry] = useState(null);
  const [inquiryNotes, setInquiryNotes] = useState('');
  const [newInternalNote, setNewInternalNote] = useState('');
  const [revealedPhones, setRevealedPhones] = useState({});

  // Individual Ticket Rejection & Deletion Modals
  const [rejectModalInquiry, setRejectModalInquiry] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectInternalNote, setRejectInternalNote] = useState('');
  const [deleteModalInquiry, setDeleteModalInquiry] = useState(null);

  // Support Tickets Bulk Selection
  const inquiryBulk = useBulkSelection(inquiries.length);

  // Global Bulk Confirmation Modal State
  const [bulkConfirmConfig, setBulkConfirmConfig] = useState(null);
  const [bulkResultSummary, setBulkResultSummary] = useState(null);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  const showNotification = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4500);
  };

  const togglePhoneReveal = (id) => {
    setRevealedPhones((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // ── Fetch Policy ──
  const fetchPolicy = async () => {
    try {
      const res = await apiClient.get('/v1/admin/content/privacy-policy');
      if (res.data?.success && res.data?.data) {
        setPolicyData(res.data.data);
        setDraftContent(res.data.data.draftContent || res.data.data.content || '');
        setPolicyTitle(res.data.data.title || 'Privacy Policy');
      }
    } catch {
      showNotification('Failed to load Privacy Policy.', 'error');
    }
  };

  // ── Fetch Terms & Conditions ──
  const fetchTerms = async () => {
    try {
      const res = await apiClient.get('/v1/admin/content/terms');
      if (res.data?.success && res.data?.data) {
        setTermsData(res.data.data);
        setTermsDraftContent(res.data.data.draftContent || res.data.data.content || '');
        setTermsTitle(res.data.data.title || 'Terms & Conditions');
      }
    } catch {
      showNotification('Failed to load Terms & Conditions.', 'error');
    }
  };

  // ── Fetch FAQs ──
  const fetchFaqs = async () => {
    try {
      const params = {};
      if (faqCategoryFilter !== 'ALL') params.category = faqCategoryFilter;
      const res = await apiClient.get('/v1/admin/content/faqs', { params });
      if (res.data?.success) {
        setFaqs(res.data.data || []);
        faqBulk.clearSelection();
      }
    } catch {
      showNotification('Failed to load FAQs.', 'error');
    }
  };

  // ── Fetch Support Settings & Inquiries ──
  const fetchSupport = async () => {
    try {
      const res = await apiClient.get('/v1/admin/content/support');
      if (res.data?.success && res.data?.data) {
        setSupportSettings(res.data.data);
      }
    } catch {
      showNotification('Failed to load support settings.', 'error');
    }
  };

  const fetchInquiries = async () => {
    try {
      const params = {};
      if (inquiryStatusFilter !== 'ALL') params.status = inquiryStatusFilter;
      if (inquirySearch.trim()) params.search = inquirySearch.trim();
      const res = await apiClient.get('/v1/admin/content/inquiries', { params });
      if (res.data?.success) {
        setInquiries(res.data.data || []);
        inquiryBulk.clearSelection();
      }
    } catch {
      showNotification('Failed to load customer inquiries.', 'error');
    }
  };

  useEffect(() => {
    if (activeTab === 'privacy') fetchPolicy();
    if (activeTab === 'terms') fetchTerms();
    if (activeTab === 'faqs') fetchFaqs();
    if (activeTab === 'support') {
      fetchSupport();
      fetchInquiries();
    }
  }, [activeTab, faqCategoryFilter, inquiryStatusFilter]);

  // ── Policy Actions ──
  const handleSavePolicyDraft = async () => {
    setLoading(true);
    try {
      const res = await apiClient.put('/v1/admin/content/privacy-policy/draft', {
        title: policyTitle,
        draftContent,
      });
      showNotification(res.data.message || 'Draft saved successfully.', 'success');
      fetchPolicy();
    } catch (err) {
      showNotification(err.response?.data?.message || err.message || 'Failed to save draft.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePublishPolicy = async () => {
    setLoading(true);
    try {
      const res = await apiClient.post('/v1/admin/content/privacy-policy/publish', {
        version: publishVersion.trim() || undefined,
        changeSummary,
      });
      showNotification(res.data.message || 'Policy published.', 'success');
      setShowPublishModal(false);
      setChangeSummary('');
      fetchPolicy();
    } catch (err) {
      showNotification(err.response?.data?.message || err.message || 'Failed to publish policy.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // ── Terms & Conditions Actions ──
  const handleSaveTermsDraft = async () => {
    setLoading(true);
    try {
      const res = await apiClient.put('/v1/admin/content/terms/draft', {
        title: termsTitle,
        draftContent: termsDraftContent,
      });
      showNotification(res.data.message || 'Terms draft saved successfully.', 'success');
      fetchTerms();
    } catch (err) {
      showNotification(err.response?.data?.message || err.message || 'Failed to save terms draft.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePublishTerms = async () => {
    setLoading(true);
    try {
      const res = await apiClient.post('/v1/admin/content/terms/publish', {
        version: publishTermsVersion.trim() || undefined,
        changeSummary: termsChangeSummary,
      });
      showNotification(res.data.message || 'Terms & Conditions published.', 'success');
      setShowPublishTermsModal(false);
      setTermsChangeSummary('');
      fetchTerms();
    } catch (err) {
      showNotification(err.response?.data?.message || err.message || 'Failed to publish terms.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // ── FAQ Actions ──
  const handleSaveFaq = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      let res;
      if (editingFaq) {
        res = await apiClient.patch(`/v1/admin/content/faqs/${editingFaq._id}`, faqForm);
      } else {
        res = await apiClient.post('/v1/admin/content/faqs', faqForm);
      }

      showNotification(res.data.message || 'FAQ saved successfully.', 'success');
      setFaqModalOpen(false);
      setEditingFaq(null);
      fetchFaqs();
    } catch (err) {
      showNotification(err.response?.data?.message || err.message || 'Failed to save FAQ.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFaq = async (id) => {
    if (!window.confirm('Are you sure you want to delete this FAQ?')) return;
    try {
      const res = await apiClient.delete(`/v1/admin/content/faqs/${id}`);
      showNotification(res.data.message || 'FAQ deleted.', 'success');
      fetchFaqs();
    } catch (err) {
      showNotification(err.response?.data?.message || err.message || 'Error deleting FAQ.', 'error');
    }
  };

  // ── FAQ Bulk Operations ──
  const handleTriggerBulkFaqPublish = (isPublished) => {
    setBulkConfirmConfig({
      title: isPublished ? 'Publish Selected FAQs' : 'Unpublish Selected FAQs',
      description: `You are about to ${isPublished ? 'publish' : 'hide'} ${faqBulk.selectedCount} FAQ item(s).`,
      affectedCount: faqBulk.selectedCount,
      itemName: 'FAQs',
      confirmLabel: isPublished ? 'Publish Selected' : 'Unpublish Selected',
      confirmVariant: isPublished ? 'primary' : 'warning',
      requireReason: false,
      reversibilityNotice: 'This operation will update the visibility on the customer storefront immediately.',
      onConfirm: async () => {
        setBulkActionLoading(true);
        try {
          const res = await apiClient.post('/v1/admin/content/faqs/bulk-status', {
            ids: faqBulk.selectedIds,
            selectAllMatching: faqBulk.selectAllMatching,
            filter: { category: faqCategoryFilter },
            isPublished,
          });
          setBulkResultSummary(res.data);
        } catch (err) {
          showNotification(err.response?.data?.message || 'Bulk FAQ update failed.', 'error');
          setBulkConfirmConfig(null);
        } finally {
          setBulkActionLoading(false);
        }
      },
    });
  };

  const handleTriggerBulkFaqDelete = () => {
    setBulkConfirmConfig({
      title: 'Delete Selected FAQs',
      description: `Are you sure you want to delete ${faqBulk.selectedCount} FAQ item(s)?`,
      affectedCount: faqBulk.selectedCount,
      itemName: 'FAQs',
      confirmLabel: 'Delete FAQs',
      confirmVariant: 'danger',
      requireReason: false,
      reversibilityNotice: 'Selected FAQ items will be permanently removed. Audit logs will record this action.',
      onConfirm: async () => {
        setBulkActionLoading(true);
        try {
          const res = await apiClient.post('/v1/admin/content/faqs/bulk-delete', {
            ids: faqBulk.selectedIds,
            selectAllMatching: faqBulk.selectAllMatching,
            filter: { category: faqCategoryFilter },
          });
          setBulkResultSummary(res.data);
        } catch (err) {
          showNotification(err.response?.data?.message || 'Bulk FAQ deletion failed.', 'error');
          setBulkConfirmConfig(null);
        } finally {
          setBulkActionLoading(false);
        }
      },
    });
  };

  // ── Support Settings Actions ──
  const handleSaveSupport = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiClient.put('/v1/admin/content/support', supportSettings);
      showNotification(res.data.message || 'Support settings updated.', 'success');
      fetchSupport();
    } catch (err) {
      showNotification(err.response?.data?.message || err.message || 'Error saving support settings.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // ── Support Ticket Lifecycle Actions ──
  const handleUpdateInquiryStatus = async (status) => {
    if (!selectedInquiry) return;
    try {
      const res = await apiClient.patch(`/v1/admin/content/inquiries/${selectedInquiry._id}/status`, {
        status,
        responseNotes: inquiryNotes,
      });
      if (res.data?.success) {
        showNotification(res.data.message, 'success');
        setSelectedInquiry(null);
        fetchInquiries();
      }
    } catch (err) {
      showNotification(err.response?.data?.message || err.message || 'Error updating status.', 'error');
    }
  };

  const handleAddInternalNote = async () => {
    if (!selectedInquiry || !newInternalNote.trim()) return;
    try {
      const res = await apiClient.post(`/v1/admin/content/inquiries/${selectedInquiry._id}/notes`, {
        note: newInternalNote.trim(),
      });
      if (res.data?.success) {
        showNotification('Internal note added to ticket history.', 'success');
        setSelectedInquiry(res.data.data);
        setNewInternalNote('');
        fetchInquiries();
      }
    } catch (err) {
      showNotification(err.response?.data?.message || 'Failed to add note.', 'error');
    }
  };

  const handleConfirmRejectTicket = async (e) => {
    e.preventDefault();
    if (!rejectModalInquiry || !rejectReason.trim()) return;
    setLoading(true);
    try {
      const res = await apiClient.post(`/v1/admin/content/inquiries/${rejectModalInquiry._id}/reject`, {
        rejectionReason: rejectReason.trim(),
        internalNote: rejectInternalNote.trim(),
      });
      if (res.data?.success) {
        showNotification(res.data.message || 'Ticket has been rejected.', 'success');
        setRejectModalInquiry(null);
        setRejectReason('');
        setRejectInternalNote('');
        if (selectedInquiry?._id === rejectModalInquiry._id) {
          setSelectedInquiry(null);
        }
        fetchInquiries();
      }
    } catch (err) {
      showNotification(err.response?.data?.message || 'Failed to reject ticket.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDeleteTicket = async () => {
    if (!deleteModalInquiry) return;
    setLoading(true);
    try {
      const res = await apiClient.delete(`/v1/admin/content/inquiries/${deleteModalInquiry._id}`);
      if (res.data?.success) {
        showNotification(res.data.message || 'Ticket has been soft-deleted.', 'success');
        setDeleteModalInquiry(null);
        if (selectedInquiry?._id === deleteModalInquiry._id) {
          setSelectedInquiry(null);
        }
        fetchInquiries();
      }
    } catch (err) {
      showNotification(err.response?.data?.message || 'Failed to delete ticket.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // ── Support Tickets Bulk Operations ──
  const handleTriggerBulkInquiryStatus = (targetStatus) => {
    const actionLabel = targetStatus === 'RESOLVED' ? 'Mark Resolved' : 'Close Tickets';
    setBulkConfirmConfig({
      title: `Bulk ${actionLabel}`,
      description: `You are about to mark ${inquiryBulk.selectedCount} ticket(s) as ${targetStatus}.`,
      affectedCount: inquiryBulk.selectedCount,
      itemName: 'support tickets',
      confirmLabel: actionLabel,
      confirmVariant: targetStatus === 'RESOLVED' ? 'primary' : 'warning',
      requireReason: false,
      reversibilityNotice: 'Tickets will transition to the selected state with audit timeline entries.',
      onConfirm: async () => {
        setBulkActionLoading(true);
        try {
          const res = await apiClient.post('/v1/admin/content/inquiries/bulk-status', {
            ids: inquiryBulk.selectedIds,
            selectAllMatching: inquiryBulk.selectAllMatching,
            filter: { status: inquiryStatusFilter },
            status: targetStatus,
          });
          setBulkResultSummary(res.data);
        } catch (err) {
          showNotification(err.response?.data?.message || 'Bulk ticket status update failed.', 'error');
          setBulkConfirmConfig(null);
        } finally {
          setBulkActionLoading(false);
        }
      },
    });
  };

  const handleTriggerBulkInquiryReject = () => {
    setBulkConfirmConfig({
      title: 'Bulk Reject Support Tickets',
      description: `You are about to reject ${inquiryBulk.selectedCount} support ticket(s). A mandatory audit reason is required.`,
      affectedCount: inquiryBulk.selectedCount,
      itemName: 'support tickets',
      confirmLabel: 'Reject Selected Tickets',
      confirmVariant: 'danger',
      requireReason: true,
      reasonPlaceholder: 'Enter mandatory rejection reason (e.g. Duplicate request, Spam, Invalid inquiry)...',
      reversibilityNotice: 'Tickets will be marked as REJECTED with the recorded reason. Rejected tickets remain accessible for review.',
      onConfirm: async (reason) => {
        setBulkActionLoading(true);
        try {
          const res = await apiClient.post('/v1/admin/content/inquiries/bulk-reject', {
            ids: inquiryBulk.selectedIds,
            selectAllMatching: inquiryBulk.selectAllMatching,
            filter: { status: inquiryStatusFilter },
            rejectionReason: reason,
          });
          setBulkResultSummary(res.data);
        } catch (err) {
          showNotification(err.response?.data?.message || 'Bulk ticket rejection failed.', 'error');
          setBulkConfirmConfig(null);
        } finally {
          setBulkActionLoading(false);
        }
      },
    });
  };

  const handleTriggerBulkInquiryDelete = () => {
    setBulkConfirmConfig({
      title: 'Bulk Delete Support Tickets',
      description: `Are you sure you want to soft-delete ${inquiryBulk.selectedCount} support ticket(s)?`,
      affectedCount: inquiryBulk.selectedCount,
      itemName: 'support tickets',
      confirmLabel: 'Delete Selected Tickets',
      confirmVariant: 'danger',
      requireReason: false,
      reversibilityNotice: 'Tickets will be soft-deleted and hidden from active inboxes. Full audit trail and history are preserved.',
      onConfirm: async () => {
        setBulkActionLoading(true);
        try {
          const res = await apiClient.post('/v1/admin/content/inquiries/bulk-delete', {
            ids: inquiryBulk.selectedIds,
            selectAllMatching: inquiryBulk.selectAllMatching,
            filter: { status: inquiryStatusFilter },
          });
          setBulkResultSummary(res.data);
        } catch (err) {
          showNotification(err.response?.data?.message || 'Bulk ticket deletion failed.', 'error');
          setBulkConfirmConfig(null);
        } finally {
          setBulkActionLoading(false);
        }
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`p-4 rounded-xl border text-xs font-semibold flex items-center justify-between shadow-md animate-fadeIn ${
            notification.type === 'error'
              ? 'bg-status-error/10 border-status-error/30 text-status-error'
              : 'bg-status-success/10 border-status-success/30 text-status-success'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'error' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
            <span>{notification.msg}</span>
          </div>
          <button type="button" onClick={() => setNotification(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Page Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold font-heading text-text-main">Website Content Management</h1>
        <p className="text-xs text-text-muted mt-1">
          Publish legal policies with revision control, maintain categorized FAQs, and manage live customer support tickets.
        </p>
      </div>

      {/* ── Redesigned Responsive Mobile Tab Navigation ── */}
      <div className="flex items-center gap-1.5 sm:gap-2 border-b border-border-neutral overflow-x-auto pb-1 no-scrollbar">
        {[
          { id: 'privacy', label: 'Privacy Policy', icon: FileText },
          { id: 'terms', label: 'Terms & Conditions', icon: Scale },
          { id: 'faqs', label: 'Frequently Asked Questions', icon: HelpCircle, badge: faqs.length },
          { id: 'support', label: 'Help, Support & Inquiries', icon: Headphones, badge: inquiries.length },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 sm:px-4 py-2.5 sm:py-3 text-xs font-bold border-b-2 transition whitespace-nowrap shrink-0 rounded-t-xl ${
                isActive
                  ? 'border-brand text-brand bg-brand-light/40 shadow-2xs'
                  : 'border-transparent text-text-muted hover:text-text-main hover:bg-surface-subtle/50'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0 text-brand" />
              <span>{tab.label}</span>
              {tab.badge !== undefined && tab.badge > 0 && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                    isActive ? 'bg-brand text-white' : 'bg-surface-subtle text-text-muted border border-border-neutral'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── TAB 1: PRIVACY POLICY ── */}
      {activeTab === 'privacy' && (
        <div className="space-y-5">
          {/* Status & Action Bar */}
          <div className="p-4 bg-surface border border-border-neutral rounded-2xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <span className="text-xs font-bold text-text-main">
                Current Version: <span className="font-mono text-brand font-bold">{policyData?.version || '1.0'}</span>
              </span>
              {policyData?.hasUnpublishedChanges ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-status-warning/10 text-status-warning border border-status-warning/20">
                  Unpublished Draft Changes
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-status-success/10 text-status-success border border-status-success/20">
                  Published & Live
                </span>
              )}
              {policyData?.publishedAt && (
                <span className="text-[11px] text-text-muted hidden md:inline">
                  Last Published: {new Date(policyData.publishedAt).toLocaleDateString()}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setPreviewMode(!previewMode)}
                className="px-3 py-1.5 rounded-xl border border-border-neutral text-xs font-semibold text-text-main hover:bg-surface-subtle transition flex items-center gap-1.5"
              >
                <Eye className="w-3.5 h-3.5 text-text-muted" />
                <span>{previewMode ? 'Edit Draft' : 'Customer Preview'}</span>
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={handleSavePolicyDraft}
                className="px-3.5 py-1.5 rounded-xl bg-surface hover:bg-surface-subtle border border-border-neutral text-text-main text-xs font-semibold transition flex items-center gap-1.5 disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5 text-brand" />
                <span>Save Draft</span>
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={() => setShowPublishModal(true)}
                className="px-4 py-1.5 rounded-xl bg-brand hover:bg-brand-hover text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Publish Policy</span>
              </button>
            </div>
          </div>

          {/* Policy Title Field */}
          <div className="p-4 bg-surface border border-border-neutral rounded-2xl shadow-xs space-y-2">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-text-muted">
              Document Legal Title
            </label>
            <input
              type="text"
              value={policyTitle}
              onChange={(e) => setPolicyTitle(e.target.value)}
              className="w-full px-3 py-2 bg-primary-bg border border-border-neutral rounded-xl text-xs font-bold text-text-main focus:outline-none focus:border-brand"
            />
          </div>

          {/* Editor or Preview Pane */}
          {previewMode ? (
            <div className="p-6 bg-surface border border-border-neutral rounded-2xl shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-border-neutral pb-3">
                <span className="text-xs font-bold text-text-muted uppercase tracking-wider">
                  Live Customer Storefront Preview
                </span>
                <span className="text-[11px] font-mono text-brand font-bold">
                  Effective: {new Date().toLocaleDateString()}
                </span>
              </div>
              <div className="prose prose-sm max-w-none text-text-main whitespace-pre-wrap font-sans text-xs sm:text-sm leading-relaxed">
                {draftContent}
              </div>
            </div>
          ) : (
            <div className="p-4 sm:p-5 bg-surface border border-border-neutral rounded-2xl shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
                  Markdown Policy Content & Legal Sections
                </label>
                <span className="text-[10px] text-text-muted">Standard Markdown supported</span>
              </div>
              <textarea
                rows={16}
                value={draftContent}
                onChange={(e) => setDraftContent(e.target.value)}
                className="w-full p-4 bg-primary-bg border border-border-neutral rounded-xl text-xs font-mono text-text-main focus:outline-none focus:border-brand leading-relaxed"
                placeholder="Write your Privacy Policy content here..."
              />
            </div>
          )}

          {/* Revision History */}
          {policyData?.history && policyData.history.length > 0 && (
            <div className="p-4 sm:p-5 bg-surface border border-border-neutral rounded-2xl shadow-xs space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted">
                Audit Revision History
              </h3>
              <div className="divide-y divide-border-neutral">
                {policyData.history.map((rev, idx) => (
                  <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-mono font-bold text-brand mr-2">v{rev.version}</span>
                      <span className="text-text-main">{rev.changeSummary || 'Policy published.'}</span>
                    </div>
                    <span className="text-[11px] text-text-muted font-mono">
                      {new Date(rev.publishedAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Publish Modal */}
          {showPublishModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-text-main/50 backdrop-blur-xs animate-fadeIn">
              <div className="bg-surface rounded-2xl border border-border-neutral shadow-2xl w-full max-w-md p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-border-neutral pb-3">
                  <h3 className="text-base font-bold font-heading text-text-main">Publish Privacy Policy</h3>
                  <button type="button" onClick={() => setShowPublishModal(false)}>
                    <X className="w-4 h-4 text-text-muted" />
                  </button>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-bold text-text-main mb-1">
                      New Version Number (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 1.1 or 2.0 (defaults to auto-increment)"
                      value={publishVersion}
                      onChange={(e) => setPublishVersion(e.target.value)}
                      className="w-full px-3 py-2 bg-primary-bg border border-border-neutral rounded-xl text-xs text-text-main focus:outline-none focus:border-brand font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-text-main mb-1">
                      Revision Summary for Audit Log
                    </label>
                    <textarea
                      rows={3}
                      placeholder="e.g. Updated delivery data collection disclosures for Indore zones..."
                      value={changeSummary}
                      onChange={(e) => setChangeSummary(e.target.value)}
                      className="w-full px-3 py-2 bg-primary-bg border border-border-neutral rounded-xl text-xs text-text-main focus:outline-none focus:border-brand"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-neutral">
                  <button
                    type="button"
                    onClick={() => setShowPublishModal(false)}
                    className="px-4 py-2 border border-border-neutral text-xs font-semibold text-text-muted hover:text-text-main rounded-xl hover:bg-surface-subtle transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={handlePublishPolicy}
                    className="px-5 py-2 bg-brand hover:bg-brand-hover text-white text-xs font-bold rounded-xl transition shadow-xs flex items-center gap-1.5"
                  >
                    {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Confirm & Make Live</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: TERMS & CONDITIONS ── */}
      {activeTab === 'terms' && (
        <div className="space-y-5">
          {/* Status & Action Bar */}
          <div className="p-4 bg-surface border border-border-neutral rounded-2xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <span className="text-xs font-bold text-text-main">
                Current Version: <span className="font-mono text-brand font-bold">{termsData?.version || '1.0'}</span>
              </span>
              {termsData?.hasUnpublishedChanges ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-status-warning/10 text-status-warning border border-status-warning/20">
                  Unpublished Draft Changes
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-status-success/10 text-status-success border border-status-success/20">
                  Published & Live
                </span>
              )}
              {termsData?.publishedAt && (
                <span className="text-[11px] text-text-muted hidden md:inline">
                  Last Published: {new Date(termsData.publishedAt).toLocaleDateString()}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setTermsPreviewMode(!termsPreviewMode)}
                className="px-3 py-1.5 rounded-xl border border-border-neutral text-xs font-semibold text-text-main hover:bg-surface-subtle transition flex items-center gap-1.5"
              >
                <Eye className="w-3.5 h-3.5 text-text-muted" />
                <span>{termsPreviewMode ? 'Edit Draft' : 'Customer Preview'}</span>
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={handleSaveTermsDraft}
                className="px-3.5 py-1.5 rounded-xl bg-surface hover:bg-surface-subtle border border-border-neutral text-text-main text-xs font-semibold transition flex items-center gap-1.5 disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5 text-brand" />
                <span>Save Draft</span>
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={() => setShowPublishTermsModal(true)}
                className="px-4 py-1.5 rounded-xl bg-brand hover:bg-brand-hover text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Publish Terms</span>
              </button>
            </div>
          </div>

          {/* Terms Title Field */}
          <div className="p-4 bg-surface border border-border-neutral rounded-2xl shadow-xs space-y-2">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-text-muted">
              Document Legal Title
            </label>
            <input
              type="text"
              value={termsTitle}
              onChange={(e) => setTermsTitle(e.target.value)}
              className="w-full px-3 py-2 bg-primary-bg border border-border-neutral rounded-xl text-xs font-bold text-text-main focus:outline-none focus:border-brand"
            />
          </div>

          {/* Editor or Preview Pane */}
          {termsPreviewMode ? (
            <div className="p-6 bg-surface border border-border-neutral rounded-2xl shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-border-neutral pb-3">
                <span className="text-xs font-bold text-text-muted uppercase tracking-wider">
                  Live Customer Storefront Preview
                </span>
                <span className="text-[11px] font-mono text-brand font-bold">
                  Effective: {new Date().toLocaleDateString()}
                </span>
              </div>
              <div className="prose prose-sm max-w-none text-text-main whitespace-pre-wrap font-sans text-xs sm:text-sm leading-relaxed">
                {termsDraftContent}
              </div>
            </div>
          ) : (
            <div className="p-4 sm:p-5 bg-surface border border-border-neutral rounded-2xl shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
                  Markdown Terms & Conditions Content & Sections
                </label>
                <span className="text-[10px] text-text-muted">Standard Markdown supported</span>
              </div>
              <textarea
                rows={16}
                value={termsDraftContent}
                onChange={(e) => setTermsDraftContent(e.target.value)}
                className="w-full p-4 bg-primary-bg border border-border-neutral rounded-xl text-xs font-mono text-text-main focus:outline-none focus:border-brand leading-relaxed"
                placeholder="Write your Terms & Conditions content here..."
              />
            </div>
          )}

          {/* Revision History */}
          {termsData?.history && termsData.history.length > 0 && (
            <div className="p-4 sm:p-5 bg-surface border border-border-neutral rounded-2xl shadow-xs space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted">
                Audit Revision History
              </h3>
              <div className="divide-y divide-border-neutral">
                {termsData.history.map((rev, idx) => (
                  <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-mono font-bold text-brand mr-2">v{rev.version}</span>
                      <span className="text-text-main">{rev.changeSummary || 'Terms published.'}</span>
                    </div>
                    <span className="text-[11px] text-text-muted font-mono">
                      {new Date(rev.changedAt || rev.publishedAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Publish Terms Modal */}
          {showPublishTermsModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-text-main/50 backdrop-blur-xs animate-fadeIn">
              <div className="bg-surface rounded-2xl border border-border-neutral shadow-2xl w-full max-w-md p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-border-neutral pb-3">
                  <h3 className="text-base font-bold font-heading text-text-main">Publish Terms & Conditions</h3>
                  <button type="button" onClick={() => setShowPublishTermsModal(false)}>
                    <X className="w-4 h-4 text-text-muted hover:text-text-main" />
                  </button>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-bold text-text-main mb-1">
                      New Version Number (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 1.1 or 2.0 (defaults to auto-increment)"
                      value={publishTermsVersion}
                      onChange={(e) => setPublishTermsVersion(e.target.value)}
                      className="w-full px-3 py-2 bg-primary-bg border border-border-neutral rounded-xl text-xs text-text-main focus:outline-none focus:border-brand font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-text-main mb-1">
                      Revision Summary for Audit Log
                    </label>
                    <textarea
                      rows={3}
                      placeholder="e.g. Updated perishable items return window, updated dispatch delivery guarantees..."
                      value={termsChangeSummary}
                      onChange={(e) => setTermsChangeSummary(e.target.value)}
                      className="w-full px-3 py-2 bg-primary-bg border border-border-neutral rounded-xl text-xs text-text-main focus:outline-none focus:border-brand"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-neutral">
                  <button
                    type="button"
                    onClick={() => setShowPublishTermsModal(false)}
                    className="px-4 py-2 border border-border-neutral text-xs font-semibold text-text-muted hover:text-text-main rounded-xl hover:bg-surface-subtle transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={handlePublishTerms}
                    className="px-5 py-2 bg-brand hover:bg-brand-hover text-white text-xs font-bold rounded-xl transition shadow-xs flex items-center gap-1.5"
                  >
                    {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Confirm & Make Live</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: FREQUENTLY ASKED QUESTIONS (FAQS) ── */}
      {activeTab === 'faqs' && (
        <div className="space-y-5">
          {/* FAQ Controls & Category Filter */}
          <div className="p-4 bg-surface border border-border-neutral rounded-2xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
              {['ALL', 'Orders', 'Delivery', 'Payments', 'Returns', 'Account', 'General'].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setFaqCategoryFilter(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                    faqCategoryFilter === cat
                      ? 'bg-brand text-white shadow-xs'
                      : 'bg-surface hover:bg-surface-subtle text-text-muted hover:text-text-main border border-border-neutral'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              {faqs.length > 0 && (
                <button
                  type="button"
                  onClick={() => faqBulk.toggleSelectPage(faqs.map((f) => f._id))}
                  className="px-3 py-1.5 border border-border-neutral text-xs font-semibold rounded-xl text-text-main hover:bg-surface-subtle transition flex items-center gap-1.5"
                >
                  {faqBulk.getPageSelectionState(faqs.map((f) => f._id)).isAllSelected ? (
                    <CheckSquare className="w-4 h-4 text-brand" />
                  ) : (
                    <Square className="w-4 h-4 text-text-muted" />
                  )}
                  <span>Select All</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setEditingFaq(null);
                  setFaqForm({
                    question: '',
                    answer: '',
                    category: 'General',
                    order: faqs.length + 1,
                    isPublished: true,
                  });
                  setFaqModalOpen(true);
                }}
                className="px-3.5 py-1.5 bg-brand hover:bg-brand-hover text-white text-xs font-bold rounded-xl transition shadow-xs flex items-center gap-1.5 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add FAQ</span>
              </button>
            </div>
          </div>

          {/* FAQs List */}
          <div className="space-y-3">
            {faqs.length === 0 ? (
              <div className="p-12 text-center bg-surface border border-border-neutral rounded-2xl shadow-xs">
                <HelpCircle className="w-8 h-8 text-text-muted/40 mx-auto mb-2" />
                <p className="font-bold text-text-main text-sm">No FAQs found</p>
                <p className="text-xs text-text-muted mt-0.5">Click "Add FAQ" above to create customer answers.</p>
              </div>
            ) : (
              faqs.map((faq) => {
                const isSelected = faqBulk.isSelected(faq._id);
                return (
                  <div
                    key={faq._id}
                    className={`p-4 bg-surface border rounded-2xl shadow-xs flex flex-col sm:flex-row sm:items-start justify-between gap-3 transition ${
                      isSelected ? 'border-brand/60 bg-brand-light/20' : 'border-border-neutral hover:border-brand/30'
                    }`}
                  >
                    <div className="flex items-start gap-3 flex-1">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => faqBulk.toggleSelect(faq._id)}
                        className="rounded accent-brand mt-1 shrink-0"
                      />
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-brand-light text-brand">
                            {faq.category}
                          </span>
                          <span className="text-[10px] text-text-muted font-mono">Order #{faq.order}</span>
                          {!faq.isPublished && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-status-warning/10 text-status-warning border border-status-warning/20">
                              Hidden (Draft)
                            </span>
                          )}
                        </div>
                        <h4 className="text-xs font-bold text-text-main break-words">{faq.question}</h4>
                        <p className="text-xs text-text-muted leading-relaxed line-clamp-3 break-words">{faq.answer}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-start pt-1 sm:pt-0">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingFaq(faq);
                          setFaqForm({
                            question: faq.question,
                            answer: faq.answer,
                            category: faq.category,
                            order: faq.order,
                            isPublished: faq.isPublished,
                          });
                          setFaqModalOpen(true);
                        }}
                        className="p-1.5 rounded-lg border border-border-neutral text-text-muted hover:text-brand hover:bg-surface-subtle transition"
                        title="Edit FAQ"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteFaq(faq._id)}
                        className="p-1.5 rounded-lg border border-border-neutral text-text-muted hover:text-status-error hover:bg-status-error/10 transition"
                        title="Delete FAQ"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Add / Edit FAQ Modal */}
          {faqModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-text-main/50 backdrop-blur-xs animate-fadeIn">
              <div className="bg-surface rounded-2xl border border-border-neutral shadow-2xl w-full max-w-lg p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-border-neutral pb-3">
                  <h3 className="text-sm font-bold font-heading text-text-main">
                    {editingFaq ? 'Edit FAQ Item' : 'Create FAQ Item'}
                  </h3>
                  <button type="button" onClick={() => setFaqModalOpen(false)}>
                    <X className="w-4 h-4 text-text-muted" />
                  </button>
                </div>

                <form onSubmit={handleSaveFaq} className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold text-text-main mb-1">Question *</label>
                    <input
                      type="text"
                      required
                      value={faqForm.question}
                      onChange={(e) => setFaqForm({ ...faqForm, question: e.target.value })}
                      placeholder="e.g. Do you deliver stone-ground flour in Vijay Nagar?"
                      className="w-full px-3 py-2 bg-primary-bg border border-border-neutral rounded-xl text-xs text-text-main focus:outline-none focus:border-brand"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-text-main mb-1">Answer *</label>
                    <textarea
                      rows={4}
                      required
                      value={faqForm.answer}
                      onChange={(e) => setFaqForm({ ...faqForm, answer: e.target.value })}
                      placeholder="Provide helpful, verified response for Indore customers..."
                      className="w-full px-3 py-2 bg-primary-bg border border-border-neutral rounded-xl text-xs text-text-main focus:outline-none focus:border-brand"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-text-main mb-1">Category</label>
                      <select
                        value={faqForm.category}
                        onChange={(e) => setFaqForm({ ...faqForm, category: e.target.value })}
                        className="w-full px-3 py-2 bg-primary-bg border border-border-neutral rounded-xl text-xs text-text-main focus:outline-none focus:border-brand"
                      >
                        {['Orders', 'Delivery', 'Payments', 'Returns', 'Account', 'General'].map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-text-main mb-1">Display Order</label>
                      <input
                        type="number"
                        value={faqForm.order}
                        onChange={(e) => setFaqForm({ ...faqForm, order: parseInt(e.target.value, 10) || 0 })}
                        className="w-full px-3 py-2 bg-primary-bg border border-border-neutral rounded-xl text-xs text-text-main focus:outline-none focus:border-brand font-mono"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="faqPublished"
                      checked={faqForm.isPublished}
                      onChange={(e) => setFaqForm({ ...faqForm, isPublished: e.target.checked })}
                      className="rounded accent-brand"
                    />
                    <label htmlFor="faqPublished" className="text-xs text-text-main font-semibold cursor-pointer">
                      Published and visible on storefront
                    </label>
                  </div>

                  <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border-neutral">
                    <button
                      type="button"
                      onClick={() => setFaqModalOpen(false)}
                      className="px-4 py-2 border border-border-neutral text-xs font-semibold text-text-muted hover:text-text-main rounded-xl hover:bg-surface-subtle transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-5 py-2 bg-brand hover:bg-brand-hover text-white text-xs font-bold rounded-xl transition shadow-xs disabled:opacity-50"
                    >
                      {editingFaq ? 'Update FAQ' : 'Create FAQ'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Contextual Bulk Action Bar for FAQs */}
          <BulkActionBar
            selectedCount={faqBulk.selectedCount}
            totalMatching={faqs.length}
            currentPageCount={faqs.length}
            selectAllMatching={faqBulk.selectAllMatching}
            onSelectAllMatching={faqBulk.handleSelectAllMatching}
            onClearSelection={faqBulk.clearSelection}
            itemName="FAQs"
            actions={[
              {
                id: 'publish',
                label: 'Publish',
                icon: CheckCircle2,
                variant: 'primary',
                onClick: () => handleTriggerBulkFaqPublish(true),
              },
              {
                id: 'unpublish',
                label: 'Unpublish',
                icon: EyeOff,
                variant: 'warning',
                onClick: () => handleTriggerBulkFaqPublish(false),
              },
              {
                id: 'delete',
                label: 'Delete Selected',
                icon: Trash2,
                variant: 'danger',
                onClick: handleTriggerBulkFaqDelete,
              },
            ]}
          />
        </div>
      )}

      {/* ── TAB 3: HELP & SUPPORT SETTINGS + INQUIRIES INBOX ── */}
      {activeTab === 'support' && (
        <div className="space-y-6">
          {/* Support Settings Configuration Card */}
          <div className="p-4 sm:p-5 bg-surface border border-border-neutral rounded-2xl shadow-xs space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-brand-light text-brand flex items-center justify-center shrink-0">
                <Headphones className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold font-heading text-text-main">
                  Verified Contact Channels & Operating Hours
                </h3>
                <p className="text-[11px] text-text-muted">
                  These verified channels are displayed to customers on the Contact & Support page.
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveSupport} className="space-y-4 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-text-muted mb-1">
                    Support Phone Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={supportSettings.verifiedPhone}
                    onChange={(e) => setSupportSettings({ ...supportSettings, verifiedPhone: e.target.value })}
                    className="w-full px-3 py-2 bg-primary-bg border border-border-neutral rounded-xl text-xs font-mono text-text-main focus:outline-none focus:border-brand"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-text-muted mb-1">
                    Support Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={supportSettings.verifiedEmail}
                    onChange={(e) => setSupportSettings({ ...supportSettings, verifiedEmail: e.target.value })}
                    className="w-full px-3 py-2 bg-primary-bg border border-border-neutral rounded-xl text-xs text-text-main focus:outline-none focus:border-brand"
                  />
                </div>

                <div className="sm:col-span-2 lg:col-span-1">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-text-muted mb-1">
                    Operating Hours *
                  </label>
                  <input
                    type="text"
                    required
                    value={supportSettings.businessHours}
                    onChange={(e) => setSupportSettings({ ...supportSettings, businessHours: e.target.value })}
                    className="w-full px-3 py-2 bg-primary-bg border border-border-neutral rounded-xl text-xs text-text-main focus:outline-none focus:border-brand"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-text-muted mb-1">
                    Customer Help Instructions
                  </label>
                  <textarea
                    rows={2}
                    value={supportSettings.instructions}
                    onChange={(e) => setSupportSettings({ ...supportSettings, instructions: e.target.value })}
                    className="w-full px-3 py-2 bg-primary-bg border border-border-neutral rounded-xl text-xs text-text-main focus:outline-none focus:border-brand"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-text-muted mb-1">
                    Escalation Policy & Guarantee
                  </label>
                  <textarea
                    rows={2}
                    value={supportSettings.escalationPolicy}
                    onChange={(e) => setSupportSettings({ ...supportSettings, escalationPolicy: e.target.value })}
                    className="w-full px-3 py-2 bg-primary-bg border border-border-neutral rounded-xl text-xs text-text-main focus:outline-none focus:border-brand"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-brand hover:bg-brand-hover text-white text-xs font-bold rounded-xl transition shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Support Settings</span>
                </button>
              </div>
            </form>
          </div>

          {/* Customer Support Tickets Inbox */}
          <div className="p-4 sm:p-5 bg-surface border border-border-neutral rounded-2xl shadow-xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-surface-subtle text-brand flex items-center justify-center shrink-0">
                  <Inbox className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold font-heading text-text-main">
                    Customer Support Inquiries & Tickets
                  </h3>
                  <p className="text-[11px] text-text-muted">
                    Real support inquiries submitted by customers on the public Help page.
                  </p>
                </div>
              </div>

              {/* Status Filter Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 no-scrollbar">
                {['ALL', 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'REJECTED'].map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => {
                      setInquiryStatusFilter(st);
                      inquiryBulk.clearSelection();
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                      inquiryStatusFilter === st
                        ? 'bg-brand text-white shadow-xs'
                        : 'bg-surface hover:bg-surface-subtle text-text-muted hover:text-text-main border border-border-neutral'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Mobile Cards View (< md) */}
            <div className="block md:hidden space-y-3">
              {inquiries.length === 0 ? (
                <div className="py-10 text-center text-text-muted text-xs bg-surface-subtle/50 rounded-xl border border-border-neutral">
                  No support inquiry tickets matching filter.
                </div>
              ) : (
                inquiries.map((inq) => {
                  const isSelected = inquiryBulk.isSelected(inq._id);
                  const isPhoneRevealed = Boolean(revealedPhones[inq._id]);
                  const maskedPhone = isPhoneRevealed
                    ? inq.phone
                    : inq.phone?.length >= 10
                    ? inq.phone.slice(0, 3) + '••••' + inq.phone.slice(-3)
                    : inq.phone;

                  return (
                    <div
                      key={inq._id}
                      className={`p-3.5 rounded-xl border space-y-3 transition ${
                        isSelected ? 'border-brand/60 bg-brand-light/20' : 'bg-surface-subtle/70 border-border-neutral'
                      }`}
                    >
                      {/* Top: Checkbox, Ticket #, and Status Badge */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => inquiryBulk.toggleSelect(inq._id)}
                            className="rounded accent-brand shrink-0"
                          />
                          <span className="font-mono text-xs font-bold text-brand break-all">
                            {inq.ticketNumber}
                          </span>
                        </div>

                        <span
                          className={`shrink-0 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            inq.status === 'RESOLVED'
                              ? 'bg-status-success/10 text-status-success border border-status-success/20'
                              : inq.status === 'IN_PROGRESS'
                              ? 'bg-status-warning/10 text-status-warning border border-status-warning/20'
                              : inq.status === 'REJECTED'
                              ? 'bg-status-error/10 text-status-error border border-status-error/20'
                              : 'bg-brand-light text-brand border border-brand/20'
                          }`}
                        >
                          {inq.status}
                        </span>
                      </div>

                      {/* Customer Details */}
                      <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-border-neutral/60">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-text-muted block">Customer</span>
                          <span className="font-bold text-text-main truncate block">{inq.name}</span>
                          <div className="flex items-center gap-1 text-[11px] text-text-muted font-mono">
                            <span>{maskedPhone}</span>
                            <button
                              type="button"
                              onClick={() => togglePhoneReveal(inq._id)}
                              className="text-text-muted hover:text-brand"
                              title={isPhoneRevealed ? 'Mask Phone' : 'Reveal Phone'}
                            >
                              {isPhoneRevealed ? <PhoneOff className="w-3 h-3" /> : <Phone className="w-3 h-3" />}
                            </button>
                          </div>
                        </div>

                        <div>
                          <span className="text-[10px] uppercase font-bold text-text-muted block">Order Ref</span>
                          <span className="font-mono text-[11px] text-text-main block">
                            {inq.orderNumber || '—'}
                          </span>
                          <span className="text-[10px] text-text-muted block">
                            {new Date(inq.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      {/* Subject & Message */}
                      <div className="text-xs pt-1 border-t border-border-neutral/60">
                        <span className="font-semibold text-text-main block break-words">{inq.subject}</span>
                        <p className="text-[11px] text-text-muted line-clamp-2 mt-0.5 break-words">{inq.message}</p>
                      </div>

                      {/* Action Buttons: Manage + Delete */}
                      <div className="flex items-center gap-2 pt-2 border-t border-border-neutral/60">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedInquiry(inq);
                            setInquiryNotes(inq.responseNotes || '');
                          }}
                          className="flex-1 py-1.5 px-3 bg-surface hover:bg-surface-subtle border border-border-neutral rounded-xl text-xs font-bold text-brand transition text-center shadow-xs"
                        >
                          Manage Ticket
                        </button>

                        <button
                          type="button"
                          onClick={() => setDeleteModalInquiry(inq)}
                          className="py-1.5 px-3 bg-status-error/10 hover:bg-status-error/20 border border-status-error/20 rounded-xl text-xs font-bold text-status-error transition flex items-center justify-center gap-1 shadow-xs shrink-0"
                          title="Delete Ticket"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Desktop Table View (>= md) */}
            <div className="hidden md:block overflow-x-auto border border-border-neutral rounded-xl">
              <table className="w-full min-w-[750px] text-left text-xs">
                <thead className="bg-surface-subtle text-[10px] uppercase tracking-wider text-text-muted border-b border-border-neutral font-bold">
                  <tr>
                    <th className="py-3 px-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={
                          inquiries.length > 0 &&
                          inquiryBulk.getPageSelectionState(inquiries.map((i) => i._id)).isAllSelected
                        }
                        onChange={() => inquiryBulk.toggleSelectPage(inquiries.map((i) => i._id))}
                        className="rounded accent-brand"
                      />
                    </th>
                    <th className="py-3 px-3 font-semibold">Ticket #</th>
                    <th className="py-3 px-3 font-semibold">Customer</th>
                    <th className="py-3 px-3 font-semibold">Subject & Message</th>
                    <th className="py-3 px-3 font-semibold">Order Ref</th>
                    <th className="py-3 px-3 font-semibold">Status</th>
                    <th className="py-3 px-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-neutral">
                  {inquiries.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-text-muted">
                        No support inquiry tickets matching active filter.
                      </td>
                    </tr>
                  ) : (
                    inquiries.map((inq) => {
                      const isSelected = inquiryBulk.isSelected(inq._id);
                      const isPhoneRevealed = Boolean(revealedPhones[inq._id]);
                      const maskedPhone = isPhoneRevealed
                        ? inq.phone
                        : inq.phone?.length >= 10
                        ? inq.phone.slice(0, 3) + '••••' + inq.phone.slice(-3)
                        : inq.phone;

                      return (
                        <tr
                          key={inq._id}
                          className={`transition ${isSelected ? 'bg-brand-light/30' : 'hover:bg-surface-subtle/50'}`}
                        >
                          <td className="py-3.5 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => inquiryBulk.toggleSelect(inq._id)}
                              className="rounded accent-brand"
                            />
                          </td>
                          <td className="py-3.5 px-3 font-mono font-bold text-brand">{inq.ticketNumber}</td>
                          <td className="py-3.5 px-3">
                            <span className="font-bold text-text-main block">{inq.name}</span>
                            <div className="flex items-center gap-1.5 text-[11px] text-text-muted font-mono mt-0.5">
                              <span>{maskedPhone}</span>
                              <button
                                type="button"
                                onClick={() => togglePhoneReveal(inq._id)}
                                className="text-text-muted hover:text-brand"
                                title={isPhoneRevealed ? 'Mask Phone' : 'Reveal Phone'}
                              >
                                {isPhoneRevealed ? <PhoneOff className="w-3 h-3" /> : <Phone className="w-3 h-3" />}
                              </button>
                            </div>
                          </td>
                          <td className="py-3.5 px-3 max-w-xs">
                            <span className="font-semibold text-text-main block truncate">{inq.subject}</span>
                            <span className="text-[11px] text-text-muted line-clamp-1">{inq.message}</span>
                          </td>
                          <td className="py-3.5 px-3 font-mono text-[11px] text-text-muted">
                            {inq.orderNumber || '—'}
                          </td>
                          <td className="py-3.5 px-3">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider inline-block ${
                                inq.status === 'RESOLVED'
                                  ? 'bg-status-success/10 text-status-success border border-status-success/20'
                                  : inq.status === 'IN_PROGRESS'
                                  ? 'bg-status-warning/10 text-status-warning border border-status-warning/20'
                                  : inq.status === 'REJECTED'
                                  ? 'bg-status-error/10 text-status-error border border-status-error/20'
                                  : 'bg-brand-light text-brand border border-brand/20'
                              }`}
                            >
                              {inq.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedInquiry(inq);
                                  setInquiryNotes(inq.responseNotes || '');
                                }}
                                className="px-3 py-1 bg-surface hover:bg-surface-subtle border border-border-neutral rounded-lg text-xs font-semibold text-brand transition shadow-xs"
                              >
                                Manage
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteModalInquiry(inq)}
                                className="p-1 rounded-lg text-text-muted hover:text-status-error hover:bg-status-error/10 border border-transparent hover:border-status-error/20 transition"
                                title="Delete Ticket"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Contextual Bulk Action Bar for Support Tickets */}
          <BulkActionBar
            selectedCount={inquiryBulk.selectedCount}
            totalMatching={inquiries.length}
            currentPageCount={inquiries.length}
            selectAllMatching={inquiryBulk.selectAllMatching}
            onSelectAllMatching={inquiryBulk.handleSelectAllMatching}
            onClearSelection={inquiryBulk.clearSelection}
            itemName="support tickets"
            actions={[
              {
                id: 'resolve',
                label: 'Mark Resolved',
                icon: CheckCircle2,
                variant: 'primary',
                onClick: () => handleTriggerBulkInquiryStatus('RESOLVED'),
              },
              {
                id: 'close',
                label: 'Close',
                icon: Check,
                variant: 'warning',
                onClick: () => handleTriggerBulkInquiryStatus('CLOSED'),
              },
              {
                id: 'reject',
                label: 'Reject Selected',
                icon: Ban,
                variant: 'danger',
                onClick: handleTriggerBulkInquiryReject,
              },
              {
                id: 'delete',
                label: 'Delete Selected',
                icon: Trash2,
                variant: 'danger',
                onClick: handleTriggerBulkInquiryDelete,
              },
            ]}
          />

          {/* Manage Inquiry Ticket Modal / Drawer */}
          {selectedInquiry && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-text-main/50 backdrop-blur-xs animate-fadeIn overflow-y-auto">
              <div className="bg-surface rounded-2xl border border-border-neutral shadow-2xl w-full max-w-lg p-5 sm:p-6 space-y-4 my-8">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-border-neutral pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold font-heading text-text-main">
                        Ticket: #{selectedInquiry.ticketNumber}
                      </h3>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          selectedInquiry.status === 'RESOLVED'
                            ? 'bg-status-success/10 text-status-success'
                            : selectedInquiry.status === 'REJECTED'
                            ? 'bg-status-error/10 text-status-error'
                            : selectedInquiry.status === 'IN_PROGRESS'
                            ? 'bg-status-warning/10 text-status-warning'
                            : 'bg-brand-light text-brand'
                        }`}
                      >
                        {selectedInquiry.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-text-muted mt-0.5">
                      Customer: <strong className="text-text-main">{selectedInquiry.name}</strong> ({selectedInquiry.phone})
                    </p>
                  </div>
                  <button type="button" onClick={() => setSelectedInquiry(null)}>
                    <X className="w-4 h-4 text-text-muted hover:text-text-main" />
                  </button>
                </div>

                {/* Inquiry Customer Request Details */}
                <div className="p-3.5 bg-surface-subtle border border-border-neutral rounded-xl space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-text-main block">Subject: {selectedInquiry.subject}</span>
                    {selectedInquiry.orderNumber && (
                      <span className="text-[10px] text-brand font-mono font-bold bg-brand-light px-2 py-0.5 rounded-md border border-brand/20">
                        Order #{selectedInquiry.orderNumber}
                      </span>
                    )}
                  </div>
                  <p className="text-text-muted whitespace-pre-wrap leading-relaxed">{selectedInquiry.message}</p>
                  <div className="pt-1 text-[10px] text-text-muted font-mono">
                    Received: {new Date(selectedInquiry.createdAt).toLocaleString()}
                  </div>
                </div>

                {/* Rejection Details Banner if Rejected */}
                {selectedInquiry.status === 'REJECTED' && selectedInquiry.rejectionReason && (
                  <div className="p-3 bg-status-error/10 border border-status-error/20 rounded-xl space-y-1 text-xs">
                    <span className="font-bold text-status-error block flex items-center gap-1.5">
                      <Ban className="w-3.5 h-3.5" />
                      <span>Rejection Audit Record</span>
                    </span>
                    <p className="text-status-error text-[11px]">Reason: {selectedInquiry.rejectionReason}</p>
                    {selectedInquiry.rejectedAt && (
                      <span className="text-[10px] text-status-error/70 font-mono block">
                        Rejected on: {new Date(selectedInquiry.rejectedAt).toLocaleString()}
                      </span>
                    )}
                  </div>
                )}

                {/* Internal Notes & Add Note */}
                <div className="space-y-2">
                  <label className="block text-[11px] font-bold text-text-main">
                    Internal Staff & Resolution Notes
                  </label>

                  {/* Existing Notes */}
                  {selectedInquiry.internalNotes && selectedInquiry.internalNotes.length > 0 && (
                    <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                      {selectedInquiry.internalNotes.map((n, idx) => (
                        <div key={idx} className="p-2 rounded-lg bg-surface-subtle border border-border-neutral text-[11px]">
                          <p className="text-text-main leading-normal">{n.note}</p>
                          <span className="text-[10px] text-text-muted font-mono mt-0.5 block">
                            Added: {new Date(n.addedAt).toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newInternalNote}
                      onChange={(e) => setNewInternalNote(e.target.value)}
                      placeholder="Add an internal note or call resolution..."
                      className="flex-1 px-3 py-1.5 bg-primary-bg border border-border-neutral rounded-xl text-xs text-text-main focus:outline-none focus:border-brand"
                    />
                    <button
                      type="button"
                      onClick={handleAddInternalNote}
                      disabled={!newInternalNote.trim()}
                      className="px-3 py-1.5 bg-surface hover:bg-surface-subtle border border-border-neutral text-xs font-bold text-brand rounded-xl transition disabled:opacity-50"
                    >
                      Add Note
                    </button>
                  </div>
                </div>

                {/* State Transition Actions */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-border-neutral">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {selectedInquiry.status !== 'IN_PROGRESS' && selectedInquiry.status !== 'REJECTED' && (
                      <button
                        type="button"
                        onClick={() => handleUpdateInquiryStatus('IN_PROGRESS')}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-status-warning/10 text-status-warning hover:bg-status-warning/20 transition"
                      >
                        In Progress
                      </button>
                    )}

                    {selectedInquiry.status !== 'RESOLVED' && selectedInquiry.status !== 'REJECTED' && (
                      <button
                        type="button"
                        onClick={() => handleUpdateInquiryStatus('RESOLVED')}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-status-success/10 text-status-success hover:bg-status-success/20 transition"
                      >
                        Mark Resolved
                      </button>
                    )}

                    {selectedInquiry.status !== 'CLOSED' && (
                      <button
                        type="button"
                        onClick={() => handleUpdateInquiryStatus('CLOSED')}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-surface hover:bg-surface-subtle text-text-muted hover:text-text-main border border-border-neutral transition"
                      >
                        Close
                      </button>
                    )}

                    {selectedInquiry.status !== 'REJECTED' && (
                      <button
                        type="button"
                        onClick={() => {
                          setRejectModalInquiry(selectedInquiry);
                          setRejectReason('');
                          setRejectInternalNote('');
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-status-error/10 text-status-error hover:bg-status-error/20 transition"
                      >
                        Reject...
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedInquiry(null)}
                    className="px-4 py-1.5 border border-border-neutral text-xs font-semibold text-text-muted hover:text-text-main rounded-xl hover:bg-surface-subtle transition"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Individual Ticket Rejection Modal */}
          {rejectModalInquiry && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-text-main/50 backdrop-blur-xs animate-fadeIn">
              <div className="bg-surface rounded-2xl border border-border-neutral shadow-2xl w-full max-w-md p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-border-neutral pb-3">
                  <div className="flex items-center gap-2">
                    <Ban className="w-5 h-5 text-status-error" />
                    <h3 className="text-base font-bold font-heading text-text-main">
                      Reject Support Ticket
                    </h3>
                  </div>
                  <button type="button" onClick={() => setRejectModalInquiry(null)}>
                    <X className="w-4 h-4 text-text-muted hover:text-text-main" />
                  </button>
                </div>

                <form onSubmit={handleConfirmRejectTicket} className="space-y-3.5 text-xs">
                  <div className="p-3 bg-surface-subtle border border-border-neutral rounded-xl space-y-1">
                    <span className="font-mono text-brand font-bold block">
                      Ticket #{rejectModalInquiry.ticketNumber}
                    </span>
                    <span className="font-bold text-text-main block">
                      Customer: {rejectModalInquiry.name} ({rejectModalInquiry.phone})
                    </span>
                    <p className="text-text-muted line-clamp-2">Subject: {rejectModalInquiry.subject}</p>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-text-main mb-1">
                      Mandatory Rejection Reason *
                    </label>
                    <textarea
                      rows={3}
                      required
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="e.g. Invalid inquiry, duplicate ticket, unsupported customer request, spam..."
                      className="w-full px-3 py-2 bg-primary-bg border border-border-neutral rounded-xl text-xs text-text-main focus:outline-none focus:border-brand"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-text-main mb-1">
                      Optional Internal Staff Note
                    </label>
                    <input
                      type="text"
                      value={rejectInternalNote}
                      onChange={(e) => setRejectInternalNote(e.target.value)}
                      placeholder="Private note for staff reference..."
                      className="w-full px-3 py-2 bg-primary-bg border border-border-neutral rounded-xl text-xs text-text-main focus:outline-none focus:border-brand"
                    />
                  </div>

                  <p className="text-[11px] text-text-muted">
                    ℹ️ Rejection will be permanently logged in audit records with your admin identity.
                  </p>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-neutral">
                    <button
                      type="button"
                      onClick={() => setRejectModalInquiry(null)}
                      className="px-4 py-2 border border-border-neutral text-xs font-semibold text-text-muted hover:text-text-main rounded-xl hover:bg-surface-subtle transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading || !rejectReason.trim()}
                      className="px-5 py-2 bg-status-error hover:bg-status-error/90 text-white text-xs font-bold rounded-xl transition shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>Confirm Rejection</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Individual Ticket Delete Confirmation Modal */}
          {deleteModalInquiry && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-text-main/50 backdrop-blur-xs animate-fadeIn">
              <div className="bg-surface rounded-2xl border border-border-neutral shadow-2xl w-full max-w-md p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-border-neutral pb-3">
                  <div className="flex items-center gap-2">
                    <Trash2 className="w-5 h-5 text-status-error" />
                    <h3 className="text-base font-bold font-heading text-text-main">
                      Delete Support Ticket
                    </h3>
                  </div>
                  <button type="button" onClick={() => setDeleteModalInquiry(null)}>
                    <X className="w-4 h-4 text-text-muted hover:text-text-main" />
                  </button>
                </div>

                <div className="space-y-3 text-xs text-text-main">
                  <p>
                    Are you sure you want to delete Ticket{' '}
                    <strong className="font-mono text-brand">#{deleteModalInquiry.ticketNumber}</strong> from{' '}
                    <strong>{deleteModalInquiry.name}</strong>?
                  </p>

                  <div className="p-3 bg-brand-light/50 border border-brand/20 rounded-xl space-y-1 text-[11px] text-text-muted">
                    <span className="font-bold text-text-main block">Reversible Soft Deletion:</span>
                    <p>
                      This ticket will be archived and excluded from active support lists. An audit log entry will be
                      stored with your admin identity.
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-neutral">
                  <button
                    type="button"
                    onClick={() => setDeleteModalInquiry(null)}
                    className="px-4 py-2 border border-border-neutral text-xs font-semibold text-text-muted hover:text-text-main rounded-xl hover:bg-surface-subtle transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleConfirmDeleteTicket}
                    className="px-5 py-2 bg-status-error hover:bg-status-error/90 text-white text-xs font-bold rounded-xl transition shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Confirm Delete</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Global Bulk Confirmation & Result Summary Dialog */}
      {bulkConfirmConfig && (
        <BulkConfirmModal
          isOpen={Boolean(bulkConfirmConfig)}
          onClose={() => {
            setBulkConfirmConfig(null);
            setBulkResultSummary(null);
          }}
          onConfirm={(reason) => bulkConfirmConfig.onConfirm(reason)}
          title={bulkConfirmConfig.title}
          description={bulkConfirmConfig.description}
          affectedCount={bulkConfirmConfig.affectedCount}
          itemName={bulkConfirmConfig.itemName}
          confirmLabel={bulkConfirmConfig.confirmLabel}
          confirmVariant={bulkConfirmConfig.confirmVariant}
          requireReason={bulkConfirmConfig.requireReason}
          reasonPlaceholder={bulkConfirmConfig.reasonPlaceholder}
          reversibilityNotice={bulkConfirmConfig.reversibilityNotice}
          loading={bulkActionLoading}
          resultSummary={bulkResultSummary}
          onDone={() => {
            setBulkConfirmConfig(null);
            setBulkResultSummary(null);
            if (activeTab === 'faqs') fetchFaqs();
            if (activeTab === 'support') fetchInquiries();
          }}
        />
      )}
    </div>
  );
}
