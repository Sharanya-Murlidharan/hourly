const mongoose = require('mongoose');
const { Schema } = mongoose;

const userSchema = new Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  phone: {
    type: String,
    required: false,
    unique: false,
    sparse: true,
    default: null
  },
  googleId: {
    type: String,
    unique: true
  },
  password: {
    type: String,
    required: false
  },
  isBlocked: {
    type: Boolean,
    default: false
  },
  isAdmin: {
    type: Boolean,
    default: false
  },
  cart: [{
    type: Schema.Types.ObjectId,
    ref: "Cart",
  }],
  ProfilePicture: {
    type: String,
    required: false,
  },
  wishlist: [{
    type: Schema.Types.ObjectId,
    ref: "Wishlist"
  }],
  orderHistory: [{
    type: Schema.Types.ObjectId,
    ref: "Order"
  }],
  createdOn: {
    type: Date,
    default: Date.now,
  },
 referralCode: { // Corrected spelling from 'referalCode' to 'referralCode'
    type: String,
    unique: true, // Ensure uniqueness
    validate: {
      validator: function (v) {
        return v && v.length === 8; // Validate length is exactly 8 characters
      },
      message: 'Referral code must be exactly 8 characters long'
    },
    sparse: true // Allow null values while maintaining uniqueness
  },
  redeemed: {
    type: Boolean
  },
  redeemedUsers: [{
    type: Schema.Types.ObjectId,
    ref: "User"
  }],
  searchHistory: [{
    caregory: {
      type: Schema.Types.ObjectId,
      ref: "Category",
    },
    brand: {
      type: String
    },
    searchOn: {
      type: Date,
      default: Date.now
    }
  }]
});

const User = mongoose.model("User", userSchema);
module.exports = User;