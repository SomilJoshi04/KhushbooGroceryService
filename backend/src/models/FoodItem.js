import mongoose from 'mongoose';

const foodItemSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please enter food item name'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Please enter description'],
    },
    price: {
      type: Number,
      required: [true, 'Please enter price in INR'],
      min: 0,
    },
    category: {
      type: String,
      required: true,
      enum: ['Thali', 'Biryani', 'Curry', 'Breads', 'Desserts', 'Beverages', 'Fast Food'],
      default: 'Thali',
    },
    image: {
      type: String,
      default: 'https://images.unsplash.com/photo-1589302168068-964664d93dc0?auto=format&fit=crop&w=800&q=80',
    },
    rating: {
      type: Number,
      default: 4.8,
    },
    isVeg: {
      type: Boolean,
      default: true,
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

export const FoodItem = mongoose.model('FoodItem', foodItemSchema);
