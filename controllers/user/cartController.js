const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Cart = require("../../models/cartSchema");
const Offer = require("../../models/offerSchema")
const mongoose = require("mongoose");

const getCartPage = async (req, res) => {
  try {
    const userId = req.session.user;
    if (!userId) {
      return res.redirect("/login");
    }

    const user = await User.findById(userId).populate({
      path: 'cart',
      populate: { path: 'items.productId', model: 'Product' }
    });

    if (!user) {
      return res.redirect("/pageNotFound");
    }

    let cart = user.cart[0]; // Since cart is an array, take the first cart (if any)
    let quantity = 0;
    let grandTotal = 0;
    let cartItems = [];

    if (cart && cart.items) {
      cartItems = cart.items;
      const currentDate = new Date();

      // Fetch all active offers
      const offers = await Offer.find({
        isDeleted: false,
        isListed: true,
        validFrom: { $lte: currentDate },
        validUpto: { $gte: currentDate }
      }).populate('applicableItem');

      for (const item of cartItems) {
        if (item.productId) {
          quantity += item.quantity;
          // Find applicable offers
          const productOffers = offers.filter(offer =>
            offer.applicable === 'Product' && offer.applicableItem._id.toString() === item.productId._id.toString()
          );
          const categoryOffers = offers.filter(offer =>
            offer.applicable === 'Category' && offer.applicableItem._id.toString() === item.productId.category.toString()
          );
          const brandOffers = offers.filter(offer =>
            offer.applicable === 'Brand' && offer.applicableItem._id.toString() === item.productId.brand.toString()
          );

          const allOffers = [...productOffers, ...categoryOffers, ...brandOffers];

          let highestDiscount = 0;
          let selectedOffer = null;

          for (const offer of allOffers) {
            let discount = 0;
            if (offer.offerType === 'Percentage') {
              discount = (item.price * offer.offerAmount) / 100;
            } else if (offer.offerType === 'Fixed') {
              discount = offer.offerAmount;
            }
            if (discount > highestDiscount) {
              highestDiscount = discount;
              selectedOffer = {
                type: offer.offerType,
                amount: offer.offerAmount,
                discount: offer.offerType === 'Percentage' ? offer.offerAmount : Math.round((discount / item.price) * 100)
              };
            }
          }

          // Apply productOffer from productSchema if higher
          if (item.productId.productOffer > 0) {
            const productOfferDiscount = (item.price * item.productId.productOffer) / 100;
            if (productOfferDiscount > highestDiscount) {
              highestDiscount = productOfferDiscount;
              selectedOffer = {
                type: 'Percentage',
                amount: item.productId.productOffer,
                discount: item.productId.productOffer
              };
            }
          }

          // Calculate discounted price
          item.discountedPrice = Math.round(item.price - highestDiscount);
          item.offer = selectedOffer || { discount: 0 };
          item.totalPrice = item.discountedPrice * item.quantity;
          grandTotal += item.totalPrice;
        }
      }
    }

    req.session.grandTotal = grandTotal;
    res.render("cart", {
      user,
      quantity,
      data: cartItems,
      grandTotal,
    });
  } catch (error) {
    console.error("Error in getCartPage:", error.message, error.stack);
    res.redirect("/pageNotFound");
  }
};

const addToCart = async (req, res) => {
  try {
    // Validate user session
    const userId = req.session.user;
    if (!userId) {
      return res.status(401).json({ success: false, message: "User not logged in" });
    }
    // Validate productId
    const productId = req.body.productId;
    let quantity = parseInt(req.body.quantity) || 1
    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ success: false, message: "Invalid product ID" });
    }

    // Find the user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Find the product
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    // Check stock
    if (product.quantity <= 0) {
      return res.status(400).json({ success: false, message: "Out of stock" });
    }

    // Find or create the user's cart
    let cart = await Cart.findOne({ userId }).populate('items.productId');
    let cartLength = cart ? cart.items.length : 0;

    if (!cart) {
      cart = new Cart({ userId, items: [] });
    }

    // Check if the product is already in the cart
       const itemIndex = cart.items.findIndex(item => item.productId && item.productId._id.toString() === productId);
    let newQuantity;


    if (itemIndex > -1) {
      // Product exists in cart, check if we can increase quantity
      const cartItem = cart.items[itemIndex];

   
      if(cartItem.quantity + quantity > 3){
        return res.status(400).json({ success: false, message: "Cannot add more than 3 products" });
      }

      if (cartItem.quantity < product.quantity) {
        newQuantity = cartItem.quantity + quantity;
        cartItem.quantity = newQuantity;
        cartItem.totalPrice = cartItem.price * newQuantity;
      } else {
        return res.status(400).json({ success: false, message: "Out of stock" });
      }
    } else {

      if(quantity > 3){
        return res.status(400).json({ success: false, message: "Cannot add more than 3 products" });
      }
      // Product not in cart, add new item
      newQuantity = quantity;
      cart.items.push({
        productId: productId,
        quantity: newQuantity,
        price: product.salePrice,
        totalPrice: product.salePrice * newQuantity,
        status: 'placed',
        cancellationReason: 'none'
      });
      cartLength += quantity;
    }

    // Save the cart
    await cart.save();

    // Update the user's cart array with the cart's ObjectId
    if (!user.cart.includes(cart._id)) {
      await User.findByIdAndUpdate(userId, {
        $addToSet: { cart: cart._id },
      });
    }

    // Update product stock
    // const updatedProduct = await Product.findByIdAndUpdate(
    //   productId,
    //   { $inc: { quantity: -1 } },
    //   { new: true }
    // );

    // // Update status if out of stock
    // if (updatedProduct.quantity === 0) {
    //   await Product.findByIdAndUpdate(productId, { status: "out of stock" });
    // }

    return res.json({
      success: true,
      message: "Product added to cart successfully",
      cartLength,
      user: userId,
      // remainingStock: updatedProduct.quantity
    });
  } catch (error) {
    console.error("Error in addToCart:", error.message, error.stack);
    return res.status(500).json({ success: false, message: "Server error: " + error.message });
  }
};

