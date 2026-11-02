/**
 * Canonical Grocery Seed Data.
 *
 * Populates real Indian grocery departments and products with purchasable variants.
 * All customer-facing names and descriptions are in clear, professional English.
 * Prices are in integer paise (100 paise = ₹1.00).
 *
 * @module data/grocerySeedData
 */

export const INITIAL_CATEGORIES = [
  {
    name: 'Wheat Flour & Grains',
    slug: 'atta-flour',
    description: 'Freshly ground whole wheat flour, multigrain, maize, and specialty flours.',
    image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80',
    order: 1,
  },
  {
    name: 'Gram Flour',
    slug: 'besan',
    description: 'Pure 100% roasted Bengal gram flour for traditional batter, savories, and sweets.',
    image: 'https://images.unsplash.com/photo-1627485937980-221c88ac04f9?auto=format&fit=crop&w=600&q=80',
    order: 2,
  },
  {
    name: 'Spices & Seasonings',
    slug: 'masale-spices',
    description: 'Aromatic, freshly ground whole and powdered pure spices.',
    image: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=600&q=80',
    order: 3,
  },
  {
    name: 'Pulses & Lentils',
    slug: 'daal-pulses',
    description: 'Unpolished, protein-rich lentils: Yellow Pigeon Peas, Moong, Bengal Gram, and Red Lentils.',
    image: 'https://images.unsplash.com/photo-1585994192701-f1a505c817ea?auto=format&fit=crop&w=600&q=80',
    order: 4,
  },
  {
    name: 'Rice & Grains',
    slug: 'chawal-rice',
    description: 'Aged aromatic Basmati rice, everyday medium-grain rice, and traditional flattened rice.',
    image: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=600&q=80',
    order: 5,
  },
  {
    name: 'Cooking Oils & Pure Ghee',
    slug: 'oil-ghee',
    description: 'Granular pure cow ghee, cold-pressed virgin mustard oil, and refined sunflower oil.',
    image: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=600&q=80',
    order: 6,
  },
  {
    name: 'Sugar, Jaggery & Salt',
    slug: 'sugar-salt',
    description: 'Sulphur-free clean cane sugar, natural organic jaggery cubes, and iodized table salt.',
    image: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=600&q=80',
    order: 7,
  },
  {
    name: 'Daily Grocery Essentials',
    slug: 'daily-essentials',
    description: 'Flattened rice, roasted semolina, aromatic black tea, and everyday household essentials.',
    image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80',
    order: 8,
  },
];

