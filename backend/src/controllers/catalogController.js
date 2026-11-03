/**
 * Catalog Controller — Categories and Products.
 *
 * Implements public catalog browsing, variant selection, keyword search,
 * and administrative CRUD. Automatically ensures real Indian grocery items
 * exist in MongoDB when empty.
 *
 * @module controllers/catalogController
 */

import { Category } from '../models/Category.js';
import { Product } from '../models/Product.js';
import { Banner } from '../models/Banner.js';
import { User } from '../models/User.js';
import { deleteFile } from '../services/fileStorageService.js';
import { AuditLog } from '../models/AuditLog.js';
import { createNotification } from '../services/notificationService.js';

/**
 * GET /api/v1/categories
 * Returns active grocery departments sorted by display order.
 */
export async function getCategories(req, res, next) {
  try {
    const categories = await Category.find({ isActive: true })
      .select('name slug description image order isActive')
      .sort({ order: 1, name: 1 })
      .lean();

    res.set('Cache-Control', 'public, max-age=60, s-maxage=120, stale-while-revalidate=300');

    res.json({
      success: true,
      requestId: req.id,
      count: categories.length,
      data: categories,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/products
 * Returns filtered, searched, paginated grocery items with variants.
 */
export async function getProducts(req, res, next) {
  try {
    const query = req.validatedQuery || req.query || {};
    const {
      category,
      search,
      minPrice,
      maxPrice,
      inStock,
      sort = 'newest',
      page = 1,
      limit = 20,
    } = query;

    const filter = { isPublished: true };

    // 1. Category filter by slug or ObjectId
    if (category && category !== 'All' && category !== 'all') {
      if (/^[0-9a-fA-F]{24}$/.test(category)) {
        filter.category = category;
      } else {
        const catDoc = await Category.findOne({ slug: category.toLowerCase() });
        if (catDoc) {
          filter.category = catDoc._id;
        } else {
          // Category slug does not exist, return empty data
          return res.json({
            success: true,
            requestId: req.id,
            count: 0,
            total: 0,
            page: Number(page),
            totalPages: 0,
            data: [],
          });
        }
      }
    }

    // 2. Keyword Search
    if (search && search.trim()) {
      const escaped = search.trim().replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      filter.$or = [
        { name: regex },
        { description: regex },
        { brand: regex },
        { tags: regex },
        { 'variants.label': regex },
      ];
    }

    // 3. Price filter (in integer paise)
    if (minPrice !== undefined || maxPrice !== undefined) {
      filter['variants.pricePaise'] = {};
      if (minPrice !== undefined) {
        filter['variants.pricePaise'].$gte = Number(minPrice);
      }
      if (maxPrice !== undefined) {
        filter['variants.pricePaise'].$lte = Number(maxPrice);
      }
    }

    // 4. In Stock filter
    if (inStock === true) {
      filter['variants.stock'] = { $gt: 0 };
    }

    // 5. Sorting
    let sortOptions = { createdAt: -1 };
    if (sort === 'price_asc') {
      sortOptions = { 'variants.0.pricePaise': 1 };
    } else if (sort === 'price_desc') {
      sortOptions = { 'variants.0.pricePaise': -1 };
    } else if (sort === 'name_asc') {
      sortOptions = { name: 1 };
    }

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(50, Math.max(1, Number(limit)));
    const skip = (pageNum - 1) * limitNum;

    const [products, total] = await Promise.all([
      Product.find(filter)
        .select('name slug brand images isVeg category tags variants.sku variants.label variants.unit variants.quantity variants.pricePaise variants.mrpPaise variants.stock createdAt')
        .populate('category', 'name slug image')
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Product.countDocuments(filter),
    ]);

    res.set('Cache-Control', 'public, max-age=30, s-maxage=60, stale-while-revalidate=180');

    res.json({
      success: true,
      requestId: req.id,
      count: products.length,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
      data: products,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/products/:slugOrId
 * Returns a single product with full variant details.
 */
export async function getProductBySlugOrId(req, res, next) {
  try {
    const { slugOrId } = req.params;

    const isObjectId = /^[0-9a-fA-F]{24}$/.test(slugOrId);
    const query = isObjectId ? { _id: slugOrId } : { slug: slugOrId };

    const product = await Product.findOne(query)
      .populate('category', 'name slug image')
      .lean();

    if (!product || (!product.isPublished && req.user?.role !== 'ADMIN' && req.user?.role !== 'SUPER_ADMIN')) {
      return res.status(404).json({
        success: false,
        requestId: req.id,
        message: 'Product not found.',
      });
    }

    res.set('Cache-Control', 'public, max-age=60, s-maxage=120, stale-while-revalidate=300');

    res.json({
      success: true,
      requestId: req.id,
      data: product,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/products (Admin only)
 * Creates a new grocery item with variants.
 */
export async function createProduct(req, res, next) {
  try {
    const productData = req.body;

    const existing = await Product.findOne({ slug: productData.slug });
    if (existing) {
      return res.status(409).json({
        success: false,
        requestId: req.id,
        message: `Product with slug "${productData.slug}" already exists.`,
      });
    }

    const product = await Product.create(productData);

    await AuditLog.create({
      action: 'PRODUCT_CREATE',
      performedBy: req.user._id,
      performerRole: req.user.role,
      targetType: 'Product',
      targetId: product._id.toString(),
      details: { name: product.name, skuList: product.variants.map((v) => v.sku) },
      ipAddress: req.ip || '',
      requestId: req.id,
    });

    // Real-Time Notification: Notify all customers when a product is published
    if (product.isPublished) {
      createNotification({
        recipientGroup: 'ALL_CUSTOMERS',
        type: 'PRODUCT_PUBLISHED',
        title: 'New Product Available!',
        message: `${product.name} is now available in our grocery store.`,
        severity: 'INFO',
        category: 'PRODUCT',
        targetType: 'Product',
        targetId: product._id,
        targetUrl: `/product/${product.slug}`,
        metadata: {
          productName: product.name,
          slug: product.slug,
        },
        idempotencyKey: `prod_pub_${product._id}`,
        actorId: req.user._id,
      }).catch((notifErr) => console.error('[notification] Product published customer notify error:', notifErr.message));
    }

    res.status(201).json({
      success: true,
      requestId: req.id,
      message: 'Product created successfully.',
      data: product,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/v1/products/:id (Admin only)
 * Updates product details and variants.
 */
export async function updateProduct(req, res, next) {
  try {
    const { id } = req.params;
    const updates = req.body;

    const existingProduct = await Product.findById(id);
    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        requestId: req.id,
        message: 'Product not found.',
      });
    }

    const oldImages = existingProduct.images || [];

    const product = await Product.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });

    // Safely cleanup removed local images if they are no longer in new images list and unshared
    if (updates.images && Array.isArray(updates.images)) {
      const newImages = product.images || [];
      const removedImages = oldImages.filter((img) => !newImages.includes(img) && img.startsWith('/uploads/'));
      const models = { Product, Category, Banner, User };
      for (const img of removedImages) {
        deleteFile(img, { force: false, models }).catch(() => {});
      }
    }

    await AuditLog.create({
      action: 'PRODUCT_UPDATE',
      performedBy: req.user._id,
      performerRole: req.user.role,
      targetType: 'Product',
      targetId: product._id.toString(),
      details: { updatedFields: Object.keys(updates) },
      ipAddress: req.ip || '',
      requestId: req.id,
    });

    res.json({
      success: true,
      requestId: req.id,
      message: 'Product updated successfully.',
      data: product,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/v1/products/:id (Admin only)
 * Soft-deletes a product by unpublishing it.
 */
export async function deleteProduct(req, res, next) {
  try {
    const { id } = req.params;

    const product = await Product.findByIdAndUpdate(
      id,
      { isPublished: false },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        requestId: req.id,
        message: 'Product not found.',
      });
    }

    await AuditLog.create({
      action: 'PRODUCT_DELETE',
      performedBy: req.user._id,
      performerRole: req.user.role,
      targetType: 'Product',
      targetId: product._id.toString(),
      details: { name: product.name, unpublished: true },
      ipAddress: req.ip || '',
      requestId: req.id,
    });

    res.json({
      success: true,
      requestId: req.id,
      message: 'Product unpublished successfully.',
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/categories/:slugOrId
 * Returns single category detail by slug or ObjectId.
 */
export async function getCategoryBySlugOrId(req, res, next) {
  try {
    const { slugOrId } = req.params;
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(slugOrId);
    const query = isObjectId ? { _id: slugOrId } : { slug: slugOrId.toLowerCase() };

    const category = await Category.findOne(query).lean();
    if (!category) {
      return res.status(404).json({
        success: false,
        requestId: req.id,
        message: 'Category not found.',
      });
    }

    res.set('Cache-Control', 'public, max-age=60, s-maxage=120, stale-while-revalidate=300');

    res.json({
      success: true,
      requestId: req.id,
      data: category,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/categories (Admin only)
 */
export async function createCategory(req, res, next) {
  try {
    const catData = req.body;
    const existing = await Category.findOne({
      $or: [{ slug: catData.slug.toLowerCase() }, { name: catData.name }],
    });
    if (existing) {
      return res.status(409).json({
        success: false,
        requestId: req.id,
        message: 'Category with this name or slug already exists.',
      });
    }

    const category = await Category.create(catData);

    await AuditLog.create({
      action: 'CATEGORY_CREATE',
      performedBy: req.user._id,
      performerRole: req.user.role,
      targetType: 'Category',
      targetId: category._id.toString(),
      details: { name: category.name, slug: category.slug },
      ipAddress: req.ip || '',
      requestId: req.id,
    });

    // Real-Time Notification: Notify customers of newly published grocery category
    if (category.isActive !== false) {
      createNotification({
        recipientGroup: 'ALL_CUSTOMERS',
        type: 'CATEGORY_PUBLISHED',
        title: 'New Grocery Category',
        message: `Explore our new "${category.name}" grocery range today.`,
        severity: 'INFO',
        category: 'PRODUCT',
        targetType: 'Category',
        targetId: category._id,
        targetUrl: `/?category=${category.slug}`,
        metadata: {
          categoryName: category.name,
          slug: category.slug,
        },
        idempotencyKey: `cat_pub_${category._id}`,
        actorId: req.user._id,
      }).catch((notifErr) => console.error('[notification] Category published customer notify error:', notifErr.message));
    }

    res.status(201).json({
      success: true,
      requestId: req.id,
      message: 'Category created successfully.',
      data: category,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/v1/categories/:id (Admin only)
 */
export async function updateCategory(req, res, next) {
  try {
    const { id } = req.params;
    const updates = req.body;

    const existingCategory = await Category.findById(id);
    if (!existingCategory) {
      return res.status(404).json({
        success: false,
        requestId: req.id,
        message: 'Category not found.',
      });
    }

    const oldImage = existingCategory.image;

    const category = await Category.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });

    // Cleanup old category image if changed and unshared
    if (oldImage && updates.image && oldImage !== updates.image && oldImage.startsWith('/uploads/')) {
      const models = { Product, Category, Banner, User };
      deleteFile(oldImage, { force: false, models }).catch(() => {});
    }

    await AuditLog.create({
      action: 'CATEGORY_UPDATE',
      performedBy: req.user._id,
      performerRole: req.user.role,
      targetType: 'Category',
      targetId: category._id.toString(),
      details: { updatedFields: Object.keys(updates) },
      ipAddress: req.ip || '',
      requestId: req.id,
    });

    res.json({
      success: true,
      requestId: req.id,
      message: 'Category updated successfully.',
      data: category,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/v1/categories/:id (Admin only)
 * Safely deactivates category without cascade-deleting products or orders.
 */
export async function deleteCategory(req, res, next) {
  try {
    const { id } = req.params;
    const category = await Category.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );

    if (!category) {
      return res.status(404).json({
        success: false,
        requestId: req.id,
        message: 'Category not found.',
      });
    }

    await AuditLog.create({
      action: 'CATEGORY_DEACTIVATE',
      performedBy: req.user._id,
      performerRole: req.user.role,
      targetType: 'Category',
      targetId: category._id.toString(),
      details: { name: category.name, isActive: false },
      ipAddress: req.ip || '',
      requestId: req.id,
    });

    res.json({
      success: true,
      requestId: req.id,
      message: 'Category deactivated successfully.',
    });
  } catch (err) {
    next(err);
  }
}
