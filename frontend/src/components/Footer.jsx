/**
 * Storefront Footer Component.
 *
 * Provides store location details, delivery areas, contact helpline,
 * and essential kirana service guarantees in the light design system.
 *
 * @module components/Footer
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Phone, Mail, ShieldCheck, Truck, Clock } from 'lucide-react';
import { useStoreSettings } from '../context/StoreSettingsContext.jsx';
import { apiClient } from '../config/api.js';

export function Footer() {
  const { settings } = useStoreSettings();
  const [popularCategories, setPopularCategories] = useState([]);

  useEffect(() => {
    let isMounted = true;
    apiClient
      .get('/v1/categories')
      .then((res) => {
        if (isMounted && Array.isArray(res.data?.data)) {
          setPopularCategories(res.data.data.slice(0, 5));
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);
  return (
    <footer className="bg-surface border-t border-border-neutral text-text-muted text-xs">
      {/* Value Proposition Badges */}
      <div className="border-b border-border-neutral bg-surface-subtle">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-brand-light text-brand border border-brand/20 flex items-center justify-center shrink-0 shadow-xs">
              <span className="text-xl">🌾</span>
            </div>
            <div>
              <h4 className="font-bold text-text-main text-sm">100% Pure & Stone-Ground</h4>
              <p className="text-[11px] text-text-muted mt-0.5">MP Sharbati wheat, unpolished lentils & pure spices.</p>
            </div>
          </div>

          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-brand-light text-brand border border-brand/20 flex items-center justify-center shrink-0 shadow-xs">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-text-main text-sm">Fast Indore Delivery</h4>
              <p className="text-[11px] text-text-muted mt-0.5">Delivered within 90-120 mins across central Indore.</p>
            </div>
          </div>

          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-brand-light text-brand border border-brand/20 flex items-center justify-center shrink-0 shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-text-main text-sm">Fair & Honest Grocery Prices</h4>
              <p className="text-[11px] text-text-muted mt-0.5">Zero hidden charges. Transparent integer-paise billing.</p>
            </div>
          </div>

          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-brand-light text-brand border border-brand/20 flex items-center justify-center shrink-0 shadow-xs">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-text-main text-sm">Daily Store Hours</h4>
              <p className="text-[11px] text-text-muted mt-0.5">8:00 AM – 9:00 PM (Monday through Sunday).</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Links & Info */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 grid grid-cols-1 md:grid-cols-4 gap-6 sm:gap-8">
        {/* Brand Col */}
        <div className="space-y-3">
          <div className="flex items-center gap-2.5">
            <img
              src="/websiteLogo.png"
              alt="Khushboo Grocery Service Logo"
              className="w-9 h-9 rounded-xl object-contain shadow-xs border border-border-neutral/60 bg-surface"
            />
            <span className="font-heading font-extrabold text-base text-text-main">
              Khushboo <span className="text-brand">Grocery Service</span>
            </span>
          </div>
          <p className="text-xs text-text-muted leading-relaxed">
            Freshly ground flour, virgin oils, authentic spices, and daily household essentials. Packaged under hygienic conditions in Indore, Madhya Pradesh.
          </p>
          <div className="text-[11px] text-text-muted flex items-center gap-1.5 pt-1">
            <MapPin className="w-3.5 h-3.5 text-brand shrink-0" />
            <span>{settings.address || '123 MG Road, Geeta Bhawan, Indore — 452001'}</span>
          </div>
        </div>

        {/* 2-Column Responsive Layout on Mobile: Popular Departments & Customer Service Side-by-Side */}
        <div className="col-span-1 md:col-span-2 grid grid-cols-2 gap-4 sm:gap-6">
          {/* Categories */}
          <div>
            <h4 className="font-bold text-text-main uppercase tracking-wider text-xs mb-3">Popular Departments</h4>
            <ul className="space-y-2 text-xs">
              {popularCategories.map((cat) => (
                <li key={cat._id || cat.slug}>
                  <Link to={`/categories/${cat.slug}`} className="hover:text-brand transition">
                    {cat.name}
                  </Link>
                </li>
              ))}
              <li><Link to="/categories" className="text-brand font-semibold hover:underline block pt-0.5">View All Categories →</Link></li>
            </ul>
          </div>

          {/* Customer Care */}
          <div>
            <h4 className="font-bold text-text-main uppercase tracking-wider text-xs mb-3">Customer Service</h4>
            <ul className="space-y-2 text-xs">
              <li><Link to="/account" className="hover:text-brand transition">My Account & Orders</Link></li>
              <li><Link to="/faq" className="hover:text-brand transition">Delivery FAQs & Help</Link></li>
              <li><Link to="/help" className="hover:text-brand transition">Customer Support</Link></li>
              <li><Link to="/terms" className="hover:text-brand transition">Terms & Conditions</Link></li>
              <li><Link to="/privacy-policy" className="hover:text-brand transition">Privacy Policy</Link></li>
              <li className="pt-1.5">
                <a
                  href={`tel:${(settings.contactPhone || '+91 98260 12345').replace(/\s+/g, '')}`}
                  className="flex items-center gap-1.5 text-text-main hover:text-brand transition text-[11px] truncate"
                >
                  <Phone className="w-3.5 h-3.5 text-brand shrink-0" />
                  <span className="truncate">{settings.contactPhone || '+91 98260 12345'}</span>
                </a>
              </li>
              <li>
                <a
                  href={`mailto:${settings.contactEmail || 'support@khushboofood.com'}`}
                  className="flex items-center gap-1.5 text-text-main hover:text-brand transition text-[11px] truncate"
                  title={settings.contactEmail || 'support@khushboofood.com'}
                >
                  <Mail className="w-3.5 h-3.5 text-brand shrink-0" />
                  <span className="truncate">{settings.contactEmail || 'support@khushboofood.com'}</span>
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Operating Zone */}
        <div>
          <h4 className="font-bold text-text-main uppercase tracking-wider text-xs mb-3">{settings.serviceCity || 'Indore'} Delivery Zone</h4>
          <p className="text-xs text-text-muted leading-relaxed mb-3">
            Serving {settings.serviceCity || 'Indore'} within a {settings.maxDeliveryDistanceKm || 15} km radius from {settings.centralHub || 'central hub'}.
          </p>
          <div className="p-3 rounded-xl bg-surface-subtle border border-border-neutral text-[11px] space-y-1">
            <div className="flex justify-between text-text-muted">
              <span>Min Order:</span>
              <span className="font-bold text-text-main">₹{settings.minOrderAmountRupees}</span>
            </div>
            <div className="flex justify-between text-text-muted">
              <span>Free Delivery:</span>
              <span className="font-bold text-brand">Orders above ₹{settings.freeDeliveryThresholdRupees}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Legal */}
      <div className="border-t border-border-neutral py-4 pb-20 sm:pb-4 px-4 text-center text-[11px] text-text-muted">
        <p>© {new Date().getFullYear()} {settings.storeName || 'Khushboo Grocery Service'}, {settings.serviceCity || 'Indore'} (M.P.). All rights reserved.</p>
      </div>
    </footer>
  );
}
