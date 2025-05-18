const mongoose = require('mongoose');
const { Schema } = mongoose;

const orderSchema = new Schema({
  orderId: {
    type: String,
    unique: true,
    required: true
  },
   user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  orderedItems: [{
    product: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    quantity: {
      type: Number,
      required: true
    },
    price: {
      type: Number,
      default: 0
    }
  }],
  totalPrice: {
    type: Number,
    required: true
  },
  discount: {
    type: Number,
    default: 0
  },
  finalAmount: {
    type: Number,
    required: true
  },
  address: {
    name: { type: String, required: true },
    city: { type: String, required: true },
    landMark: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: Number, required: true },
    phone: { type: String, required: true },
    altPhone: { type: String, required: true },
    country: { type: String, required: true }
  },
  invoiceDate: {
    type: Date
  },
  status: {
    type: String,
    required: true,
    enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Canceled', 'Return Request', 'Returned']
  },
  createdOn: {
    type: Date,
    default: Date.now,
    required: true
  },
  couponApplied: {
    type: Boolean,
    default: false
  },
  paymentMethod: {
    type: String,
    required: true,
    enum: ['cod', 'razorpay', 'wallet']
  },
  returnReason: {
    type: String,
    default: null
  },
  razorpayOrderId: {
    type: String,
    default: null // Store Razorpay order ID for retries
  }
});

const Order = mongoose.model("Order", orderSchema);
module.exports = Order;