export const INITIAL_PRODUCTS = [
  // ── Wheat Flour & Grains ────────────────────────────────────────────────────
  {
    name: 'Khushboo Sharbati Whole Wheat Flour',
    slug: 'khushboo-mp-sharbati-gehu-atta',
    description: '100% pure Madhya Pradesh Sharbati whole wheat grains, stone-ground with zero refined flour and rich in dietary fiber. Makes soft, fluffy flatbreads that stay tender for hours.',
    categorySlug: 'atta-flour',
    brand: 'Khushboo Pure',
    images: [
      'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=80',
    ],
    tags: ['wheat flour', 'flour', 'whole wheat', 'flatbread', 'grains'],
    isVeg: true,
    variants: [
      {
        sku: 'ATTA-SHAR-1KG',
        label: '1 kg',
        unit: 'kg',
        quantity: 1,
        pricePaise: 5500, // ₹55
        mrpPaise: 6500,   // ₹65
        stock: 50,
        weightGrams: 1000,
      },
      {
        sku: 'ATTA-SHAR-5KG',
        label: '5 kg',
        unit: 'kg',
        quantity: 5,
        pricePaise: 26000, // ₹260
        mrpPaise: 31000,   // ₹310
        stock: 40,
        weightGrams: 5000,
      },
      {
        sku: 'ATTA-SHAR-10KG',
        label: '10 kg',
        unit: 'kg',
        quantity: 10,
        pricePaise: 49900, // ₹499
        mrpPaise: 59000,   // ₹590
        stock: 30,
        weightGrams: 10000,
      },
    ],
  },
  {
    name: 'Khushboo Multigrain High-Fiber Flour',
    slug: 'khushboo-multigrain-health-atta',
    description: 'Wholesome blend of wheat, soya, roasted gram, oats, maize, finger millet, and psyllium husk. High protein and low glycemic index for healthy living.',
    categorySlug: 'atta-flour',
    brand: 'Khushboo Pure',
    images: [
      'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=800&q=80',
    ],
    tags: ['multigrain', 'flour', 'high fiber', 'protein', 'healthy'],
    isVeg: true,
    variants: [
      {
        sku: 'ATTA-MULTI-1KG',
        label: '1 kg',
        unit: 'kg',
        quantity: 1,
        pricePaise: 7500, // ₹75
        mrpPaise: 9000,   // ₹90
        stock: 35,
        weightGrams: 1000,
      },
      {
        sku: 'ATTA-MULTI-5KG',
        label: '5 kg',
        unit: 'kg',
        quantity: 5,
        pricePaise: 36000, // ₹360
        mrpPaise: 42500,   // ₹425
        stock: 25,
        weightGrams: 5000,
      },
    ],
  },

  // ── Gram Flour ───────────────────────────────────────────────────────────────
  {
    name: 'Khushboo Pure Bengal Gram Flour',
    slug: 'khushboo-pure-chana-daal-besan',
    description: 'Milled exclusively from premium dry-roasted unpolished Bengal gram. Perfectly textured, naturally golden yellow, and free from artificial coloring.',
    categorySlug: 'besan',
    brand: 'Khushboo Pure',
    images: [
      'https://images.unsplash.com/photo-1627485937980-221c88ac04f9?auto=format&fit=crop&w=800&q=80',
    ],
    tags: ['gram flour', 'besan', 'bengal gram', 'savory', 'flour'],
    isVeg: true,
    variants: [
      {
        sku: 'BESAN-CHANA-500G',
        label: '500 g',
        unit: 'g',
        quantity: 500,
        pricePaise: 5500, // ₹55
        mrpPaise: 6500,   // ₹65
        stock: 60,
        weightGrams: 500,
      },
      {
        sku: 'BESAN-CHANA-1KG',
        label: '1 kg',
        unit: 'kg',
        quantity: 1,
        pricePaise: 10500, // ₹105
        mrpPaise: 12500,   // ₹125
        stock: 45,
        weightGrams: 1000,
      },
      {
        sku: 'BESAN-CHANA-5KG',
        label: '5 kg',
        unit: 'kg',
        quantity: 5,
        pricePaise: 49900, // ₹499
        mrpPaise: 58000,   // ₹580
        stock: 20,
        weightGrams: 5000,
      },
    ],
  },

  // ── Spices & Seasonings ─────────────────────────────────────────────────────
  {
    name: 'Khushboo Pure Golden Turmeric Powder',
    slug: 'malwi-shudh-haldi-turmeric-powder',
    description: 'High-curcumin turmeric powder ground from select finger roots. Vibrant golden color, natural aroma, and 100% pure.',
    categorySlug: 'masale-spices',
    brand: 'Khushboo Pure',
    images: [
      'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=800&q=80',
    ],
    tags: ['turmeric', 'powder', 'spices', 'golden', 'seasoning'],
    isVeg: true,
    variants: [
      {
        sku: 'MAS-HALDI-100G',
        label: '100 g',
        unit: 'g',
        quantity: 100,
        pricePaise: 3500, // ₹35
        mrpPaise: 4200,   // ₹42
        stock: 80,
        weightGrams: 100,
      },
      {
        sku: 'MAS-HALDI-200G',
        label: '200 g',
        unit: 'g',
        quantity: 200,
        pricePaise: 6500, // ₹65
        mrpPaise: 8000,   // ₹80
        stock: 50,
        weightGrams: 200,
      },
      {
        sku: 'MAS-HALDI-500G',
        label: '500 g',
        unit: 'g',
        quantity: 500,
        pricePaise: 15000, // ₹150
        mrpPaise: 18500,   // ₹185
        stock: 30,
        weightGrams: 500,
      },
    ],
  },
  {
    name: 'Khushboo Stemless Red Chilli Powder',
    slug: 'teekhi-laal-mirch-powder',
    description: 'Traditional blend of Guntur and Byadgi red chillies. Delivers rich natural color with an authentic spicy kick. No artificial coloring added.',
    categorySlug: 'masale-spices',
    brand: 'Khushboo Pure',
    images: [
      'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=800&q=80',
    ],
    tags: ['chilli', 'red chilli', 'spicy', 'powder', 'spices'],
    isVeg: true,
    variants: [
      {
        sku: 'MAS-MIRCH-100G',
        label: '100 g',
        unit: 'g',
        quantity: 100,
        pricePaise: 4500, // ₹45
        mrpPaise: 5500,   // ₹55
        stock: 70,
        weightGrams: 100,
      },
      {
        sku: 'MAS-MIRCH-200G',
        label: '200 g',
        unit: 'g',
        quantity: 200,
        pricePaise: 8500, // ₹85
        mrpPaise: 10500,  // ₹105
        stock: 45,
        weightGrams: 200,
      },
      {
        sku: 'MAS-MIRCH-500G',
        label: '500 g',
        unit: 'g',
        quantity: 500,
        pricePaise: 19900, // ₹199
        mrpPaise: 24500,   // ₹245
        stock: 25,
        weightGrams: 500,
      },
    ],
  },
  {
    name: 'Khushboo Royal Aromatic Garam Masala',
    slug: 'royal-shahi-garam-masala-powder',
    description: 'Crafted blend of 16 whole roasted spices including green cardamom, cinnamon, cloves, mace, and star anise. Fragrant finishing seasoning for curries and main courses.',
    categorySlug: 'masale-spices',
    brand: 'Khushboo Pure',
    images: [
      'https://images.unsplash.com/photo-1509358271058-acd22cc93898?auto=format&fit=crop&w=800&q=80',
    ],
    tags: ['garam masala', 'spices', 'aromatic', 'seasoning'],
    isVeg: true,
    variants: [
      {
        sku: 'MAS-GARAM-100G',
        label: '100 g',
        unit: 'g',
        quantity: 100,
        pricePaise: 8500, // ₹85
        mrpPaise: 11000,  // ₹110
        stock: 50,
        weightGrams: 100,
      },
      {
        sku: 'MAS-GARAM-200G',
        label: '200 g',
        unit: 'g',
        quantity: 200,
        pricePaise: 16000, // ₹160
        mrpPaise: 21000,   // ₹210
        stock: 30,
        weightGrams: 200,
      },
    ],
  },

  // ── Pulses & Lentils ────────────────────────────────────────────────────────
  {
    name: 'Khushboo Unpolished Yellow Pigeon Pea Lentils',
    slug: 'unpolished-toor-arhar-daal',
    description: 'Naturally dried unpolished yellow pigeon peas. High in plant-based protein, cooks evenly and retains natural nutrients.',
    categorySlug: 'daal-pulses',
    brand: 'Khushboo Pure',
    images: [
      'https://images.unsplash.com/photo-1585994192701-f1a505c817ea?auto=format&fit=crop&w=800&q=80',
    ],
    tags: ['pigeon peas', 'lentils', 'pulses', 'yellow lentils', 'protein'],
    isVeg: true,
    variants: [
      {
        sku: 'DAAL-TOOR-500G',
        label: '500 g',
        unit: 'g',
        quantity: 500,
        pricePaise: 8500, // ₹85
        mrpPaise: 9800,   // ₹98
        stock: 65,
        weightGrams: 500,
      },
      {
        sku: 'DAAL-TOOR-1KG',
        label: '1 kg',
        unit: 'kg',
        quantity: 1,
        pricePaise: 16500, // ₹165
        mrpPaise: 19000,   // ₹190
        stock: 40,
        weightGrams: 1000,
      },
    ],
  },
  {
    name: 'Khushboo Skinless Yellow Split Moong Lentils',
    slug: 'moong-daal-dhuli-yellow',
    description: 'Skinless yellow split moong lentils. Light, wholesome, and easy to digest, perfect for comforting lentil soup and porridge.',
    categorySlug: 'daal-pulses',
    brand: 'Khushboo Pure',
    images: [
      'https://images.unsplash.com/photo-1515543237350-b3eea1ec8082?auto=format&fit=crop&w=800&q=80',
    ],
    tags: ['moong lentils', 'yellow lentils', 'pulses', 'healthy'],
    isVeg: true,
    variants: [
      {
        sku: 'DAAL-MOONG-500G',
        label: '500 g',
        unit: 'g',
        quantity: 500,
        pricePaise: 7000, // ₹70
        mrpPaise: 8200,   // ₹82
        stock: 55,
        weightGrams: 500,
      },
      {
        sku: 'DAAL-MOONG-1KG',
        label: '1 kg',
        unit: 'kg',
        quantity: 1,
        pricePaise: 13500, // ₹135
        mrpPaise: 16000,   // ₹160
        stock: 35,
        weightGrams: 1000,
      },
    ],
  },

  // ── Rice & Grains ───────────────────────────────────────────────────────────
  {
    name: 'Khushboo Aged Long-Grain Basmati Rice',
    slug: 'khushboo-royal-basmati-rozana-rice',
    description: 'Aged long-grain Basmati rice for everyday dining. Fluffy, fragrant, non-sticky grains that elongate gracefully upon cooking.',
    categorySlug: 'chawal-rice',
    brand: 'Khushboo Pure',
    images: [
      'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80',
    ],
    tags: ['rice', 'basmati', 'long grain', 'grains'],
    isVeg: true,
    variants: [
      {
        sku: 'RICE-BAS-1KG',
        label: '1 kg',
        unit: 'kg',
        quantity: 1,
        pricePaise: 9500, // ₹95
        mrpPaise: 11500,  // ₹115
        stock: 60,
        weightGrams: 1000,
      },
      {
        sku: 'RICE-BAS-5KG',
        label: '5 kg',
        unit: 'kg',
        quantity: 5,
        pricePaise: 45000, // ₹450
        mrpPaise: 54000,   // ₹540
        stock: 30,
        weightGrams: 5000,
      },
    ],
  },
  {
    name: 'Khushboo Traditional Indori Flattened Rice (Poha)',
    slug: 'authentic-indori-thick-poha',
    description: 'Traditional thick flattened rice flakes that retain structure when soaked. Ideal for breakfast delicacies garnished with fresh herbs and citrus.',
    categorySlug: 'chawal-rice',
    brand: 'Khushboo Pure',
    images: [
      'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=800&q=80',
    ],
    tags: ['flattened rice', 'breakfast', 'traditional', 'flakes'],
    isVeg: true,
    variants: [
      {
        sku: 'POHA-IND-500G',
        label: '500 g',
        unit: 'g',
        quantity: 500,
        pricePaise: 3500, // ₹35
        mrpPaise: 4200,   // ₹42
        stock: 90,
        weightGrams: 500,
      },
      {
        sku: 'POHA-IND-1KG',
        label: '1 kg',
        unit: 'kg',
        quantity: 1,
        pricePaise: 6500, // ₹65
        mrpPaise: 8000,   // ₹80
        stock: 75,
        weightGrams: 1000,
      },
    ],
  },

  // ── Cooking Oils & Pure Ghee ────────────────────────────────────────────────
  {
    name: 'Khushboo Pure Clarified Butter (Cow Ghee)',
    slug: 'khushboo-shudh-desi-danedar-cow-ghee',
    description: 'Traditional golden cow ghee with rich granular texture and sweet, wholesome aroma. Naturally enriched with essential vitamins A and D.',
    categorySlug: 'oil-ghee',
    brand: 'Khushboo Pure',
    images: [
      'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=800&q=80',
    ],
    tags: ['ghee', 'cow ghee', 'clarified butter', 'pure'],
    isVeg: true,
    variants: [
      {
        sku: 'GHEE-COW-500ML',
        label: '500 ml',
        unit: 'ml',
        quantity: 500,
        pricePaise: 34000, // ₹340
        mrpPaise: 39900,   // ₹399
        stock: 45,
        weightGrams: 475,
      },
      {
        sku: 'GHEE-COW-1L',
        label: '1 Litre',
        unit: 'L',
        quantity: 1,
        pricePaise: 66000, // ₹660
        mrpPaise: 77500,   // ₹775
        stock: 35,
        weightGrams: 950,
      },
      {
        sku: 'GHEE-COW-5L',
        label: '5 Litres',
        unit: 'L',
        quantity: 5,
        pricePaise: 320000, // ₹3,200
        mrpPaise: 375000,   // ₹3,750
        stock: 15,
        weightGrams: 4750,
      },
    ],
  },
  {
    name: 'Khushboo Cold-Pressed Virgin Mustard Oil',
    slug: 'kacchi-ghani-pure-mustard-oil',
    description: 'Cold-pressed 100% pure mustard oil with robust flavor and high smoke point. Ideal for authentic curries, sauteing, and preserving pickles.',
    categorySlug: 'oil-ghee',
    brand: 'Khushboo Pure',
    images: [
      'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=800&q=80',
    ],
    tags: ['mustard oil', 'cold pressed', 'cooking oil', 'pure'],
    isVeg: true,
    variants: [
      {
        sku: 'OIL-MUST-1L',
        label: '1 Litre',
        unit: 'L',
        quantity: 1,
        pricePaise: 15500, // ₹155
        mrpPaise: 18500,   // ₹185
        stock: 50,
        weightGrams: 920,
      },
      {
        sku: 'OIL-MUST-5L',
        label: '5 Litres',
        unit: 'L',
        quantity: 5,
        pricePaise: 75000, // ₹750
        mrpPaise: 89000,   // ₹890
        stock: 25,
        weightGrams: 4600,
      },
    ],
  },

  // ── Sugar, Jaggery & Salt ───────────────────────────────────────────────────
  {
    name: 'Khushboo Sulphur-Free Crystal Cane Sugar',
    slug: 'sulphur-free-crystal-refined-sugar',
    description: 'Sparkling clean, sparkling white cane sugar crystals produced without sulphur bleaching. Dissolves cleanly in beverages and confectionery.',
    categorySlug: 'sugar-salt',
    brand: 'Khushboo Pure',
    images: [
      'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=800&q=80',
    ],
    tags: ['sugar', 'cane sugar', 'sweet', 'sulphur free'],
    isVeg: true,
    variants: [
      {
        sku: 'SUG-CRYS-1KG',
        label: '1 kg',
        unit: 'kg',
        quantity: 1,
        pricePaise: 4800, // ₹48
        mrpPaise: 5500,   // ₹55
        stock: 80,
        weightGrams: 1000,
      },
      {
        sku: 'SUG-CRYS-5KG',
        label: '5 kg',
        unit: 'kg',
        quantity: 5,
        pricePaise: 23000, // ₹230
        mrpPaise: 27000,   // ₹270
        stock: 40,
        weightGrams: 5000,
      },
    ],
  },
  {
    name: 'Khushboo Natural Organic Cane Jaggery Cubes',
    slug: 'natural-desi-jaggery-gud-cubes',
    description: 'Chemical-free unrefined cane jaggery cut into convenient cubes. Naturally rich in iron, minerals, and wholesome sweetness.',
    categorySlug: 'sugar-salt',
    brand: 'Khushboo Pure',
    images: [
      'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=800&q=80',
    ],
    tags: ['jaggery', 'cane jaggery', 'organic', 'iron', 'healthy'],
    isVeg: true,
    variants: [
      {
        sku: 'GUD-CUBE-1KG',
        label: '1 kg',
        unit: 'kg',
        quantity: 1,
        pricePaise: 7500, // ₹75
        mrpPaise: 9500,   // ₹95
        stock: 50,
        weightGrams: 1000,
      },
    ],
  },
  {
    name: 'Tata Vacuum Evaporated Iodized Table Salt',
    slug: 'tata-salt-iodized',
    description: 'Nationally trusted table salt. Pure vacuum-evaporated iodized salt ensuring quality and health benefits for the whole family.',
    categorySlug: 'sugar-salt',
    brand: 'Tata',
    images: [
      'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=800&q=80',
    ],
    tags: ['salt', 'iodized salt', 'table salt'],
    isVeg: true,
    variants: [
      {
        sku: 'SALT-TATA-1KG',
        label: '1 kg',
        unit: 'kg',
        quantity: 1,
        pricePaise: 2800, // ₹28
        mrpPaise: 2800,   // ₹28
        stock: 120,
        weightGrams: 1000,
      },
    ],
  },

  // ── Daily Grocery Essentials ────────────────────────────────────────────────
  {
    name: 'Khushboo Special Assam CTC Black Tea',
    slug: 'khushboo-special-ctc-leaf-tea',
    description: 'Strong, rich blend of Assam CTC and fragrant long tea leaves. Brews a vibrant golden-red cup with an invigorating, brisk flavor.',
    categorySlug: 'daily-essentials',
    brand: 'Khushboo Pure',
    images: [
      'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=800&q=80',
    ],
    tags: ['black tea', 'tea', 'assam tea', 'breakfast'],
    isVeg: true,
    variants: [
      {
        sku: 'TEA-CTC-250G',
        label: '250 g',
        unit: 'g',
        quantity: 250,
        pricePaise: 8500, // ₹85
        mrpPaise: 10500,  // ₹105
        stock: 75,
        weightGrams: 250,
      },
      {
        sku: 'TEA-CTC-500G',
        label: '500 g',
        unit: 'g',
        quantity: 500,
        pricePaise: 16500, // ₹165
        mrpPaise: 20000,   // ₹200
        stock: 45,
        weightGrams: 500,
      },
    ],
  },
  {
    name: 'Khushboo Roasted Wheat Semolina',
    slug: 'roasted-sooji-rava-semolina',
    description: 'Cleaned, pre-roasted durum wheat semolina. Perfect for quick savory morning porridge, crispy crepes, and sweet semolina pudding.',
    categorySlug: 'daily-essentials',
    brand: 'Khushboo Pure',
    images: [
      'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80',
    ],
    tags: ['semolina', 'wheat semolina', 'breakfast', 'durum wheat'],
    isVeg: true,
    variants: [
      {
        sku: 'SOOJI-ROAST-500G',
        label: '500 g',
        unit: 'g',
        quantity: 500,
        pricePaise: 3200, // ₹32
        mrpPaise: 3800,   // ₹38
        stock: 65,
        weightGrams: 500,
      },
      {
        sku: 'SOOJI-ROAST-1KG',
        label: '1 kg',
        unit: 'kg',
        quantity: 1,
        pricePaise: 6000, // ₹60
        mrpPaise: 7200,   // ₹72
        stock: 45,
        weightGrams: 1000,
      },
    ],
  },
];
