const User = require("../../models/userSchema");
const Product = require("../../models/productSchema")
const Wishlist = require("../../models/wishlistSchema");
const Offer = require("../../models/offerSchema")
const mongoose = require("mongoose");

const calculateOfferPrice = async (product, quantity, price) => {
  const currentDate = new Date();

  const offers = await Offer.find({
    isDeleted: false,
    isListed: true,
    validFrom: { $lte: currentDate },
    validUpto: { $gte: currentDate }
  }).populate('applicableItem');

  const productOffers = offers.filter(offer =>
    offer.applicable === 'Product' && offer.applicableItem._id.toString() === product._id.toString()
  );

  const categoryOffers = offers.filter(offer =>
    offer.applicable === 'Category' && offer.applicableItem._id.toString() === product.category.toString()
  );

  const brandOffers = offers.filter(offer =>
    offer.applicable === 'Brand' && offer.applicableItem._id.toString() === product.brand.toString()
  );

  const allOffers = [...productOffers, ...categoryOffers, ...brandOffers];

  let highestDiscount = 0;
  let selectedOffer = null;

  for (const offer of allOffers) {
    let discount = 0;
    if (offer.offerType === 'Percentage') {
      discount = (price * offer.offerAmount) / 100;
    } else if (offer.offerType === 'Fixed') {
      discount = offer.offerAmount;
    }

    if (discount > highestDiscount) {
      highestDiscount = discount;
      selectedOffer = {
        type: offer.offerType,
        amount: offer.offerAmount,
        discount: offer.offerType === 'Percentage'
          ? offer.offerAmount
          : Math.round((discount / price) * 100)
      };
    }
  }

  if (product.productOffer > 0) {
    const productOfferDiscount = (price * product.productOffer) / 100;
    if (productOfferDiscount > highestDiscount) {
      highestDiscount = productOfferDiscount;
      selectedOffer = {
        type: 'Percentage',
        amount: product.productOffer,
        discount: product.productOffer
      };
    }
  }

  const discountedPrice = Math.round(price - highestDiscount);
  const totalPrice = discountedPrice * quantity;

  return { discountedPrice, offer: selectedOffer || { discount: 0 }, totalPrice };
};

const getWishlist = async (req, res, next) => {
  try {
    const userId = req.session.user;
    if (!userId) {
      return res.redirect("/login");
    }

    const user = await User.findById(userId);
    const wishlist = await Wishlist.findOne({ userId }).populate("products.productId");
    const wishlistItems = wishlist ? wishlist.products : [];

    for (const item of wishlistItems) {
      if (item.productId) {
        const { discountedPrice, offer } = await calculateOfferPrice(
          item.productId,
          1, // Assuming quantity: 1
          item.productId.salePrice // Assuming salePrice
        );
        item.offerDetails = { discountedPrice, offer };
      }
    }

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