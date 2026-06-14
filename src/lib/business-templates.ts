// ============================================
// Industry-Based Business Templates
// ============================================
// When a new organization is created, these templates define the default
// product types, attributes, and form field configurations that get seeded.

export type BusinessTypeKey =
  | 'shoe_store'
  | 'clothing_store'
  | 'mobile_phone_shop'
  | 'grocery_minimart'
  | 'cosmetics_shop'
  | 'hardware_store'
  | 'restaurant_cafe'
  | 'electronics_store'
  | 'pharmacy'
  | 'general_retail'

export interface AttributeTemplate {
  name: string
  fieldType: 'text' | 'number' | 'select' | 'image'
  options?: string[] // For select fields
  required?: boolean
}

export interface ProductTypeTemplate {
  name: string
  icon: string
  attributes: AttributeTemplate[]
}

export interface FormFieldConfig {
  field: string
  label: string
  required: boolean
  order: number
}

export interface BusinessTemplate {
  key: BusinessTypeKey
  label: string
  description: string
  icon: string
  productTypes: ProductTypeTemplate[]
  addProductFormFields: FormFieldConfig[]
}

// ============================================
// Complete Template Definitions
// ============================================

export const BUSINESS_TEMPLATES: Record<BusinessTypeKey, BusinessTemplate> = {
  shoe_store: {
    key: 'shoe_store',
    label: 'Shoe Store',
    description: 'Footwear retail — sneakers, formal shoes, boots, sandals and more',
    icon: '👟',
    productTypes: [
      {
        name: 'Sneakers',
        icon: '👟',
        attributes: [
          { name: 'Brand', fieldType: 'text', required: true },
          { name: 'Size', fieldType: 'select', options: ['36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46'], required: true },
          { name: 'Color', fieldType: 'select', options: ['Black', 'White', 'Red', 'Blue', 'Grey', 'Brown', 'Green', 'Beige'], required: true },
          { name: 'Gender', fieldType: 'select', options: ['Male', 'Female', 'Unisex', 'Kids'], required: true },
          { name: 'Material', fieldType: 'select', options: ['Leather', 'Canvas', 'Synthetic', 'Mesh', 'Suede', 'Rubber'], required: false },
        ],
      },
      {
        name: 'Running Shoes',
        icon: '🏃',
        attributes: [
          { name: 'Brand', fieldType: 'text', required: true },
          { name: 'Size', fieldType: 'select', options: ['36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46'], required: true },
          { name: 'Color', fieldType: 'select', options: ['Black', 'White', 'Red', 'Blue', 'Grey', 'Neon'], required: true },
          { name: 'Gender', fieldType: 'select', options: ['Male', 'Female', 'Unisex'], required: true },
          { name: 'Material', fieldType: 'select', options: ['Mesh', 'Synthetic', 'Knit', 'Foam'], required: false },
        ],
      },
      {
        name: 'Formal Shoes',
        icon: '👞',
        attributes: [
          { name: 'Brand', fieldType: 'text', required: true },
          { name: 'Size', fieldType: 'select', options: ['38', '39', '40', '41', '42', '43', '44', '45', '46'], required: true },
          { name: 'Color', fieldType: 'select', options: ['Black', 'Brown', 'Tan', 'Burgundy'], required: true },
          { name: 'Gender', fieldType: 'select', options: ['Male', 'Female'], required: true },
          { name: 'Material', fieldType: 'select', options: ['Leather', 'Faux Leather', 'Patent Leather'], required: true },
        ],
      },
      {
        name: 'Boots',
        icon: '🥾',
        attributes: [
          { name: 'Brand', fieldType: 'text', required: true },
          { name: 'Size', fieldType: 'select', options: ['38', '39', '40', '41', '42', '43', '44', '45', '46'], required: true },
          { name: 'Color', fieldType: 'select', options: ['Black', 'Brown', 'Tan', 'Grey'], required: true },
          { name: 'Gender', fieldType: 'select', options: ['Male', 'Female', 'Unisex'], required: true },
          { name: 'Material', fieldType: 'select', options: ['Leather', 'Suede', 'Synthetic', 'Rubber'], required: false },
        ],
      },
      {
        name: 'Sandals',
        icon: '🩴',
        attributes: [
          { name: 'Brand', fieldType: 'text', required: false },
          { name: 'Size', fieldType: 'select', options: ['36', '37', '38', '39', '40', '41', '42', '43', '44'], required: true },
          { name: 'Color', fieldType: 'select', options: ['Black', 'Brown', 'Beige', 'White'], required: true },
          { name: 'Gender', fieldType: 'select', options: ['Male', 'Female', 'Unisex', 'Kids'], required: true },
          { name: 'Material', fieldType: 'select', options: ['Leather', 'Rubber', 'Synthetic', 'EVA'], required: false },
        ],
      },
      {
        name: 'Slippers',
        icon: '🩴',
        attributes: [
          { name: 'Brand', fieldType: 'text', required: false },
          { name: 'Size', fieldType: 'select', options: ['36', '37', '38', '39', '40', '41', '42', '43', '44'], required: true },
          { name: 'Color', fieldType: 'select', options: ['Black', 'Blue', 'Pink', 'Grey', 'Brown'], required: false },
          { name: 'Gender', fieldType: 'select', options: ['Male', 'Female', 'Unisex', 'Kids'], required: true },
        ],
      },
      {
        name: 'Sports Shoes',
        icon: '⚽',
        attributes: [
          { name: 'Brand', fieldType: 'text', required: true },
          { name: 'Size', fieldType: 'select', options: ['36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46'], required: true },
          { name: 'Color', fieldType: 'select', options: ['Black', 'White', 'Blue', 'Red', 'Multi-color'], required: true },
          { name: 'Gender', fieldType: 'select', options: ['Male', 'Female', 'Unisex'], required: true },
          { name: 'Sport', fieldType: 'select', options: ['Football', 'Basketball', 'Tennis', 'Training', 'Gym'], required: true },
        ],
      },
      {
        name: 'Kids Shoes',
        icon: '👧',
        attributes: [
          { name: 'Brand', fieldType: 'text', required: false },
          { name: 'Size', fieldType: 'select', options: ['24', '25', '26', '27', '28', '29', '30', '31', '32', '33', '34', '35', '36'], required: true },
          { name: 'Color', fieldType: 'select', options: ['Pink', 'Blue', 'Red', 'White', 'Black', 'Multi-color'], required: true },
          { name: 'Gender', fieldType: 'select', options: ['Boys', 'Girls', 'Unisex'], required: true },
          { name: 'Age Group', fieldType: 'select', options: ['Toddler (1-3)', 'Little Kids (4-7)', 'Big Kids (8-12)'], required: true },
        ],
      },
    ],
    addProductFormFields: [
      { field: 'name', label: 'Product Name', required: true, order: 1 },
      { field: 'Brand', label: 'Brand', required: true, order: 2 },
      { field: 'costPrice', label: 'Cost Price', required: true, order: 3 },
      { field: 'sellingPrice', label: 'Selling Price', required: true, order: 4 },
      { field: 'Size', label: 'Size', required: true, order: 5 },
      { field: 'Color', label: 'Color', required: true, order: 6 },
      { field: 'quantity', label: 'Quantity', required: true, order: 7 },
    ],
  },

  clothing_store: {
    key: 'clothing_store',
    label: 'Clothing Store',
    description: 'Apparel retail — shirts, pants, dresses, suits and more',
    icon: '👕',
    productTypes: [
      {
        name: 'Shirts',
        icon: '👔',
        attributes: [
          { name: 'Brand', fieldType: 'text', required: true },
          { name: 'Size', fieldType: 'select', options: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'], required: true },
          { name: 'Color', fieldType: 'select', options: ['White', 'Black', 'Blue', 'Grey', 'Red', 'Green', 'Pink', 'Beige'], required: true },
          { name: 'Gender', fieldType: 'select', options: ['Male', 'Female', 'Unisex'], required: true },
          { name: 'Material', fieldType: 'select', options: ['Cotton', 'Polyester', 'Linen', 'Silk', 'Wool', 'Blend'], required: false },
        ],
      },
      {
        name: 'T-Shirts',
        icon: '👕',
        attributes: [
          { name: 'Brand', fieldType: 'text', required: false },
          { name: 'Size', fieldType: 'select', options: ['XS', 'S', 'M', 'L', 'XL', 'XXL'], required: true },
          { name: 'Color', fieldType: 'select', options: ['White', 'Black', 'Blue', 'Red', 'Grey', 'Green', 'Yellow'], required: true },
          { name: 'Gender', fieldType: 'select', options: ['Male', 'Female', 'Unisex'], required: true },
          { name: 'Material', fieldType: 'select', options: ['Cotton', 'Polyester', 'Tri-blend', 'Organic Cotton'], required: false },
        ],
      },
      {
        name: 'Pants',
        icon: '👖',
        attributes: [
          { name: 'Brand', fieldType: 'text', required: true },
          { name: 'Size', fieldType: 'select', options: ['28', '30', '32', '34', '36', '38', '40', '42'], required: true },
          { name: 'Color', fieldType: 'select', options: ['Black', 'Navy', 'Grey', 'Khaki', 'Brown'], required: true },
          { name: 'Gender', fieldType: 'select', options: ['Male', 'Female', 'Unisex'], required: true },
          { name: 'Material', fieldType: 'select', options: ['Cotton', 'Denim', 'Polyester', 'Chino', 'Wool'], required: false },
        ],
      },
      {
        name: 'Jeans',
        icon: '👖',
        attributes: [
          { name: 'Brand', fieldType: 'text', required: true },
          { name: 'Size', fieldType: 'select', options: ['28', '30', '32', '34', '36', '38', '40', '42'], required: true },
          { name: 'Color', fieldType: 'select', options: ['Blue', 'Black', 'Dark Blue', 'Light Blue', 'Grey'], required: true },
          { name: 'Gender', fieldType: 'select', options: ['Male', 'Female'], required: true },
          { name: 'Fit', fieldType: 'select', options: ['Slim', 'Regular', 'Relaxed', 'Skinny', 'Bootcut'], required: true },
        ],
      },
      {
        name: 'Jackets',
        icon: '🧥',
        attributes: [
          { name: 'Brand', fieldType: 'text', required: true },
          { name: 'Size', fieldType: 'select', options: ['S', 'M', 'L', 'XL', 'XXL'], required: true },
          { name: 'Color', fieldType: 'select', options: ['Black', 'Brown', 'Navy', 'Grey', 'Green'], required: true },
          { name: 'Gender', fieldType: 'select', options: ['Male', 'Female', 'Unisex'], required: true },
          { name: 'Material', fieldType: 'select', options: ['Leather', 'Denim', 'Polyester', 'Wool', 'Nylon'], required: true },
        ],
      },
      {
        name: 'Dresses',
        icon: '👗',
        attributes: [
          { name: 'Brand', fieldType: 'text', required: false },
          { name: 'Size', fieldType: 'select', options: ['XS', 'S', 'M', 'L', 'XL', 'XXL'], required: true },
          { name: 'Color', fieldType: 'select', options: ['Black', 'Red', 'Blue', 'White', 'Pink', 'Green', 'Floral'], required: true },
          { name: 'Material', fieldType: 'select', options: ['Cotton', 'Silk', 'Chiffon', 'Polyester', 'Lace'], required: false },
          { name: 'Length', fieldType: 'select', options: ['Mini', 'Midi', 'Maxi'], required: false },
        ],
      },
      {
        name: 'Suits',
        icon: '🤵',
        attributes: [
          { name: 'Brand', fieldType: 'text', required: true },
          { name: 'Size', fieldType: 'select', options: ['44', '46', '48', '50', '52', '54', '56'], required: true },
          { name: 'Color', fieldType: 'select', options: ['Black', 'Navy', 'Grey', 'Charcoal'], required: true },
          { name: 'Material', fieldType: 'select', options: ['Wool', 'Polyester', 'Wool Blend', 'Linen'], required: true },
        ],
      },
      {
        name: 'Kids Wear',
        icon: '👶',
        attributes: [
          { name: 'Brand', fieldType: 'text', required: false },
          { name: 'Size', fieldType: 'select', options: ['2-3Y', '4-5Y', '6-7Y', '8-9Y', '10-11Y', '12-13Y'], required: true },
          { name: 'Color', fieldType: 'select', options: ['Pink', 'Blue', 'Red', 'Yellow', 'Green', 'White'], required: true },
          { name: 'Gender', fieldType: 'select', options: ['Boys', 'Girls', 'Unisex'], required: true },
          { name: 'Age Group', fieldType: 'select', options: ['Toddler (1-3)', 'Little Kids (4-7)', 'Big Kids (8-12)'], required: true },
        ],
      },
    ],
    addProductFormFields: [
      { field: 'name', label: 'Product Name', required: true, order: 1 },
      { field: 'Brand', label: 'Brand', required: true, order: 2 },
      { field: 'costPrice', label: 'Cost Price', required: true, order: 3 },
      { field: 'sellingPrice', label: 'Selling Price', required: true, order: 4 },
      { field: 'Size', label: 'Size', required: true, order: 5 },
      { field: 'Color', label: 'Color', required: true, order: 6 },
      { field: 'quantity', label: 'Quantity', required: true, order: 7 },
    ],
  },

  mobile_phone_shop: {
    key: 'mobile_phone_shop',
    label: 'Mobile Phone Shop',
    description: 'Smartphones, tablets, accessories and mobile tech',
    icon: '📱',
    productTypes: [
      {
        name: 'Smartphones',
        icon: '📱',
        attributes: [
          { name: 'Brand', fieldType: 'text', required: true },
          { name: 'Model', fieldType: 'text', required: true },
          { name: 'Storage', fieldType: 'select', options: ['32GB', '64GB', '128GB', '256GB', '512GB', '1TB'], required: true },
          { name: 'RAM', fieldType: 'select', options: ['2GB', '3GB', '4GB', '6GB', '8GB', '12GB', '16GB'], required: true },
          { name: 'Color', fieldType: 'select', options: ['Black', 'White', 'Blue', 'Red', 'Green', 'Gold', 'Silver'], required: true },
          { name: 'IMEI', fieldType: 'text', required: true },
        ],
      },
      {
        name: 'Tablets',
        icon: '📱',
        attributes: [
          { name: 'Brand', fieldType: 'text', required: true },
          { name: 'Model', fieldType: 'text', required: true },
          { name: 'Storage', fieldType: 'select', options: ['32GB', '64GB', '128GB', '256GB', '512GB', '1TB'], required: true },
          { name: 'RAM', fieldType: 'select', options: ['3GB', '4GB', '6GB', '8GB', '12GB', '16GB'], required: false },
          { name: 'Color', fieldType: 'select', options: ['Black', 'White', 'Silver', 'Gold'], required: true },
          { name: 'Screen Size', fieldType: 'select', options: ['8"', '10"', '11"', '12.9"'], required: false },
        ],
      },
      {
        name: 'Accessories',
        icon: '🎧',
        attributes: [
          { name: 'Brand', fieldType: 'text', required: false },
          { name: 'Type', fieldType: 'select', options: ['Case', 'Screen Protector', 'Cable', 'Holder', 'Stylus', 'Other'], required: true },
          { name: 'Compatible With', fieldType: 'text', required: false },
          { name: 'Color', fieldType: 'select', options: ['Black', 'White', 'Blue', 'Red', 'Clear', 'Multi-color'], required: false },
        ],
      },
      {
        name: 'Chargers',
        icon: '🔌',
        attributes: [
          { name: 'Brand', fieldType: 'text', required: false },
          { name: 'Type', fieldType: 'select', options: ['USB-C', 'Lightning', 'Micro USB', 'Wireless'], required: true },
          { name: 'Wattage', fieldType: 'select', options: ['5W', '10W', '15W', '18W', '20W', '30W', '45W', '65W'], required: true },
        ],
      },
      {
        name: 'Earbuds',
        icon: '🎧',
        attributes: [
          { name: 'Brand', fieldType: 'text', required: true },
          { name: 'Type', fieldType: 'select', options: ['Wireless', 'Wired', 'TWS'], required: true },
          { name: 'Color', fieldType: 'select', options: ['Black', 'White', 'Blue', 'Red'], required: true },
        ],
      },
      {
        name: 'Power Banks',
        icon: '🔋',
        attributes: [
          { name: 'Brand', fieldType: 'text', required: true },
          { name: 'Capacity', fieldType: 'select', options: ['5000mAh', '10000mAh', '20000mAh', '30000mAh'], required: true },
          { name: 'Ports', fieldType: 'select', options: ['1 USB', '2 USB', 'USB-C + USB', '3+ Ports'], required: false },
        ],
      },
    ],
    addProductFormFields: [
      { field: 'name', label: 'Product Name', required: true, order: 1 },
      { field: 'Brand', label: 'Brand', required: true, order: 2 },
      { field: 'Model', label: 'Model', required: false, order: 3 },
      { field: 'costPrice', label: 'Cost Price', required: true, order: 4 },
      { field: 'sellingPrice', label: 'Selling Price', required: true, order: 5 },
      { field: 'IMEI', label: 'IMEI', required: false, order: 6 },
      { field: 'quantity', label: 'Quantity', required: true, order: 7 },
    ],
  },

  grocery_minimart: {
    key: 'grocery_minimart',
    label: 'Grocery / Mini Market',
    description: 'Food, beverages, household essentials and daily supplies',
    icon: '🛒',
    productTypes: [
      {
        name: 'Beverages',
        icon: '🥤',
        attributes: [
          { name: 'Brand', fieldType: 'text', required: true },
          { name: 'Volume', fieldType: 'select', options: ['250ml', '330ml', '500ml', '1L', '1.5L', '2L', '5L'], required: true },
          { name: 'Flavor', fieldType: 'select', options: ['Original', 'Orange', 'Mango', 'Apple', 'Cola', 'Lemon', 'Mixed'], required: false },
          { name: 'Expiry Date', fieldType: 'text', required: false },
        ],
      },
      {
        name: 'Snacks',
        icon: '🍿',
        attributes: [
          { name: 'Brand', fieldType: 'text', required: true },
          { name: 'Weight', fieldType: 'select', options: ['50g', '100g', '150g', '200g', '250g', '500g', '1kg'], required: true },
          { name: 'Flavor', fieldType: 'select', options: ['Original', 'Spicy', 'Salty', 'Sweet', 'BBQ', 'Cheese'], required: false },
          { name: 'Expiry Date', fieldType: 'text', required: false },
        ],
      },
      {
        name: 'Dairy Products',
        icon: '🥛',
        attributes: [
          { name: 'Brand', fieldType: 'text', required: true },
          { name: 'Type', fieldType: 'select', options: ['Milk', 'Yogurt', 'Cheese', 'Butter', 'Cream'], required: true },
          { name: 'Volume/Weight', fieldType: 'text', required: true },
          { name: 'Expiry Date', fieldType: 'text', required: true },
        ],
      },
      {
        name: 'Grains & Cereals',
        icon: '🌾',
        attributes: [
          { name: 'Brand', fieldType: 'text', required: false },
          { name: 'Type', fieldType: 'select', options: ['Teff', 'Wheat Flour', 'Rice', 'Barley', 'Corn', 'Oats'], required: true },
          { name: 'Weight', fieldType: 'select', options: ['500g', '1kg', '2kg', '5kg', '10kg', '25kg', '50kg'], required: true },
        ],
      },
      {
        name: 'Cooking Oil & Spices',
        icon: '🫒',
        attributes: [
          { name: 'Brand', fieldType: 'text', required: true },
          { name: 'Type', fieldType: 'select', options: ['Olive Oil', 'Sunflower Oil', 'Palm Oil', 'Berbere', 'Turmeric', 'Cumin', 'Salt'], required: true },
          { name: 'Volume/Weight', fieldType: 'text', required: true },
        ],
      },
      {
        name: 'Household Items',
        icon: '🏠',
        attributes: [
          { name: 'Brand', fieldType: 'text', required: false },
          { name: 'Category', fieldType: 'select', options: ['Cleaning', 'Laundry', 'Kitchen', 'Bathroom', 'Paper Products'], required: true },
          { name: 'Size', fieldType: 'text', required: false },
        ],
      },
      {
        name: 'Canned & Packaged Food',
        icon: '🥫',
        attributes: [
          { name: 'Brand', fieldType: 'text', required: true },
          { name: 'Type', fieldType: 'select', options: ['Canned Fish', 'Canned Meat', 'Pasta', 'Sauce', 'Honey', 'Jam'], required: true },
          { name: 'Weight', fieldType: 'select', options: ['100g', '200g', '400g', '500g', '1kg'], required: true },
          { name: 'Expiry Date', fieldType: 'text', required: false },
        ],
      },
      {
        name: 'Personal Care',
        icon: '🧴',
        attributes: [
          { name: 'Brand', fieldType: 'text', required: true },
          { name: 'Category', fieldType: 'select', options: ['Soap', 'Shampoo', 'Toothpaste', 'Lotion', 'Deodorant', 'Sanitizer'], required: true },
          { name: 'Size', fieldType: 'text', required: true },
        ],
      },
    ],
    addProductFormFields: [
      { field: 'name', label: 'Product Name', required: true, order: 1 },
      { field: 'Brand', label: 'Brand', required: true, order: 2 },
      { field: 'costPrice', label: 'Cost Price', required: true, order: 3 },
      { field: 'sellingPrice', label: 'Selling Price', required: true, order: 4 },
      { field: 'quantity', label: 'Quantity', required: true, order: 5 },
      { field: 'Expiry Date', label: 'Expiry Date', required: false, order: 6 },
    ],
  },

  cosmetics_shop: {
    key: 'cosmetics_shop',
    label: 'Cosmetics Shop',
    description: 'Beauty products, skincare, makeup and fragrances',
    icon: '💄',
    productTypes: [
      {
        name: 'Makeup',
        icon: '💄',
        attributes: [
          { name: 'Brand', fieldType: 'text', required: true },
          { name: 'Category', fieldType: 'select', options: ['Lipstick', 'Foundation', 'Mascara', 'Eyeliner', 'Blush', 'Concealer', 'Powder', 'Eyeshadow'], required: true },
          { name: 'Shade/Color', fieldType: 'text', required: true },
          { name: 'Size', fieldType: 'text', required: false },
        ],
      },
      {
        name: 'Skincare',
        icon: '🧖',
        attributes: [
          { name: 'Brand', fieldType: 'text', required: true },
          { name: 'Category', fieldType: 'select', options: ['Moisturizer', 'Cleanser', 'Toner', 'Serum', 'Sunscreen', 'Face Mask', 'Scrub'], required: true },
          { name: 'Skin Type', fieldType: 'select', options: ['All', 'Oily', 'Dry', 'Combination', 'Sensitive'], required: false },
          { name: 'Volume', fieldType: 'select', options: ['30ml', '50ml', '100ml', '150ml', '200ml', '250ml'], required: true },
        ],
      },
      {
        name: 'Hair Care',
        icon: '💇',
        attributes: [
          { name: 'Brand', fieldType: 'text', required: true },
          { name: 'Category', fieldType: 'select', options: ['Shampoo', 'Conditioner', 'Hair Oil', 'Styling Gel', 'Hair Mask', 'Treatment'], required: true },
          { name: 'Hair Type', fieldType: 'select', options: ['All', 'Curly', 'Straight', 'Oily', 'Dry', 'Colored'], required: false },
          { name: 'Volume', fieldType: 'select', options: ['100ml', '200ml', '250ml', '300ml', '500ml', '1L'], required: true },
        ],
      },
      {
        name: 'Fragrances',
        icon: '🌸',
        attributes: [
          { name: 'Brand', fieldType: 'text', required: true },
          { name: 'Type', fieldType: 'select', options: ['Perfume', 'Eau de Toilette', 'Body Spray', 'Attar'], required: true },
          { name: 'Scent', fieldType: 'select', options: ['Floral', 'Woody', 'Fresh', 'Oriental', 'Fruity', 'Musky'], required: true },
          { name: 'Volume', fieldType: 'select', options: ['30ml', '50ml', '75ml', '100ml', '150ml', '200ml'], required: true },
          { name: 'Gender', fieldType: 'select', options: ['Male', 'Female', 'Unisex'], required: true },
        ],
      },
      {
        name: 'Nail Care',
        icon: '💅',
        attributes: [
          { name: 'Brand', fieldType: 'text', required: false },
          { name: 'Category', fieldType: 'select', options: ['Nail Polish', 'Nail Treatment', 'Nail Art', 'Remover', 'Tools'], required: true },
          { name: 'Color', fieldType: 'text', required: false },
        ],
      },
      {
        name: 'Body Care',
        icon: '🧴',
        attributes: [
          { name: 'Brand', fieldType: 'text', required: true },
          { name: 'Category', fieldType: 'select', options: ['Lotion', 'Body Wash', 'Body Scrub', 'Deodorant', 'Body Oil', 'Hand Cream'], required: true },
          { name: 'Volume', fieldType: 'select', options: ['100ml', '200ml', '250ml', '400ml', '500ml', '750ml', '1L'], required: true },
        ],
      },
    ],
    addProductFormFields: [
      { field: 'name', label: 'Product Name', required: true, order: 1 },
      { field: 'Brand', label: 'Brand', required: true, order: 2 },
      { field: 'costPrice', label: 'Cost Price', required: true, order: 3 },
      { field: 'sellingPrice', label: 'Selling Price', required: true, order: 4 },
      { field: 'quantity', label: 'Quantity', required: true, order: 5 },
    ],
  },

  hardware_store: {
    key: 'hardware_store',
    label: 'Hardware Store',
    description: 'Tools, building materials, plumbing, electrical supplies',
    icon: '🔧',
    productTypes: [
      {
        name: 'Hand Tools',
        icon: '🔨',
        attributes: [
          { name: 'Brand', fieldType: 'text', required: true },
          { name: 'Type', fieldType: 'select', options: ['Hammer', 'Wrench', 'Screwdriver', 'Pliers', 'Saw', 'Level', 'Tape Measure', 'Utility Knife'], required: true },
          { name: 'Material', fieldType: 'select', options: ['Steel', 'Chrome Vanadium', 'Stainless Steel', 'Aluminum'], required: false },
          { name: 'Size', fieldType: 'text', required: false },
        ],
      },
      {
        name: 'Power Tools',
        icon: '⚡',
        attributes: [
          { name: 'Brand', fieldType: 'text', required: true },
          { name: 'Type', fieldType: 'select', options: ['Drill', 'Grinder', 'Circular Saw', 'Impact Driver', 'Rotary Hammer', 'Sander'], required: true },
          { name: 'Power Source', fieldType: 'select', options: ['Corded', 'Battery 12V', 'Battery 18V', 'Battery 20V'], required: true },
          { name: 'Warranty', fieldType: 'text', required: false },
        ],
      },
      {
        name: 'Electrical Supplies',
        icon: '💡',
        attributes: [
          { name: 'Brand', fieldType: 'text', required: false },
          { name: 'Type', fieldType: 'select', options: ['Cable', 'Switch', 'Outlet', 'Circuit Breaker', 'Light Bulb', 'Conduit', 'Connector'], required: true },
          { name: 'Specification', fieldType: 'text', required: true },
          { name: 'Unit', fieldType: 'select', options: ['Piece', 'Meter', 'Roll', 'Box', 'Pack'], required: true },
        ],
      },
      {
        name: 'Plumbing Supplies',
        icon: '🚿',
        attributes: [
          { name: 'Brand', fieldType: 'text', required: false },
          { name: 'Type', fieldType: 'select', options: ['Pipe', 'Fitting', 'Valve', 'Faucet', 'Hose', 'Sealant', 'Filter'], required: true },
          { name: 'Material', fieldType: 'select', options: ['PVC', 'Copper', 'Galvanized Steel', 'PEX', 'Brass', 'Chrome'], required: true },
          { name: 'Size', fieldType: 'text', required: true },
        ],
      },
      {
        name: 'Paint & Finishes',
        icon: '🎨',
        attributes: [
          { name: 'Brand', fieldType: 'text', required: true },
          { name: 'Type', fieldType: 'select', options: ['Interior Paint', 'Exterior Paint', 'Primer', 'Varnish', 'Stain', 'Spray Paint'], required: true },
          { name: 'Color', fieldType: 'text', required: true },
          { name: 'Volume', fieldType: 'select', options: ['500ml', '1L', '2L', '4L', '5L', '10L', '20L'], required: true },
        ],
      },
      {
        name: 'Fasteners & Fixings',
        icon: '🔩',
        attributes: [
          { name: 'Type', fieldType: 'select', options: ['Screws', 'Nails', 'Bolts', 'Nuts', 'Washers', 'Anchors', 'Rivets'], required: true },
          { name: 'Material', fieldType: 'select', options: ['Steel', 'Stainless Steel', 'Brass', 'Zinc-Plated', 'Galvanized'], required: true },
          { name: 'Size', fieldType: 'text', required: true },
          { name: 'Quantity per Pack', fieldType: 'number', required: true },
        ],
      },
      {
        name: 'Building Materials',
        icon: '🧱',
        attributes: [
          { name: 'Type', fieldType: 'select', options: ['Cement', 'Sand', 'Gravel', 'Bricks', 'Blocks', 'Rebar', 'Timber', 'Plywood', 'Roofing'], required: true },
          { name: 'Specification', fieldType: 'text', required: true },
          { name: 'Unit', fieldType: 'select', options: ['Piece', 'Bag', 'Kg', 'Quintal', 'Meter', 'Sheet'], required: true },
        ],
      },
    ],
    addProductFormFields: [
      { field: 'name', label: 'Product Name', required: true, order: 1 },
      { field: 'Brand', label: 'Brand', required: false, order: 2 },
      { field: 'costPrice', label: 'Cost Price', required: true, order: 3 },
      { field: 'sellingPrice', label: 'Selling Price', required: true, order: 4 },
      { field: 'quantity', label: 'Quantity', required: true, order: 5 },
    ],
  },

  restaurant_cafe: {
    key: 'restaurant_cafe',
    label: 'Restaurant / Cafe',
    description: 'Food service, beverages, kitchen supplies and ingredients',
    icon: '☕',
    productTypes: [
      {
        name: 'Beverages',
        icon: '☕',
        attributes: [
          { name: 'Category', fieldType: 'select', options: ['Coffee', 'Tea', 'Juice', 'Smoothie', 'Soda', 'Water', 'Milkshake'], required: true },
          { name: 'Size', fieldType: 'select', options: ['Small', 'Medium', 'Large', 'Extra Large'], required: true },
          { name: 'Serving Temperature', fieldType: 'select', options: ['Hot', 'Cold', 'Iced'], required: false },
        ],
      },
      {
        name: 'Main Dishes',
        icon: '🍽️',
        attributes: [
          { name: 'Category', fieldType: 'select', options: ['Ethiopian', 'Italian', 'Chinese', 'Indian', 'Fast Food', 'Grill', 'Other'], required: true },
          { name: 'Portion', fieldType: 'select', options: ['Small', 'Regular', 'Large', 'Family Size'], required: true },
          { name: 'Spice Level', fieldType: 'select', options: ['Mild', 'Medium', 'Hot', 'Extra Hot'], required: false },
        ],
      },
      {
        name: 'Snacks & Sides',
        icon: '🥐',
        attributes: [
          { name: 'Category', fieldType: 'select', options: ['Pastry', 'Sandwich', 'Salad', 'Soup', 'Fries', 'Dessert'], required: true },
          { name: 'Size', fieldType: 'select', options: ['Small', 'Medium', 'Large'], required: true },
        ],
      },
      {
        name: 'Ingredients',
        icon: '🧅',
        attributes: [
          { name: 'Category', fieldType: 'select', options: ['Vegetables', 'Meat', 'Spices', 'Dairy', 'Grains', 'Oils', 'Sauces', 'Dry Goods'], required: true },
          { name: 'Unit', fieldType: 'select', options: ['Kg', 'Gram', 'Liter', 'ml', 'Piece', 'Pack', 'Bag', 'Box'], required: true },
          { name: 'Supplier', fieldType: 'text', required: false },
        ],
      },
      {
        name: 'Packaging Supplies',
        icon: '📦',
        attributes: [
          { name: 'Type', fieldType: 'select', options: ['Cups', 'Plates', 'Containers', 'Bags', 'Napkins', 'Straws', 'Cutlery'], required: true },
          { name: 'Material', fieldType: 'select', options: ['Paper', 'Plastic', 'Biodegradable', 'Foam', 'Glass'], required: false },
          { name: 'Quantity per Pack', fieldType: 'number', required: true },
        ],
      },
    ],
    addProductFormFields: [
      { field: 'name', label: 'Item Name', required: true, order: 1 },
      { field: 'Category', label: 'Category', required: true, order: 2 },
      { field: 'costPrice', label: 'Cost Price', required: true, order: 3 },
      { field: 'sellingPrice', label: 'Selling Price', required: true, order: 4 },
      { field: 'quantity', label: 'Quantity', required: true, order: 5 },
    ],
  },

  electronics_store: {
    key: 'electronics_store',
    label: 'Electronics Store',
    description: 'Consumer electronics, appliances, and tech gadgets',
    icon: '📺',
    productTypes: [
      {
        name: 'Televisions',
        icon: '📺',
        attributes: [
          { name: 'Brand', fieldType: 'text', required: true },
          { name: 'Model', fieldType: 'text', required: true },
          { name: 'Screen Size', fieldType: 'select', options: ['32"', '40"', '43"', '50"', '55"', '65"', '75"', '85"'], required: true },
          { name: 'Resolution', fieldType: 'select', options: ['HD', 'Full HD', '4K UHD', '8K'], required: true },
          { name: 'Display Type', fieldType: 'select', options: ['LED', 'OLED', 'QLED', 'LCD'], required: false },
          { name: 'Warranty', fieldType: 'text', required: false },
        ],
      },
      {
        name: 'Laptops',
        icon: '💻',
        attributes: [
          { name: 'Brand', fieldType: 'text', required: true },
          { name: 'Model', fieldType: 'text', required: true },
          { name: 'Processor', fieldType: 'text', required: true },
          { name: 'RAM', fieldType: 'select', options: ['4GB', '8GB', '16GB', '32GB', '64GB'], required: true },
          { name: 'Storage', fieldType: 'select', options: ['128GB SSD', '256GB SSD', '512GB SSD', '1TB SSD', '1TB HDD'], required: true },
          { name: 'Screen Size', fieldType: 'select', options: ['13"', '14"', '15.6"', '16"', '17"'], required: true },
          { name: 'Warranty', fieldType: 'text', required: false },
        ],
      },
      {
        name: 'Audio Equipment',
        icon: '🔊',
        attributes: [
          { name: 'Brand', fieldType: 'text', required: true },
          { name: 'Type', fieldType: 'select', options: ['Speaker', 'Soundbar', 'Headphones', 'Microphone', 'Amplifier', 'Receiver'], required: true },
          { name: 'Power Output', fieldType: 'text', required: false },
          { name: 'Connectivity', fieldType: 'select', options: ['Bluetooth', 'Wired', 'WiFi', 'USB', 'HDMI'], required: false },
        ],
      },
      {
        name: 'Cameras',
        icon: '📷',
        attributes: [
          { name: 'Brand', fieldType: 'text', required: true },
          { name: 'Model', fieldType: 'text', required: true },
          { name: 'Type', fieldType: 'select', options: ['DSLR', 'Mirrorless', 'Point & Shoot', 'Action Camera', 'Security Camera'], required: true },
          { name: 'Resolution', fieldType: 'text', required: true },
          { name: 'Warranty', fieldType: 'text', required: false },
        ],
      },
      {
        name: 'Home Appliances',
        icon: '🏠',
        attributes: [
          { name: 'Brand', fieldType: 'text', required: true },
          { name: 'Type', fieldType: 'select', options: ['Washing Machine', 'Refrigerator', 'Microwave', 'Air Conditioner', 'Heater', 'Iron', 'Blender'], required: true },
          { name: 'Capacity/Size', fieldType: 'text', required: true },
          { name: 'Color', fieldType: 'select', options: ['White', 'Silver', 'Black', 'Grey'], required: false },
          { name: 'Warranty', fieldType: 'text', required: false },
        ],
      },
      {
        name: 'Gaming',
        icon: '🎮',
        attributes: [
          { name: 'Brand', fieldType: 'text', required: true },
          { name: 'Type', fieldType: 'select', options: ['Console', 'Game', 'Controller', 'Headset', 'Keyboard', 'Mouse'], required: true },
          { name: 'Platform', fieldType: 'select', options: ['PS5', 'Xbox', 'Nintendo', 'PC'], required: false },
        ],
      },
    ],
    addProductFormFields: [
      { field: 'name', label: 'Product Name', required: true, order: 1 },
      { field: 'Brand', label: 'Brand', required: true, order: 2 },
      { field: 'Model', label: 'Model', required: false, order: 3 },
      { field: 'costPrice', label: 'Cost Price', required: true, order: 4 },
      { field: 'sellingPrice', label: 'Selling Price', required: true, order: 5 },
      { field: 'Warranty', label: 'Warranty', required: false, order: 6 },
      { field: 'quantity', label: 'Quantity', required: true, order: 7 },
    ],
  },

  pharmacy: {
    key: 'pharmacy',
    label: 'Pharmacy',
    description: 'Medicines, health products, medical supplies and supplements',
    icon: '💊',
    productTypes: [
      {
        name: 'Medicines',
        icon: '💊',
        attributes: [
          { name: 'Generic Name', fieldType: 'text', required: true },
          { name: 'Brand Name', fieldType: 'text', required: true },
          { name: 'Dosage Form', fieldType: 'select', options: ['Tablet', 'Capsule', 'Syrup', 'Injection', 'Cream', 'Drops', 'Inhaler', 'Suppository'], required: true },
          { name: 'Strength', fieldType: 'text', required: true },
          { name: 'Batch Number', fieldType: 'text', required: false },
          { name: 'Expiry Date', fieldType: 'text', required: true },
          { name: 'Prescription Required', fieldType: 'select', options: ['Yes', 'No'], required: true },
        ],
      },
      {
        name: 'Supplements',
        icon: '🧬',
        attributes: [
          { name: 'Brand', fieldType: 'text', required: true },
          { name: 'Type', fieldType: 'select', options: ['Vitamin', 'Mineral', 'Protein', 'Herbal', 'Probiotic', 'Omega', 'Multi-vitamin'], required: true },
          { name: 'Dosage Form', fieldType: 'select', options: ['Tablet', 'Capsule', 'Powder', 'Liquid', 'Gummy'], required: true },
          { name: 'Quantity per Pack', fieldType: 'number', required: true },
          { name: 'Expiry Date', fieldType: 'text', required: true },
        ],
      },
      {
        name: 'Personal Care',
        icon: '🧴',
        attributes: [
          { name: 'Brand', fieldType: 'text', required: true },
          { name: 'Category', fieldType: 'select', options: ['Oral Care', 'Skin Care', 'Hair Care', 'Feminine Hygiene', 'First Aid', 'Sanitizer'], required: true },
          { name: 'Size', fieldType: 'text', required: true },
        ],
      },
      {
        name: 'Medical Devices',
        icon: '🩺',
        attributes: [
          { name: 'Brand', fieldType: 'text', required: true },
          { name: 'Type', fieldType: 'select', options: ['Blood Pressure Monitor', 'Thermometer', 'Glucometer', 'Nebulizer', 'Pulse Oximeter', 'Scale'], required: true },
          { name: 'Warranty', fieldType: 'text', required: false },
        ],
      },
      {
        name: 'Baby & Maternity',
        icon: '👶',
        attributes: [
          { name: 'Brand', fieldType: 'text', required: false },
          { name: 'Category', fieldType: 'select', options: ['Baby Food', 'Diapers', 'Baby Care', 'Maternity Care', 'Feeding', 'Nursing'], required: true },
          { name: 'Age/Stage', fieldType: 'select', options: ['0-6 months', '6-12 months', '1-2 years', '2-3 years', 'Maternity'], required: false },
          { name: 'Size', fieldType: 'text', required: false },
        ],
      },
      {
        name: 'First Aid Supplies',
        icon: '🩹',
        attributes: [
          { name: 'Type', fieldType: 'select', options: ['Bandage', 'Gauze', 'Antiseptic', 'Tape', 'Cotton', 'Gloves', 'Mask', 'First Aid Kit'], required: true },
          { name: 'Size/Pack', fieldType: 'text', required: true },
        ],
      },
    ],
    addProductFormFields: [
      { field: 'name', label: 'Product Name', required: true, order: 1 },
      { field: 'Brand Name', label: 'Brand/Generic Name', required: true, order: 2 },
      { field: 'costPrice', label: 'Cost Price', required: true, order: 3 },
      { field: 'sellingPrice', label: 'Selling Price', required: true, order: 4 },
      { field: 'Expiry Date', label: 'Expiry Date', required: false, order: 5 },
      { field: 'quantity', label: 'Quantity', required: true, order: 6 },
    ],
  },

  general_retail: {
    key: 'general_retail',
    label: 'General Retail Store',
    description: 'Mixed retail — variety of products across multiple categories',
    icon: '🏪',
    productTypes: [
      {
        name: 'Electronics',
        icon: '📱',
        attributes: [
          { name: 'Brand', fieldType: 'text', required: true },
          { name: 'Model', fieldType: 'text', required: false },
          { name: 'Warranty', fieldType: 'text', required: false },
        ],
      },
      {
        name: 'Clothing',
        icon: '👕',
        attributes: [
          { name: 'Brand', fieldType: 'text', required: false },
          { name: 'Size', fieldType: 'select', options: ['XS', 'S', 'M', 'L', 'XL', 'XXL'], required: true },
          { name: 'Color', fieldType: 'select', options: ['Black', 'White', 'Blue', 'Red', 'Grey', 'Green', 'Brown'], required: true },
        ],
      },
      {
        name: 'Food & Beverages',
        icon: '🛒',
        attributes: [
          { name: 'Brand', fieldType: 'text', required: true },
          { name: 'Weight/Volume', fieldType: 'text', required: true },
          { name: 'Expiry Date', fieldType: 'text', required: false },
        ],
      },
      {
        name: 'Household Items',
        icon: '🏠',
        attributes: [
          { name: 'Category', fieldType: 'select', options: ['Kitchen', 'Bathroom', 'Cleaning', 'Decor', 'Storage', 'Lighting'], required: true },
          { name: 'Material', fieldType: 'select', options: ['Plastic', 'Metal', 'Glass', 'Wood', 'Ceramic', 'Fabric'], required: false },
          { name: 'Size', fieldType: 'text', required: false },
        ],
      },
      {
        name: 'Stationery',
        icon: '✏️',
        attributes: [
          { name: 'Brand', fieldType: 'text', required: false },
          { name: 'Type', fieldType: 'select', options: ['Pen', 'Pencil', 'Notebook', 'Paper', 'Folder', 'Art Supply', 'Office Supply'], required: true },
          { name: 'Quantity per Pack', fieldType: 'number', required: false },
        ],
      },
      {
        name: 'Health & Beauty',
        icon: '💄',
        attributes: [
          { name: 'Brand', fieldType: 'text', required: true },
          { name: 'Category', fieldType: 'select', options: ['Skincare', 'Hair Care', 'Oral Care', 'Cosmetics', 'Personal Hygiene'], required: true },
          { name: 'Size', fieldType: 'text', required: false },
        ],
      },
    ],
    addProductFormFields: [
      { field: 'name', label: 'Product Name', required: true, order: 1 },
      { field: 'costPrice', label: 'Cost Price', required: true, order: 2 },
      { field: 'sellingPrice', label: 'Selling Price', required: true, order: 3 },
      { field: 'quantity', label: 'Quantity', required: true, order: 4 },
    ],
  },
}

// ============================================
// Lookup Helpers
// ============================================

export const BUSINESS_TYPE_OPTIONS: Array<{ value: BusinessTypeKey; label: string; icon: string; description: string }> = Object.values(BUSINESS_TEMPLATES).map(t => ({
  value: t.key,
  label: t.label,
  icon: t.icon,
  description: t.description,
}))

/** Map legacy businessType values to new keys */
export function mapLegacyBusinessType(legacy: string): BusinessTypeKey {
  const mapping: Record<string, BusinessTypeKey> = {
    retail: 'general_retail',
    service: 'restaurant_cafe',
    mixed: 'general_retail',
  }
  return mapping[legacy] || 'general_retail'
}

/** Check if a string is a valid BusinessTypeKey */
export function isValidBusinessType(value: string): value is BusinessTypeKey {
  return value in BUSINESS_TEMPLATES
}

/** Get a business template by key */
export function getBusinessTemplate(key: string): BusinessTemplate | undefined {
  return BUSINESS_TEMPLATES[key as BusinessTypeKey]
}

// All valid business type keys for API validation
export const VALID_BUSINESS_TYPES = Object.keys(BUSINESS_TEMPLATES) as BusinessTypeKey[]
