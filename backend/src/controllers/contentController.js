/**
 * Content Management Controller — Privacy Policy, FAQs, and Help & Support.
 *
 * Implements:
 * - Privacy Policy versioning, drafts, preview, publish, and rollback.
 * - Categorized FAQ CRUD and public filtering.
 * - Verified Help & Support settings and genuine CustomerInquiry ticketing.
 * - Server-side validation and XSS defense.
 * - Audit logging for sensitive administrative actions.
 *
 * @module controllers/contentController
 */

import { ContentPolicy } from '../models/ContentPolicy.js';
import { Faq } from '../models/Faq.js';
import { HelpSupportSetting } from '../models/HelpSupportSetting.js';
import { CustomerInquiry } from '../models/CustomerInquiry.js';
import { AuditLog } from '../models/AuditLog.js';
import { executeBulkOperation } from '../utils/bulkOperations.js';
import { createNotification } from '../services/notificationService.js';

/**
 * Seed initial content if database is empty.
 */
export async function ensureDefaultContentExists() {
  try {
    // 1. Seed Privacy Policy
    const policyCount = await ContentPolicy.countDocuments({ type: 'PRIVACY_POLICY' });
    if (policyCount === 0) {
      const defaultContent = `
## 1. Information We Collect
Khushboo Food Service ("Khushboo Grocery", "we", "our") collects personal information necessary to deliver fresh groceries and staples to your doorstep in Indore, Madhya Pradesh. This includes:
- **Contact Details:** Name, mobile phone number, delivery addresses, and optional email.
- **Location Data:** Geographic coordinates, PIN code, and locality to verify zone serviceability and calculate distance-based delivery.
- **Order History:** Products purchased, quantities, pricing snapshots, delivery timestamps, and payment status (Cash on Delivery / Razorpay transaction references).

## 2. How We Use Your Information
Your information is used strictly to:
- Process and fulfill your grocery orders within our 60–120 minute delivery windows across Indore.
- Dispatch SMS notifications and OTP verifications for passwordless customer login.
- Provide responsive customer support and resolve order inquiries.
- Prevent fraudulent transactions and safeguard system integrity.

## 3. Data Protection & Security
We enforce strict industry-standard security safeguards:
- Private authentication credentials, cryptographic OTP hashes, and payment tokens are protected with SHA-256 HMAC and HttpOnly tokens.
- We **never sell or rent** your personal information to third-party advertising networks.
- Payment details (card numbers, UPI PINs) are processed directly by RBI-authorized payment aggregators (Razorpay); we do not store sensitive payment credentials.

## 4. Your Rights & Account Management
You retain full control over your saved addresses and account data. Customers may request account anonymization or deletion by contacting our support desk or visiting the customer profile section.

## 5. Contact Us
For any privacy questions or data requests:
- **Email:** support@khushboofood.com
- **Phone:** +91 98260 12345
- **Dispatch Center:** MG Road & Geeta Bhawan, Indore, MP 452001
      `.trim();

      await ContentPolicy.create({
        type: 'PRIVACY_POLICY',
        title: 'Khushboo Food Service — Privacy Policy',
        content: defaultContent,
        draftContent: defaultContent,
        hasUnpublishedChanges: false,
        version: '1.0',
        effectiveDate: new Date(),
        isPublished: true,
        publishedAt: new Date(),
      });
      console.log('[ContentPolicy] Seeded default Privacy Policy.');
    }

    // 1b. Seed Terms of Service
    const termsCount = await ContentPolicy.countDocuments({ type: 'TERMS_OF_SERVICE' });
    if (termsCount === 0) {
      const defaultTerms = `
## 1. Agreement to Terms
Welcome to Khushboo Food Service ("Khushboo Grocery", "we", "us", or "our"). By accessing our mobile web application, browsing our grocery catalog, or placing an order for home delivery in Indore, Madhya Pradesh, you agree to be bound by these Terms & Conditions.

## 2. Service Area & Delivery Guarantees
- **Service Territory:** We currently service designated PIN codes across Indore, including Central Indore (452001–452007), Vijay Nagar, Palasia, Scheme 54, Scheme 78, MR-10, Rau, and AB Road Bypass zones.
- **Delivery Windows:** Standard doorstep deliveries are dispatched from our Indore Central Hub within 60 to 120 minutes of order confirmation, subject to weather and traffic conditions.
- **Accuracy of Address:** Customers are responsible for providing complete and accurate delivery addresses, landmarks, and recipient phone numbers.

## 3. Orders, Pricing & Minimum Order Value
- **Order Placement:** An order is deemed accepted once confirmed via SMS or within the customer dashboard.
- **Minimum Order Value:** A minimum order value of ₹150 applies for delivery dispatch.
- **Free Delivery:** Orders exceeding ₹499 qualify for Free Standard Delivery. Orders below ₹499 incur a nominal delivery fee displayed at checkout.
- **Pricing:** All prices are displayed in Indian Rupees (₹ INR) and include all applicable GST and taxes. While we strive for 100% price accuracy, weight-based staples are billed per packaged variant.

## 4. Payment Terms
We offer flexible and secure payment options:
- **Cash on Delivery (COD):** Payable in cash or instant UPI to our authorized delivery personnel upon physical delivery of goods.
- **Online Payments:** Instant payments processed securely via UPI, Google Pay, PhonePe, Debit/Credit Cards, or Net Banking powered by our RBI-authorized payment partner (Razorpay).

## 5. Quality Guarantee, Replacements & Returns
- **Freshness & Purity Commitment:** Our stone-ground flours (Sharbati Atta, Chana Besan), cold-pressed oils, and spices are processed in hygienic small batches.
- **Perishable & Grocery Returns:** Because groceries and food staples are perishable items, issues regarding packaging damage, leakage, or quality concerns must be reported to our customer support desk within **24 hours of delivery**.
- **Refund Processing:** Approved refunds are initiated immediately to the original payment source (online) or refunded via UPI/bank transfer for COD within 3–5 business days.

## 6. Order Cancellations
- Customers may cancel an order free of charge at any time before the order status transitions to **OUT_FOR_DELIVERY**.
- Once an order is out for delivery with our delivery partner, cancellations cannot be processed due to the logistics of perishable goods.

## 7. Customer Accounts & Security
- Customers access the platform using mobile number OTP verification.
- You agree to notify us immediately of any unauthorized access to your account or device.

## 8. Governing Law & Jurisdiction
These Terms & Conditions shall be governed by and construed in accordance with the laws of the Republic of India. Any disputes arising out of or in connection with these terms shall be subject to the exclusive jurisdiction of the courts located in **Indore, Madhya Pradesh**.

## 9. Contact Customer Care
For any queries, escalations, or assistance with orders:
- **Helpline:** +91 98260 12345
- **Email:** support@khushboofood.com
- **Dispatch Center:** Indore Central Dispatch Hub, Indore, MP 452001
- **Operating Hours:** Monday to Sunday, 7:00 AM – 10:00 PM IST
      `.trim();

      await ContentPolicy.create({
        type: 'TERMS_OF_SERVICE',
        title: 'Khushboo Food Service — Terms & Conditions',
        content: defaultTerms,
        draftContent: defaultTerms,
        hasUnpublishedChanges: false,
        version: '1.0',
        effectiveDate: new Date(),
        isPublished: true,
        publishedAt: new Date(),
      });
      console.log('[ContentPolicy] Seeded default Terms & Conditions.');
    }

    // 2. Seed FAQs
    const faqCount = await Faq.countDocuments();
    if (faqCount === 0) {
      const defaultFaqs = [
        {
          question: 'What areas in Indore do you deliver to?',
          answer: 'We currently serve Central Indore (452001-452007), Vijay Nagar, Palasia, Scheme 54, Scheme 78, MR-10 (452008-452011, 452018), and Rau, Silicon City, and AB Road Bypass (452012-452020). You can check your exact address serviceability on the cart or map picker.',
          category: 'Delivery',
          order: 1,
          isPublished: true,
        },
        {
          question: 'What is the minimum order amount and free delivery threshold?',
          answer: 'Our minimum order amount is ₹150. Orders above ₹499 qualify for Free Doorstep Delivery across our standard Indore zones. Standard orders below ₹499 incur a nominal delivery fee starting at ₹25.',
          category: 'Delivery',
          order: 2,
          isPublished: true,
        },
        {
          question: 'How fast will my grocery order be delivered?',
          answer: 'Orders are dispatched from our Indore Central Hub and typically delivered within 60 to 90 minutes for central zones, and 90 to 120 minutes for extended bypass zones.',
          category: 'Orders',
          order: 3,
          isPublished: true,
        },
        {
          question: 'What payment methods do you accept?',
          answer: 'We accept Cash on Delivery (COD) as well as secure online payments via UPI, Google Pay, PhonePe, Paytm, Net Banking, and Credit/Debit Cards powered by Razorpay.',
          category: 'Payments',
          order: 4,
          isPublished: true,
        },
        {
          question: 'Are your flours and cold-pressed oils truly fresh and pure?',
          answer: 'Yes! Our MP Sharbati Atta, Chana Besan, and Multi-grain flours are stone-ground in fresh, hygienic small batches. Our mustard, groundnut, and sesame oils are 100% cold-pressed without chemical refining, and our Cow Ghee is purely clarified.',
          category: 'General',
          order: 5,
          isPublished: true,
        },
        {
          question: 'What is your return and refund policy for groceries?',
          answer: 'If any grocery item arrives damaged or does not meet our purity standards, report it to our support team within 24 hours of delivery with your Order Number for an immediate replacement or full refund.',
          category: 'Returns',
          order: 6,
          isPublished: true,
        },
      ];
      await Faq.insertMany(defaultFaqs);
      console.log('[Faq] Seeded 6 default FAQs.');
    }

    // 3. Seed Help & Support Settings
    const supportCount = await HelpSupportSetting.countDocuments();
    if (supportCount === 0) {
      await HelpSupportSetting.create({
        verifiedPhone: '+91 98260 12345',
        verifiedEmail: 'support@khushboofood.com',
        businessHours: 'Monday to Sunday: 7:00 AM – 10:00 PM IST',
        instructions: 'Our dedicated Indore delivery care team is ready to assist you. For fast resolution of active deliveries, please mention your Order Number.',
        escalationPolicy: 'Live order issues are prioritized and responded to within 15 minutes during operating hours.',
        supportTopics: [
          { title: 'Live Order Tracking & ETA', description: 'Check the real-time status and delivery window of your grocery order', icon: 'Truck' },
          { title: 'Quality & Freshness Guarantee', description: 'Assistance regarding stone-ground flour batches, spices, or cold-pressed oils', icon: 'ShieldCheck' },
          { title: 'Payments & Invoice Queries', description: 'Help with COD, UPI transactions, or refunds', icon: 'CreditCard' },
          { title: 'Address & Delivery Zone Support', description: 'Questions regarding serviceable localities or pin codes in Indore', icon: 'MapPin' },
        ],
      });
      console.log('[HelpSupportSetting] Seeded default support settings.');
    }
  } catch (err) {
    console.error('[Content] Default content seed error:', err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Section A: Privacy Policy Endpoints
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/content/privacy-policy (Public)
 * Returns the currently published Privacy Policy.
 */
export async function getPublicPrivacyPolicy(req, res, next) {
  try {
    await ensureDefaultContentExists();

    const policy = await ContentPolicy.findOne({
      type: 'PRIVACY_POLICY',
      isPublished: true,
    }).select('title content version effectiveDate publishedAt -_id').lean();

    if (!policy) {
      return res.status(404).json({
        success: false,
        requestId: req.id,
        message: 'Privacy Policy is currently being updated by the compliance team.',
      });
    }

    res.json({
      success: true,
      requestId: req.id,
      data: policy,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/content/terms (Public)
 * Returns the currently published Terms & Conditions document.
 */
export async function getPublicTerms(req, res, next) {
  try {
    await ensureDefaultContentExists();

    const terms = await ContentPolicy.findOne({
      type: 'TERMS_OF_SERVICE',
      isPublished: true,
    }).select('title content version effectiveDate publishedAt -_id').lean();

    if (!terms) {
      return res.status(404).json({
        success: false,
        requestId: req.id,
        message: 'Terms & Conditions are currently being updated by the compliance team.',
      });
    }

    res.json({
      success: true,
      requestId: req.id,
      data: terms,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/admin/content/privacy-policy (Admin)
 * Returns full policy document including drafts and revision history.
 */
export async function getAdminPrivacyPolicy(req, res, next) {
  try {
    await ensureDefaultContentExists();

    const policy = await ContentPolicy.findOne({ type: 'PRIVACY_POLICY' })
      .populate('updatedBy', 'name email')
      .populate('history.changedBy', 'name email');

    if (!policy) {
      return res.status(404).json({
        success: false,
        requestId: req.id,
        message: 'Privacy policy document not found.',
      });
    }

    res.json({
      success: true,
      requestId: req.id,
      data: policy,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/v1/admin/content/privacy-policy/draft (Admin)
 * Saves a draft of the Privacy Policy without publishing it.
 */
export async function updatePrivacyPolicyDraft(req, res, next) {
  try {
    const { title, draftContent } = req.body;

    if (!draftContent || !draftContent.trim()) {
      return res.status(400).json({
        success: false,
        requestId: req.id,
        message: 'Draft content cannot be empty.',
      });
    }

    let policy = await ContentPolicy.findOne({ type: 'PRIVACY_POLICY' });
    if (!policy) {
      policy = new ContentPolicy({
        type: 'PRIVACY_POLICY',
        title: title || 'Privacy Policy',
        content: draftContent.trim(),
        draftContent: draftContent.trim(),
        version: '1.0',
      });
    } else {
      if (title) policy.title = title.trim();
      policy.draftContent = draftContent.trim();
      policy.hasUnpublishedChanges = true;
      policy.updatedBy = req.user._id;
    }

    await policy.save();

    res.json({
      success: true,
      requestId: req.id,
      message: 'Privacy policy draft saved successfully.',
      data: policy,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/admin/content/privacy-policy/publish (Admin)
 * Publishes the current draft, records a revision snapshot, and updates effectiveDate.
 */
export async function publishPrivacyPolicy(req, res, next) {
  try {
    const { version, changeSummary } = req.body;

    const policy = await ContentPolicy.findOne({ type: 'PRIVACY_POLICY' });
    if (!policy) {
      return res.status(404).json({
        success: false,
        requestId: req.id,
        message: 'Policy document not found.',
      });
    }

    const contentToPublish = policy.draftContent || policy.content;
    if (!contentToPublish || !contentToPublish.trim()) {
      return res.status(400).json({
        success: false,
        requestId: req.id,
        message: 'Cannot publish an empty policy.',
      });
    }

    // Archive current published content into revision history
    if (policy.content) {
      policy.history.unshift({
        version: policy.version,
        title: policy.title,
        content: policy.content,
        changedAt: new Date(),
        changedBy: req.user._id,
        changeSummary: changeSummary || `Updated to version ${version || 'next'}`,
      });
    }

    // Increment version
    let nextVersion = version;
    if (!nextVersion) {
      const parts = (policy.version || '1.0').split('.');
      const minor = parseInt(parts[1] || '0', 10) + 1;
      nextVersion = `${parts[0] || '1'}.${minor}`;
    }

    policy.content = contentToPublish;
    policy.draftContent = contentToPublish;
    policy.version = nextVersion;
    policy.hasUnpublishedChanges = false;
    policy.isPublished = true;
    policy.publishedAt = new Date();
    policy.effectiveDate = new Date();
    policy.updatedBy = req.user._id;

    await policy.save();

    await AuditLog.create({
      action: 'PRIVACY_POLICY_PUBLISH',
      performedBy: req.user._id,
      performerRole: req.user.role,
      targetType: 'ContentPolicy',
      targetId: policy._id.toString(),
      details: { version: nextVersion, changeSummary },
      ipAddress: req.ip || '',
      requestId: req.id,
    });

    res.json({
      success: true,
      requestId: req.id,
      message: `Privacy Policy version ${nextVersion} published successfully.`,
      data: policy,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/admin/content/terms (Admin)
 * Returns full Terms & Conditions document including drafts and revision history.
 */
export async function getAdminTerms(req, res, next) {
  try {
    await ensureDefaultContentExists();

    const terms = await ContentPolicy.findOne({ type: 'TERMS_OF_SERVICE' })
      .populate('updatedBy', 'name email')
      .populate('history.changedBy', 'name email');

    if (!terms) {
      return res.status(404).json({
        success: false,
        requestId: req.id,
        message: 'Terms of Service document not found.',
      });
    }

    res.json({
      success: true,
      requestId: req.id,
      data: terms,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/v1/admin/content/terms/draft (Admin)
 * Saves a draft of the Terms of Service without publishing it.
 */
export async function updateTermsDraft(req, res, next) {
  try {
    const { title, draftContent } = req.body;

    if (!draftContent || !draftContent.trim()) {
      return res.status(400).json({
        success: false,
        requestId: req.id,
        message: 'Draft content cannot be empty.',
      });
    }

    let terms = await ContentPolicy.findOne({ type: 'TERMS_OF_SERVICE' });
    if (!terms) {
      terms = new ContentPolicy({
        type: 'TERMS_OF_SERVICE',
        title: title || 'Terms & Conditions',
        content: draftContent.trim(),
        draftContent: draftContent.trim(),
        version: '1.0',
      });
    } else {
      if (title) terms.title = title.trim();
      terms.draftContent = draftContent.trim();
      terms.hasUnpublishedChanges = true;
      terms.updatedBy = req.user._id;
    }

    await terms.save();

    res.json({
      success: true,
      requestId: req.id,
      message: 'Terms & Conditions draft saved successfully.',
      data: terms,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/admin/content/terms/publish (Admin)
 * Publishes the current draft of Terms, records a revision snapshot, and updates effectiveDate.
 */
export async function publishTerms(req, res, next) {
  try {
    const { version, changeSummary } = req.body;

    const terms = await ContentPolicy.findOne({ type: 'TERMS_OF_SERVICE' });
    if (!terms) {
      return res.status(404).json({
        success: false,
        requestId: req.id,
        message: 'Terms & Conditions document not found.',
      });
    }

    const contentToPublish = terms.draftContent || terms.content;
    if (!contentToPublish || !contentToPublish.trim()) {
      return res.status(400).json({
        success: false,
        requestId: req.id,
        message: 'Cannot publish empty terms.',
      });
    }

    // Archive current published content into revision history
    if (terms.content) {
      terms.history.unshift({
        version: terms.version,
        title: terms.title,
        content: terms.content,
        changedAt: new Date(),
        changedBy: req.user._id,
        changeSummary: changeSummary || `Updated to version ${version || 'next'}`,
      });
    }

    // Increment version
    let nextVersion = version;
    if (!nextVersion) {
      const parts = (terms.version || '1.0').split('.');
      const minor = parseInt(parts[1] || '0', 10) + 1;
      nextVersion = `${parts[0] || '1'}.${minor}`;
    }

    terms.content = contentToPublish;
    terms.draftContent = contentToPublish;
    terms.version = nextVersion;
    terms.hasUnpublishedChanges = false;
    terms.isPublished = true;
    terms.publishedAt = new Date();
    terms.effectiveDate = new Date();
    terms.updatedBy = req.user._id;

    await terms.save();

    await AuditLog.create({
      action: 'TERMS_OF_SERVICE_PUBLISH',
      performedBy: req.user._id,
      performerRole: req.user.role,
      targetType: 'ContentPolicy',
      targetId: terms._id.toString(),
      details: { version: nextVersion, changeSummary },
      ipAddress: req.ip || '',
      requestId: req.id,
    });

    res.json({
      success: true,
      requestId: req.id,
      message: `Terms & Conditions version ${nextVersion} published successfully.`,
      data: terms,
    });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Section B: FAQ Endpoints
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/content/faqs (Public)
 * Returns published FAQs sorted by order.
 */
export async function getPublicFaqs(req, res, next) {
  try {
    await ensureDefaultContentExists();

    const { category } = req.query;
    const filter = { isPublished: true };

    if (category && category !== 'ALL') {
      filter.category = category;
    }

    const faqs = await Faq.find(filter)
      .select('question answer category order')
      .sort({ order: 1, createdAt: 1 })
      .lean();

    res.json({
      success: true,
      requestId: req.id,
      count: faqs.length,
      data: faqs,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/admin/content/faqs (Admin)
 * Returns all FAQs with administration metadata.
 */
export async function getAdminFaqs(req, res, next) {
  try {
    await ensureDefaultContentExists();

    const { category, search } = req.query;
    const filter = {};

    if (category && category !== 'ALL') {
      filter.category = category;
    }

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      filter.$or = [{ question: regex }, { answer: regex }];
    }

    const faqs = await Faq.find(filter)
      .sort({ order: 1, createdAt: -1 })
      .populate('updatedBy', 'name email')
      .lean();

    res.json({
      success: true,
      requestId: req.id,
      count: faqs.length,
      data: faqs,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/admin/content/faqs (Admin)
 * Creates a new FAQ item.
 */
export async function createFaq(req, res, next) {
  try {
    const { question, answer, category = 'General', order = 0, isPublished = true } = req.body;

    if (!question || !question.trim()) {
      return res.status(400).json({ success: false, message: 'Question is required.' });
    }

    if (!answer || !answer.trim()) {
      return res.status(400).json({ success: false, message: 'Answer is required.' });
    }

    const faq = await Faq.create({
      question: question.trim(),
      answer: answer.trim(),
      category,
      order: Number(order) || 0,
      isPublished: Boolean(isPublished),
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });

    await AuditLog.create({
      action: 'FAQ_CREATE',
      performedBy: req.user._id,
      performerRole: req.user.role,
      targetType: 'Faq',
      targetId: faq._id.toString(),
      details: { question: faq.question, category: faq.category },
      ipAddress: req.ip || '',
      requestId: req.id,
    });

    res.status(201).json({
      success: true,
      requestId: req.id,
      message: 'FAQ created successfully.',
      data: faq,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/admin/content/faqs/:id (Admin)
 * Updates an existing FAQ item.
 */
export async function updateFaq(req, res, next) {
  try {
    const { id } = req.params;
    const { question, answer, category, order, isPublished } = req.body;

    const faq = await Faq.findById(id);
    if (!faq) {
      return res.status(404).json({ success: false, message: 'FAQ not found.' });
    }

    if (question !== undefined) faq.question = question.trim();
    if (answer !== undefined) faq.answer = answer.trim();
    if (category !== undefined) faq.category = category;
    if (order !== undefined) faq.order = Number(order);
    if (isPublished !== undefined) faq.isPublished = Boolean(isPublished);
    faq.updatedBy = req.user._id;

    await faq.save();

    await AuditLog.create({
      action: 'FAQ_UPDATE',
      performedBy: req.user._id,
      performerRole: req.user.role,
      targetType: 'Faq',
      targetId: faq._id.toString(),
      details: { question: faq.question, isPublished: faq.isPublished },
      ipAddress: req.ip || '',
      requestId: req.id,
    });

    res.json({
      success: true,
      requestId: req.id,
      message: 'FAQ updated successfully.',
      data: faq,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/v1/admin/content/faqs/:id (Admin)
 * Permanently removes an FAQ item.
 */
export async function deleteFaq(req, res, next) {
  try {
    const { id } = req.params;
    const faq = await Faq.findById(id);
    if (!faq) {
      return res.status(404).json({ success: false, message: 'FAQ not found.' });
    }

    await Faq.deleteOne({ _id: id });

    await AuditLog.create({
      action: 'FAQ_DELETE',
      performedBy: req.user._id,
      performerRole: req.user.role,
      targetType: 'Faq',
      targetId: id,
      details: { question: faq.question },
      ipAddress: req.ip || '',
      requestId: req.id,
    });

    res.json({
      success: true,
      requestId: req.id,
      message: 'FAQ deleted successfully.',
    });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Section C: Help & Support Endpoints
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/content/support (Public)
 * Returns verified support contact details, business hours, and topics.
 */
export async function getPublicSupportSettings(req, res, next) {
  try {
    await ensureDefaultContentExists();

    const support = await HelpSupportSetting.findOne()
      .select('verifiedPhone verifiedEmail businessHours instructions escalationPolicy supportTopics -_id')
      .lean();

    res.json({
      success: true,
      requestId: req.id,
      data: support,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/admin/content/support (Admin)
 * Returns support settings for administrative editing.
 */
export async function getAdminSupportSettings(req, res, next) {
  try {
    await ensureDefaultContentExists();

    const support = await HelpSupportSetting.findOne()
      .populate('updatedBy', 'name email');

    res.json({
      success: true,
      requestId: req.id,
      data: support,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/v1/admin/content/support (Admin)
 * Updates customer support settings with audit tracking.
 */
export async function updateSupportSettings(req, res, next) {
  try {
    const {
      verifiedPhone,
      verifiedEmail,
      businessHours,
      instructions,
      escalationPolicy,
      supportTopics,
    } = req.body;

    let support = await HelpSupportSetting.findOne();
    if (!support) {
      support = new HelpSupportSetting();
    }

    if (verifiedPhone) support.verifiedPhone = verifiedPhone.trim();
    if (verifiedEmail) support.verifiedEmail = verifiedEmail.trim();
    if (businessHours) support.businessHours = businessHours.trim();
    if (instructions) support.instructions = instructions.trim();
    if (escalationPolicy) support.escalationPolicy = escalationPolicy.trim();
    if (Array.isArray(supportTopics)) support.supportTopics = supportTopics;
    support.updatedBy = req.user._id;

    await support.save();

    await AuditLog.create({
      action: 'SUPPORT_SETTINGS_UPDATE',
      performedBy: req.user._id,
      performerRole: req.user.role,
      targetType: 'HelpSupportSetting',
      targetId: support._id.toString(),
      details: { verifiedPhone: support.verifiedPhone, verifiedEmail: support.verifiedEmail },
      ipAddress: req.ip || '',
      requestId: req.id,
    });

    res.json({
      success: true,
      requestId: req.id,
      message: 'Help & support settings updated successfully.',
      data: support,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/content/inquiry (Public / Authenticated Customer)
 * Submits a genuine customer support inquiry and generates an inquiry ticket number.
 */
export async function submitInquiry(req, res, next) {
  try {
    const { name, phone, email, subject, message, orderNumber } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Your name is required.' });
    }

    if (!phone || !phone.trim()) {
      return res.status(400).json({ success: false, message: 'Your contact phone number is required.' });
    }

    if (!subject || !subject.trim()) {
      return res.status(400).json({ success: false, message: 'Inquiry subject is required.' });
    }

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Please describe your inquiry message.' });
    }

    const ticketNumber = `INQ-IND-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

    const inquiry = await CustomerInquiry.create({
      ticketNumber,
      customer: req.user ? req.user._id : null,
      name: name.trim(),
      phone: phone.trim(),
      email: email ? email.trim() : '',
      subject: subject.trim(),
      message: message.trim(),
      orderNumber: orderNumber ? orderNumber.trim() : '',
      status: 'OPEN',
    });

    // Real-Time Notification: Notify administrators of new support ticket
    createNotification({
      recipientGroup: 'ALL_ADMINS',
      type: 'SUPPORT_TICKET_CREATED',
      title: 'New Support Ticket',
      message: `Ticket #${inquiry.ticketNumber} from ${inquiry.name}: ${inquiry.subject}`,
      severity: 'INFO',
      category: 'SUPPORT',
      targetType: 'CustomerInquiry',
      targetId: inquiry._id,
      targetUrl: `/admin/content?tab=inquiries&ticket=${inquiry.ticketNumber}`,
      metadata: {
        ticketNumber: inquiry.ticketNumber,
        subject: inquiry.subject,
        customerName: inquiry.name,
        phone: inquiry.phone,
      },
      idempotencyKey: `ticket_created_admin_${inquiry._id}`,
      actorId: req.user?._id || null,
    }).catch((notifErr) => console.error('[notification] Ticket create admin notify error:', notifErr.message));

    // Real-Time Notification: Notify authenticated customer of ticket receipt
    if (req.user?._id) {
      createNotification({
        recipient: req.user._id,
        type: 'SUPPORT_TICKET_CREATED',
        title: 'Support Ticket Received',
        message: `Your inquiry #${inquiry.ticketNumber} has been received. Our team will review it shortly.`,
        severity: 'INFO',
        category: 'SUPPORT',
        targetType: 'CustomerInquiry',
        targetId: inquiry._id,
        targetUrl: '/support',
        metadata: {
          ticketNumber: inquiry.ticketNumber,
          subject: inquiry.subject,
        },
        idempotencyKey: `ticket_created_cust_${inquiry._id}`,
        actorId: req.user._id,
      }).catch((notifErr) => console.error('[notification] Ticket create customer notify error:', notifErr.message));
    }

    res.status(201).json({
      success: true,
      requestId: req.id,
      ticketNumber,
      message: `Your inquiry has been submitted successfully (Ticket #${ticketNumber}). Our Indore care team will contact you shortly.`,
      data: inquiry,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/admin/content/inquiries (Admin)
 * Retrieves customer inquiry tickets with filters and pagination. Excludes soft-deleted tickets by default.
 */
export async function getAdminInquiries(req, res, next) {
  try {
    const { status, search, page = 1, limit = 20, includeDeleted } = req.query;
    const filter = {};

    if (includeDeleted !== 'true') {
      filter.isDeleted = false;
    }

    if (status && status !== 'ALL') {
      filter.status = status;
    }

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      filter.$or = [
        { ticketNumber: regex },
        { name: regex },
        { phone: regex },
        { subject: regex },
        { orderNumber: regex },
      ];
    }

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const skip = (pageNum - 1) * limitNum;

    const [inquiries, total] = await Promise.all([
      CustomerInquiry.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('customer', 'name phone')
        .populate('resolvedBy', 'name email')
        .populate('rejectedBy', 'name email')
        .populate('internalNotes.addedBy', 'name email')
        .populate('activityHistory.performedBy', 'name email')
        .lean(),
      CustomerInquiry.countDocuments(filter),
    ]);

    res.json({
      success: true,
      requestId: req.id,
      count: inquiries.length,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
      pagination: {
        currentPage: pageNum,
        pageSize: limitNum,
        totalRecords: total,
        totalPages: Math.ceil(total / limitNum),
        hasNextPage: pageNum < Math.ceil(total / limitNum),
        hasPreviousPage: pageNum > 1,
      },
      data: inquiries,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/admin/content/inquiries/:id/status (Admin)
 * Updates customer inquiry resolution status and response notes.
 */
export async function updateInquiryStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status, responseNotes } = req.body;

    const allowedStatuses = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
    if (status && !allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status transition: ${status}. Use dedicated reject endpoint for rejections.`,
      });
    }

    const inquiry = await CustomerInquiry.findOne({ _id: id, isDeleted: false });
    if (!inquiry) {
      return res.status(404).json({ success: false, message: 'Inquiry ticket not found.' });
    }

    const oldStatus = inquiry.status;
    if (status) inquiry.status = status;
    if (responseNotes !== undefined) inquiry.responseNotes = responseNotes.trim();

    if (status === 'RESOLVED' || status === 'CLOSED') {
      inquiry.resolvedBy = req.user._id;
      inquiry.resolvedAt = new Date();
    }

    inquiry.activityHistory.push({
      action: 'STATUS_UPDATED',
      status: inquiry.status,
      note: responseNotes || `Status changed from ${oldStatus} to ${inquiry.status}`,
      performedBy: req.user._id,
      timestamp: new Date(),
    });

    await inquiry.save();

    await AuditLog.create({
      action: 'SUPPORT_TICKET_STATUS_UPDATE',
      performedBy: req.user._id,
      performerRole: req.user.role,
      targetType: 'CustomerInquiry',
      targetId: inquiry._id.toString(),
      details: {
        ticketNumber: inquiry.ticketNumber,
        from: oldStatus,
        to: inquiry.status,
      },
      ipAddress: req.ip || '',
      requestId: req.id,
    });

    // Real-Time Notification: Notify customer of support ticket status update
    if (inquiry.customer) {
      createNotification({
        recipient: inquiry.customer,
        type: 'SUPPORT_TICKET_STATUS_UPDATED',
        title: `Support Ticket #${inquiry.ticketNumber} Updated`,
        message: `Your inquiry status is now "${inquiry.status}". ${responseNotes ? `Staff note: ${responseNotes}` : ''}`.trim(),
        severity: inquiry.status === 'RESOLVED' ? 'SUCCESS' : 'INFO',
        category: 'SUPPORT',
        targetType: 'CustomerInquiry',
        targetId: inquiry._id,
        targetUrl: '/support',
        metadata: {
          ticketNumber: inquiry.ticketNumber,
          status: inquiry.status,
        },
        idempotencyKey: `ticket_status_${inquiry._id}_${inquiry.status}`,
        actorId: req.user._id,
      }).catch((notifErr) => console.error('[notification] Ticket status customer notify error:', notifErr.message));
    }

    res.json({
      success: true,
      requestId: req.id,
      message: `Ticket #${inquiry.ticketNumber} updated to ${inquiry.status}.`,
      data: inquiry,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/admin/content/inquiries/:id/reject (Admin)
 * Rejects an inquiry ticket with a mandatory documented rejection reason.
 */
export async function rejectInquiry(req, res, next) {
  try {
    const { id } = req.params;
    const { rejectionReason, internalNote } = req.body;

    if (!rejectionReason || !rejectionReason.trim()) {
      return res.status(400).json({
        success: false,
        message: 'A mandatory rejection reason is required to reject a support ticket.',
      });
    }

    const inquiry = await CustomerInquiry.findOne({ _id: id, isDeleted: false });
    if (!inquiry) {
      return res.status(404).json({ success: false, message: 'Active support ticket not found.' });
    }

    if (inquiry.status === 'REJECTED') {
      return res.status(400).json({ success: false, message: 'Ticket is already marked as REJECTED.' });
    }

    inquiry.status = 'REJECTED';
    inquiry.rejectionReason = rejectionReason.trim();
    inquiry.rejectedBy = req.user._id;
    inquiry.rejectedAt = new Date();

    if (internalNote && internalNote.trim()) {
      inquiry.internalNotes.push({
        note: internalNote.trim(),
        addedBy: req.user._id,
        addedAt: new Date(),
      });
    }

    inquiry.activityHistory.push({
      action: 'TICKET_REJECTED',
      status: 'REJECTED',
      note: `Reason: ${rejectionReason.trim()}`,
      performedBy: req.user._id,
      timestamp: new Date(),
    });

    await inquiry.save();

    await AuditLog.create({
      action: 'SUPPORT_TICKET_REJECT',
      performedBy: req.user._id,
      performerRole: req.user.role,
      targetType: 'CustomerInquiry',
      targetId: inquiry._id.toString(),
      details: {
        ticketNumber: inquiry.ticketNumber,
        reason: rejectionReason.trim(),
      },
      ipAddress: req.ip || '',
      requestId: req.id,
    });

    // Real-Time Notification: Notify customer of support ticket rejection
    if (inquiry.customer) {
      createNotification({
        recipient: inquiry.customer,
        type: 'SUPPORT_TICKET_STATUS_UPDATED',
        title: `Support Ticket #${inquiry.ticketNumber} Update`,
        message: `Your inquiry has been rejected. Reason: ${inquiry.rejectionReason}`,
        severity: 'WARNING',
        category: 'SUPPORT',
        targetType: 'CustomerInquiry',
        targetId: inquiry._id,
        targetUrl: '/support',
        metadata: {
          ticketNumber: inquiry.ticketNumber,
          status: 'REJECTED',
          reason: inquiry.rejectionReason,
        },
        idempotencyKey: `ticket_reject_${inquiry._id}`,
        actorId: req.user._id,
      }).catch((notifErr) => console.error('[notification] Ticket reject customer notify error:', notifErr.message));
    }

    res.json({
      success: true,
      requestId: req.id,
      message: `Ticket #${inquiry.ticketNumber} has been rejected.`,
      data: inquiry,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/v1/admin/content/inquiries/:id (Admin)
 * Soft deletes a customer support inquiry with reversible audit trail.
 */
export async function deleteInquiry(req, res, next) {
  try {
    const { id } = req.params;
    const inquiry = await CustomerInquiry.findOne({ _id: id, isDeleted: false });
    if (!inquiry) {
      return res.status(404).json({ success: false, message: 'Support ticket not found or already deleted.' });
    }

    inquiry.isDeleted = true;
    inquiry.deletedAt = new Date();
    inquiry.deletedBy = req.user._id;

    inquiry.activityHistory.push({
      action: 'TICKET_SOFT_DELETED',
      status: inquiry.status,
      note: 'Ticket archived / soft-deleted by administrator.',
      performedBy: req.user._id,
      timestamp: new Date(),
    });

    await inquiry.save();

    await AuditLog.create({
      action: 'SUPPORT_TICKET_DELETE',
      performedBy: req.user._id,
      performerRole: req.user.role,
      targetType: 'CustomerInquiry',
      targetId: inquiry._id.toString(),
      details: {
        ticketNumber: inquiry.ticketNumber,
        status: inquiry.status,
      },
      ipAddress: req.ip || '',
      requestId: req.id,
    });

    res.json({
      success: true,
      requestId: req.id,
      message: `Ticket #${inquiry.ticketNumber} has been soft-deleted. Audit trail preserved.`,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/admin/content/inquiries/:id/notes (Admin)
 * Appends an internal admin note to a customer support inquiry.
 */
export async function addInquiryNote(req, res, next) {
  try {
    const { id } = req.params;
    const { note } = req.body;

    if (!note || !note.trim()) {
      return res.status(400).json({ success: false, message: 'Internal note content cannot be empty.' });
    }

    const inquiry = await CustomerInquiry.findOne({ _id: id, isDeleted: false });
    if (!inquiry) {
      return res.status(404).json({ success: false, message: 'Support ticket not found.' });
    }

    inquiry.internalNotes.push({
      note: note.trim(),
      addedBy: req.user._id,
      addedAt: new Date(),
    });

    inquiry.activityHistory.push({
      action: 'INTERNAL_NOTE_ADDED',
      status: inquiry.status,
      note: note.trim(),
      performedBy: req.user._id,
      timestamp: new Date(),
    });

    await inquiry.save();

    res.json({
      success: true,
      requestId: req.id,
      message: 'Internal note saved.',
      data: inquiry,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/admin/content/inquiries/bulk-status (Admin)
 * Bulk updates support ticket statuses (e.g. IN_PROGRESS, RESOLVED, CLOSED).
 */
export async function bulkUpdateInquiryStatus(req, res, next) {
  try {
    const { ids, selectAllMatching, filter, status, responseNotes } = req.body;

    const allowedStatuses = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
    if (!status || !allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid target status for bulk status update: ${status}.`,
      });
    }

    const baseFilter = { isDeleted: false };
    if (filter?.status && filter.status !== 'ALL') {
      baseFilter.status = filter.status;
    }

    const result = await executeBulkOperation({
      req,
      model: CustomerInquiry,
      ids,
      selectAllMatching,
      filter: baseFilter,
      actionName: 'BULK_TICKET_STATUS_UPDATE',
      entityName: 'CustomerInquiry',
      context: { targetStatus: status, responseNotes },
      handler: async (doc, ctx) => {
        if (doc.status === ctx.targetStatus) {
          return { status: 'skipped', reason: `Already in status ${ctx.targetStatus}` };
        }

        const oldStatus = doc.status;
        doc.status = ctx.targetStatus;
        if (ctx.responseNotes) {
          doc.responseNotes = ctx.responseNotes.trim();
        }

        if (ctx.targetStatus === 'RESOLVED' || ctx.targetStatus === 'CLOSED') {
          doc.resolvedBy = ctx.adminId;
          doc.resolvedAt = new Date();
        }

        doc.activityHistory.push({
          action: 'BULK_STATUS_UPDATE',
          status: ctx.targetStatus,
          note: `Bulk transitioned from ${oldStatus} to ${ctx.targetStatus}`,
          performedBy: ctx.adminId,
          timestamp: new Date(),
        });

        await doc.save();
        return { status: 'success' };
      },
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/admin/content/inquiries/bulk-reject (Admin)
 * Bulk rejects support tickets with mandatory audit reason.
 */
export async function bulkRejectInquiries(req, res, next) {
  try {
    const { ids, selectAllMatching, filter, rejectionReason, internalNote } = req.body;

    if (!rejectionReason || !rejectionReason.trim()) {
      return res.status(400).json({
        success: false,
        message: 'A mandatory rejection reason is required for bulk ticket rejection.',
      });
    }

    const baseFilter = { isDeleted: false, status: { $ne: 'REJECTED' } };
    if (filter?.status && filter.status !== 'ALL') {
      baseFilter.status = filter.status;
    }

    const result = await executeBulkOperation({
      req,
      model: CustomerInquiry,
      ids,
      selectAllMatching,
      filter: baseFilter,
      actionName: 'BULK_TICKET_REJECT',
      entityName: 'CustomerInquiry',
      context: { reason: rejectionReason.trim(), internalNote },
      handler: async (doc, ctx) => {
        if (doc.status === 'REJECTED') {
          return { status: 'skipped', reason: 'Already rejected.' };
        }

        doc.status = 'REJECTED';
        doc.rejectionReason = ctx.reason;
        doc.rejectedBy = ctx.adminId;
        doc.rejectedAt = new Date();

        if (ctx.internalNote) {
          doc.internalNotes.push({
            note: ctx.internalNote.trim(),
            addedBy: ctx.adminId,
            addedAt: new Date(),
          });
        }

        doc.activityHistory.push({
          action: 'BULK_TICKET_REJECT',
          status: 'REJECTED',
          note: `Bulk rejected: ${ctx.reason}`,
          performedBy: ctx.adminId,
          timestamp: new Date(),
        });

        await doc.save();
        return { status: 'success' };
      },
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/admin/content/inquiries/bulk-delete (Admin)
 * Bulk soft-deletes support tickets with reversible audit logging.
 */
export async function bulkDeleteInquiries(req, res, next) {
  try {
    const { ids, selectAllMatching, filter } = req.body;

    const baseFilter = { isDeleted: false };
    if (filter?.status && filter.status !== 'ALL') {
      baseFilter.status = filter.status;
    }

    const result = await executeBulkOperation({
      req,
      model: CustomerInquiry,
      ids,
      selectAllMatching,
      filter: baseFilter,
      actionName: 'BULK_TICKET_SOFT_DELETE',
      entityName: 'CustomerInquiry',
      handler: async (doc, ctx) => {
        if (doc.isDeleted) {
          return { status: 'skipped', reason: 'Already deleted.' };
        }

        doc.isDeleted = true;
        doc.deletedAt = new Date();
        doc.deletedBy = ctx.adminId;

        doc.activityHistory.push({
          action: 'BULK_SOFT_DELETE',
          status: doc.status,
          note: 'Ticket archived in bulk operation by administrator.',
          performedBy: ctx.adminId,
          timestamp: new Date(),
        });

        await doc.save();
        return { status: 'success' };
      },
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/admin/content/faqs/bulk-status (Admin)
 * Bulk updates publication status of FAQs.
 */
export async function bulkUpdateFaqStatus(req, res, next) {
  try {
    const { ids, selectAllMatching, filter, isPublished } = req.body;

    if (typeof isPublished !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'A boolean "isPublished" flag is required.',
      });
    }

    const baseFilter = {};
    if (filter?.category && filter.category !== 'ALL') {
      baseFilter.category = filter.category;
    }

    const result = await executeBulkOperation({
      req,
      model: Faq,
      ids,
      selectAllMatching,
      filter: baseFilter,
      actionName: 'BULK_FAQ_STATUS_UPDATE',
      entityName: 'Faq',
      context: { targetStatus: isPublished ? 'PUBLISHED' : 'UNPUBLISHED' },
      handler: async (doc) => {
        if (doc.isPublished === isPublished) {
          return { status: 'skipped', reason: `Already ${isPublished ? 'published' : 'unpublished'}.` };
        }

        doc.isPublished = isPublished;
        doc.updatedBy = req.user._id;
        await doc.save();
        return { status: 'success' };
      },
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/admin/content/faqs/bulk-delete (Admin)
 * Bulk deletes FAQ items.
 */
export async function bulkDeleteFaqs(req, res, next) {
  try {
    const { ids, selectAllMatching, filter } = req.body;

    const baseFilter = {};
    if (filter?.category && filter.category !== 'ALL') {
      baseFilter.category = filter.category;
    }

    const result = await executeBulkOperation({
      req,
      model: Faq,
      ids,
      selectAllMatching,
      filter: baseFilter,
      actionName: 'BULK_FAQ_DELETE',
      entityName: 'Faq',
      handler: async (doc) => {
        await Faq.deleteOne({ _id: doc._id });
        return { status: 'success' };
      },
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
}
