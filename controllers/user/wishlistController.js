const User = require("../../models/userSchema");
const Product = require("../../models/productSchema")
const Wishlist = require("../../models/wishlistSchema");
const mongoose = require("mongoose");

const getWishlist = async (req, res, next) => {
  try {
    const userId = req.session.user;
    if (!userId) {
      return res.redirect("/login");
    }

    const user = await User.findById(userId);
    const wishlist = await Wishlist.findOne({ userId }).populate("products.productId");
    const wishlistItems = wishlist ? wishlist.products : [];

    res.render('wishlist', { user, wishlistItems });
  } catch (error) {
     error.statusCode = 500;
        next(error);
  }
};

const addToWishlist = async (req, res, next) => {
  try {
    const userId = req.session.user;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized: Please log in." });
    }

    const { productId } = req.body;
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ success: false, message: "Invalid product ID." });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found." });
    }

    let wishlist = await Wishlist.findOne({ userId });
    if (!wishlist) {
      wishlist = new Wishlist({ userId, products: [] });
    }

    const existingProduct = wishlist.products.find(item => item.productId.equals(productId));
    if (existingProduct) {
      return res.status(400).json({ success: false, message: "Product is already in your wishlist." });
    }

    wishlist.products.push({ productId, addedOn: new Date() });
    await wishlist.save();

    res.status(200).json({ success: true, message: "Product added to wishlist successfully." });
  } catch (error) {
     error.statusCode = 500;
        next(error);
  }
};

const removeFromWishlist = async (req, res, next) => {
  try {
    const userId = req.session.user;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized: Please log in." });
    }

    const { productId } = req.body;
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ success: false, message: "Invalid product ID." });
    }

    const wishlist = await Wishlist.findOne({ userId });
    if (!wishlist) {
      return res.status(404).json({ success: false, message: "Wishlist not found." });
    }

    const productIndex = wishlist.products.findIndex(item => item.productId.equals(productId));
    if (productIndex === -1) {
      return res.status(404).json({ success: false, message: "Product not found in wishlist." });
    }

    wishlist.products.splice(productIndex, 1);
    await wishlist.save();

    res.status(200).json({ success: true, message: "Product removed from wishlist successfully." });
  } catch (error) {
    error.statusCode = 500;
        next(error);
  }
};

module.exports = {
  getWishlist,
  addToWishlist,
  removeFromWishlist
};