const changeQuantity = async (req, res) => {
  try {
    const productId = req.body.productId;
    const userId = req.session.user;
    const count = parseInt(req.body.count);

    if (!userId) {
      return res.status(401).json({ success: false, message: "User not logged in" });
    }

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ success: false, message: "Invalid product ID" });
    }

    if (count !== 1 && count !== -1) {
      return res.status(400).json({ success: false, message: "Invalid count" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const cart = await Cart.findOne({ userId }).populate('items.productId');
    if (!cart) {
      return res.status(404).json({ success: false, message: "Cart not found" });
    }

    const itemIndex = cart.items.findIndex(item => item.productId._id.toString() === productId);
    if (itemIndex === -1) {
      return res.status(404).json({ success: false, message: "Product not in cart" });
    }

    const cartItem = cart.items[itemIndex];

    if(count > 0){
      if(cartItem.quantity >= 3){
        return res.status(400).json({ success: false, message: "Cannot add more than 3 products" });
      }
    }

    const product = cartItem.productId;

    const newQuantity = cartItem.quantity + count;
    if (newQuantity <= 0) {
      return res.status(400).json({ success: false, message: "Quantity cannot be less than 1" });
    }

    if(count > 0){
      if (newQuantity > product.quantity) {
        return res.status(400).json({ success: false, message: "Out of stock" });
      }
    }

    cartItem.quantity = newQuantity;
    cartItem.totalPrice = cartItem.price * newQuantity;
    await cart.save();

    // Update product stock
    // await Product.findByIdAndUpdate(productId, {
    //   $inc: { quantity: count === 1 ? -1 : 1 }
    // });

    let grandTotal = 0;
    for (const item of cart.items) {
      grandTotal += item.totalPrice;
    }

    res.json({
      success: true,
      message: "Quantity updated successfully",
      quantityInput: newQuantity,
      count,
      totalAmount: cartItem.price * newQuantity,
      grandTotal,
    });
  } catch (error) {
    console.error("Error in changeQuantity:", error.message, error.stack);
    return res.status(500).json({ success: false, message: "Server error: " + error.message });
  }
};

const deleteProduct = async (req, res) => {
  try {
    const productId = req.body.productId;
    const userId = req.session.user;

    console.log("deleteProduct called with userId:", userId, "and productId:", productId);
    console.log("Session data:", req.session);

    if (!userId) {
      console.log("No userId in session, responding with JSON error");
      return res.status(401).json({ success: false, message: "User not logged in" });
    }

    const user = await User.findById(userId);
    if (!user) {
      console.log("User not found for userId:", userId);
      return res.status(404).json({ success: false, message: "User not found" });
    }

    console.log("User found:", user.email, "Blocked:", user.isBlocked);

    if (user.isBlocked) {
      console.log("User is blocked, responding with JSON error");
      return res.status(403).json({ success: false, message: "User is blocked" });
    }

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      console.log("Invalid productId:", productId);
      return res.status(400).json({ success: false, message: "Invalid product ID" });
    }

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      console.log("Cart not found for userId:", userId);
      return res.status(404).json({ success: false, message: "Cart not found" });
    }

    // Find the item in the cart's items array
    const itemIndex = cart.items.findIndex(item => item.productId.toString() === productId);
    if (itemIndex === -1) {
      console.log("Product not in cart, productId:", productId);
      return res.status(404).json({ success: false, message: "Product not in cart" });
    }

    const cartItem = cart.items[itemIndex];
    // const quantityToRestore = cartItem.quantity;

    // Restore the product stock
    // await Product.findByIdAndUpdate(productId, {
    //   $inc: { quantity: quantityToRestore }
    // });

    // Remove the item from the cart's items array
    cart.items.splice(itemIndex, 1);
    await cart.save();

    // If the cart is empty, remove it from the user's cart array
    if (cart.items.length === 0) {
      await User.findByIdAndUpdate(userId, {
        $pull: { cart: cart._id },
      });
      await Cart.findByIdAndDelete(cart._id);
    }

    console.log("Product removed successfully, productId:", productId);
    return res.json({
      success: true,
      message: "Product removed from cart successfully",
    });
  } catch (error) {
    console.error("Error in deleteProduct:", error.message, error.stack);
    return res.status(500).json({ success: false, message: "Server error: " + error.message });
  }
};



module.exports = {
  getCartPage,
  addToCart,
  changeQuantity,
  deleteProduct,
};