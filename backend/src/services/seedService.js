/**
 * Grocery Catalog Seeding Service.
 *
 * Populates MongoDB with the 8 canonical departments and authentic Indian
 * grocery products with variants when the database catalog is empty.
 *
 * @module services/seedService
 */

import { Category } from '../models/Category.js';
import { Product } from '../models/Product.js';
import { INITIAL_CATEGORIES, INITIAL_PRODUCTS } from '../data/grocerySeedData.js';

/**
 * Ensures the grocery catalog has categories and products.
 * If empty, automatically seeds from canonical dataset.
 *
 * @returns {Promise<{categoriesCount: number, productsCount: number, wasSeeded: boolean}>}
 */
export async function ensureGroceryCatalog() {
  const categoryCount = await Category.countDocuments();
  const productCount = await Product.countDocuments();

  if (categoryCount > 0 && productCount > 0) {
    return {
      categoriesCount: categoryCount,
      productsCount: productCount,
      wasSeeded: false,
    };
  }

  console.info('[catalog:seed] Initializing grocery departments and products in MongoDB Atlas...');

  // 1. Seed Categories if empty
  const categoryMap = new Map();

  for (const catData of INITIAL_CATEGORIES) {
    let cat = await Category.findOne({ slug: catData.slug });
    if (!cat) {
      cat = await Category.create(catData);
    }
    categoryMap.set(cat.slug, cat._id);
  }

  // 2. Seed Products if empty
  if (productCount === 0) {
    for (const prodData of INITIAL_PRODUCTS) {
      const categoryId = categoryMap.get(prodData.categorySlug);
      if (!categoryId) {
        console.warn(`[catalog:seed] Category ${prodData.categorySlug} not found for product ${prodData.name}`);
        continue;
      }

      const existing = await Product.findOne({ slug: prodData.slug });
      if (!existing) {
        const productToCreate = {
          ...prodData,
          category: categoryId,
        };
        delete productToCreate.categorySlug;
        await Product.create(productToCreate);
      }
    }
  }

  const finalCatCount = await Category.countDocuments();
  const finalProdCount = await Product.countDocuments();

  console.info(`[catalog:seed] ✅ Catalog ready: ${finalCatCount} categories, ${finalProdCount} products with variants.`);

  return {
    categoriesCount: finalCatCount,
    productsCount: finalProdCount,
    wasSeeded: true,
  };
}
