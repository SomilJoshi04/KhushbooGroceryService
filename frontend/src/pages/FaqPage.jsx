/**
 * Public FAQs Page.
 *
 * Categorized accordion questions and answers for orders, deliveries, payments, and product purity.
 *
 * @module pages/FaqPage
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  HelpCircle,
  Search,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  Loader2,
  Headphones,
  CheckCircle2,
} from 'lucide-react';

export function FaqPage() {
  const [faqs, setFaqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    async function loadFaqs() {
      try {
        const res = await fetch('/api/v1/content/faqs');
        const data = await res.json();
        if (data.success) {
          setFaqs(data.data || []);
          if (data.data?.length > 0) {
            setExpandedId(data.data[0]._id);
          }
        }
      } catch {
        // Fallback handled gracefully
      } finally {
        setLoading(false);
      }
    }
    loadFaqs();
  }, []);

  const categories = ['ALL', 'Orders', 'Delivery', 'Payments', 'Returns', 'General'];

  const filteredFaqs = faqs.filter((f) => {
    const matchesCat = activeCategory === 'ALL' || f.category === activeCategory;
    const matchesSearch =
      !search.trim() ||
      f.question.toLowerCase().includes(search.toLowerCase()) ||
      f.answer.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const toggleExpand = (id) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="min-h-screen bg-primary-bg py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Back Link */}
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-muted hover:text-brand transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Storefront</span>
        </Link>

        {/* Page Banner */}
        <div className="bg-surface border border-border-neutral rounded-2xl p-6 sm:p-8 shadow-xs text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-brand-light text-brand flex items-center justify-center mx-auto shadow-xs">
            <HelpCircle className="w-6 h-6" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold font-heading text-text-main">
            Frequently Asked Questions
          </h1>
          <p className="text-xs sm:text-sm text-text-muted max-w-xl mx-auto">
            Everything you need to know about our stone-ground MP Sharbati wheat flour, cold-pressed oils, pure cow ghee, and doorstep delivery across Indore.
          </p>

          {/* Search Box */}
          <div className="max-w-md mx-auto pt-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search questions (e.g. delivery time, Vijay Nagar, payment)..."
                className="w-full pl-10 pr-4 py-2.5 bg-primary-bg border border-border-neutral rounded-xl text-xs text-text-main placeholder:text-text-muted focus:outline-none focus:border-brand shadow-xs"
              />
            </div>
          </div>
        </div>

        {/* Category Filters */}
        <div className="flex items-center justify-center gap-1.5 overflow-x-auto pb-1">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                activeCategory === cat
                  ? 'bg-brand text-white shadow-xs'
                  : 'bg-surface hover:bg-surface-subtle text-text-muted hover:text-text-main border border-border-neutral'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* FAQs Accordion */}
        <div className="space-y-3">
          {loading ? (
            <div className="py-16 text-center text-text-muted bg-surface rounded-2xl border border-border-neutral">
              <Loader2 className="w-7 h-7 animate-spin mx-auto text-brand mb-2" />
              <p className="text-xs">Loading FAQs...</p>
            </div>
          ) : filteredFaqs.length === 0 ? (
            <div className="py-12 text-center text-text-muted bg-surface rounded-2xl border border-border-neutral">
              <p className="font-bold text-text-main text-xs">No matching questions found.</p>
              <p className="text-[11px] mt-0.5">Try searching different keywords or select "ALL" above.</p>
            </div>
          ) : (
            filteredFaqs.map((faq) => {
              const isExpanded = expandedId === faq._id;
              return (
                <div
                  key={faq._id}
                  className={`bg-surface border rounded-2xl overflow-hidden transition shadow-xs ${
                    isExpanded ? 'border-brand/40 ring-1 ring-brand/10' : 'border-border-neutral'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleExpand(faq._id)}
                    className="w-full px-5 py-4 text-left flex items-center justify-between gap-3 hover:bg-surface-subtle/40 transition"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-brand-light text-brand shrink-0">
                        {faq.category}
                      </span>
                      <h3 className="text-xs sm:text-sm font-bold text-text-main">{faq.question}</h3>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-brand shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-text-muted shrink-0" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="px-5 pb-5 pt-1 text-xs text-text-muted leading-relaxed border-t border-border-neutral/60 bg-surface-subtle/20">
                      {faq.answer}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Helpdesk Callout Card */}
        <div className="p-6 bg-surface border border-border-neutral rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-light text-brand flex items-center justify-center shrink-0">
              <Headphones className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-text-main">Still have questions?</h4>
              <p className="text-[11px] text-text-muted">
                Our Indore customer care desk is ready to answer inquiries regarding orders, pure flours, or deliveries.
              </p>
            </div>
          </div>
          <Link
            to="/help"
            className="px-4 py-2 bg-brand hover:bg-brand-hover text-white text-xs font-bold rounded-xl transition shadow-xs self-start sm:self-auto shrink-0"
          >
            Contact Support Desk
          </Link>
        </div>
      </div>
    </div>
  );
}
