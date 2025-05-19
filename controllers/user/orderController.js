const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Cart = require("../../models/cartSchema");
const Address = require("../../models/addressSchema");
const Order = require("../../models/orderSchema");
const Wallet = require("../../models/walletSchema");
const Coupon = require("../../models/couponSchema");
const Offer = require("../../models/offerSchema")
const mongoose = require("mongoose");
const Razorpay = require('razorpay');
const crypto = require('crypto');
const env = require('dotenv').config();

const calculateOfferDiscount = async (cart) => {
  try {

    console.log('1234567890',cart)
    const currentDate = new Date();
    let offerDiscount = 0;

    for (const item of cart.items) {
      const product = await Product.findById(item.productId._id)
        .populate('category')
        .populate('brand');

      if (!product) continue;

      console.log('123456789098765432',product)

      let maxDiscount = 0;

      // 1. Product-specific offer (productOffer)
      if (product.productOffer > 0) {
        const productDiscount = (product.salePrice * product.productOffer) / 100;
        maxDiscount = Math.max(maxDiscount, productDiscount);
      }

      // 2. Category offer (categoryOffer)
      if (product.category && product.category.categoryOffer > 0) {
        const categoryDiscount = (product.salePrice * product.category.categoryOffer) / 100;
        maxDiscount = Math.max(maxDiscount, categoryDiscount);
      }

      // 3. Offers from Offer model
      const offers = await Offer.find({
        isListed: true,
        isDeleted: false,
        validFrom: { $lte: currentDate },
        validUpto: { $gte: currentDate },
        $or: [
          { applicable: 'Product', applicableItem: product._id },
          { applicable: 'Category', applicableItem: product.category?._id },
          { applicable: 'Brand', applicableItem: product.brand?._id },
        ],
      });

      for (const offer of offers) {
        let offerDiscountAmount = 0;
        if (offer.offerType === 'Percentage') {
          offerDiscountAmount = (product.salePrice * offer.offerAmount) / 100;
        } else if (offer.offerType === 'Fixed') {
          offerDiscountAmount = offer.offerAmount;
        }
        maxDiscount = Math.max(maxDiscount, offerDiscountAmount);
      }

      // Apply the highest discount for this item
      offerDiscount += maxDiscount * item.quantity;
    }

    return Math.round(offerDiscount);
  } catch (error) {
    console.error("Error in calculateOfferDiscount:", error.message, error.stack);
    return 0;
  }
};

// Initialize Razorpay instance
const razorpayInstance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// const getOBjofId = (id) => {
//   return new mongoose.Types.ObjectId(id);
// };

const getCheckout = async (req, res) => {
  try {
    const userId = req.session.user;
    if (!userId) {
      return res.redirect("/login");
    }

    const user = await User.findById(userId);
    const addressDoc = await Address.findOne({ userId });
    const addresses = addressDoc ? addressDoc.address : [];
    const cart = await Cart.findOne({ userId }).populate("items.productId");
    if (!cart || cart.items.length === 0) {
      return res.redirect("/cart");
    }

    const subtotal = cart.items.reduce((total, item) => {
      return total + item.totalPrice;
    }, 0);

    const offerDiscount = await calculateOfferDiscount(cart);
    const couponDiscount = cart.discount || 0;
    const totalPrice = subtotal - offerDiscount - couponDiscount;

    const isCouponApplied = !!cart.appliedCoupon;

    res.render("checkout", {
      user,
      addresses,
      items: cart.items,
      subtotal,
      offerDiscount,
      discount: couponDiscount,
      totalPrice,
      isCouponApplied,
    });
  } catch (error) {
    console.error("Error from getCheckout:", error.message, error.stack);
    res.redirect("/pageNotFound");
  }
};

const applyCoupon = async (req, res) => {
  try {
    const userId = req.session.user;
    if (!userId) {
      return res.status(401).json({ success: false, error: "You are logged out. Please login again." });
    }

    const { couponCode } = req.body;
    if (!couponCode) {
      return res.status(400).json({ success: false, error: "Coupon code is required." });
    }

    const cart = await Cart.findOne({ userId }).populate("items.productId");
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ success: false, error: "Cart is empty." });
    }

    if (cart.appliedCoupon) {
      return res.json({ success: false, error: "A coupon is already applied. Remove it to apply a new one." });
    }

    const coupon = await Coupon.findOne({ code: couponCode, isDeleted: false });
    if (!coupon) {
      return res.json({ success: false, error: "Invalid coupon code." });
    }

    const currentDate = new Date();
    if (currentDate < coupon.validFrom || currentDate > coupon.validUpto) {
      return res.status(400).json({ success: false, error: "Coupon has expired." });
    }

    const subtotal = cart.items.reduce((total, item) => total + item.totalPrice, 0);

    if (subtotal < coupon.minCartValue) {
      return res.status(400).json({ success: false, error: `Minimum cart value of ₹${coupon.minCartValue} is required to apply this coupon.` });
    }

    cart.appliedCoupon = coupon._id;
    cart.discount = coupon.amount;
    await cart.save();

    const offerDiscount = await calculateOfferDiscount(cart);
    const totalPrice = subtotal - offerDiscount - coupon.amount;

    res.json({
      success: true,
      message: "Coupon applied successfully.",
      subtotal,
      offerDiscount,
      discount: coupon.amount,
      totalPrice
    });
  } catch (error) {
    console.error("Error from applyCoupon:", error.message, error.stack);
    res.status(500).json({ success: false, error: "An error occurred. Please try again." });
  }
};

const removeCoupon = async (req, res) => {
  try {
    const userId = req.session.user;
    if (!userId) {
      return res.status(401).json({ success: false, error: "You are logged out. Please login again." });
    }

    const cart = await Cart.findOne({ userId }).populate("items.productId");
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ success: false, error: "Cart is empty." });
    }

    if (!cart.appliedCoupon) {
      return res.status(400).json({ success: false, error: "No coupon is applied to remove." });
    }

    const subtotal = cart.items.reduce((total, item) => total + item.totalPrice, 0);

    cart.appliedCoupon = null;
    cart.discount = 0;
    await cart.save();

    const offerDiscount = await calculateOfferDiscount(cart);
    const totalPrice = subtotal - offerDiscount;

    res.status(200).json({
      success: true,
      message: "Coupon removed successfully.",
      subtotal,
      offerDiscount,
      discount: 0,
      totalPrice
    });
  } catch (error) {
    console.error("Error from removeCoupon:", error.message, error.stack);
    res.status(500).json({ success: false, error: "An error occurred. Please try again." });
  }
};

const proceedToPaymentPage = async (req, res) => {
  try {
    const userId = req.session.user;
    if (!userId) {
      return res.status(400).json({ success: false, error: "You are logged out. Please login again." });
    }

    const { addressId } = req.body;
    if (!addressId) {
      return res.status(400).json({ success: false, error: "Address is required." });
    }

    const addressDoc = await Address.findOne({ userId });
    if (!addressDoc) {
      return res.status(400).json({ success: false, error: "No address found for user." });
    }

    const selectedAddress = addressDoc.address.id(addressId);
    if (!selectedAddress) {
      return res.status(400).json({ success: false, error: "Invalid address selected." });
    }

    const cart = await Cart.findOne({ userId });
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ success: false, error: "Cart is empty." });
    }

    req.session.checkoutData = { addressId };

    res.json({ redirect: "/payment" });
  } catch (error) {
    console.error("Error from proceedToPaymentPage:", error.message, error.stack);
    res.status(500).json({ success: false, error: "An error occurred. Please try again." });
  }
};

const getPaymentPage = async (req, res) => {
  try {
    const userId = req.session.user;
    if (!userId) {
      return res.redirect("/login");
    }

    if (!req.session.checkoutData || !req.session.checkoutData.addressId) {
      return res.redirect("/checkout");
    }

    const user = await User.findById(userId);
    const addressDoc = await Address.findOne({ userId });
    const addresses = addressDoc ? addressDoc.address : [];
    const cart = await Cart.findOne({ userId }).populate("items.productId");
    if (!cart || cart.items.length === 0) {
      return res.redirect("/cart");
    }

    const subtotal = cart.items.reduce((total, item) => total + item.totalPrice, 0);
    const offerDiscount = await calculateOfferDiscount(cart);
    const discount = cart.discount || 0;
    const totalPrice = subtotal - offerDiscount - discount;
    const isCouponApplied = !!cart.appliedCoupon;
    const wallet = await Wallet.findOne({ userId });
    const walletBalance = wallet ? wallet.balance : 0;

    res.render("paymentCheckout", {
      user,
      addresses,
      items: cart.items,
      subtotal,
      offerDiscount,
      discount,
      totalPrice,
      isCouponApplied,
      walletBalance
    });
  } catch (error) {
    console.error("Error from getPaymentPage:", error.message, error.stack);
    res.redirect("/pageNotFound");
  }
};

const createRazorpayOrder = async (req, res) => {
  try {
    const userId = req.session.user;
    if (!userId) {
      return res.status(401).json({ error: "You are logged out. Please login again." });
    }

    const { amount } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Invalid amount." });
    }

    const cart = await Cart.findOne({ userId }).populate("items.productId");
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ error: "Cart is empty." });
    }

    const options = {
      amount,
      currency: "INR",
      receipt: `receipt_${Date.now()}`
    };

    const razorpayOrder = await razorpayInstance.orders.create(options);

    const addressId = req.session.checkoutData?.addressId;
    if (!addressId) {
      return res.status(400).json({ error: "No address selected." });
    }

    const addressDoc = await Address.findOne({ userId });
    const selectedAddress = addressDoc.address.id(addressId);
    if (!selectedAddress) {
      return res.status(400).json({ error: "Invalid address selected." });
    }

    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const today = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const count = await Order.countDocuments({
      createdOn: { $gte: today, $lt: tomorrow }
    });
    const seq = (count % 100).toString().padStart(2, '0');
    const orderId = `${year}${month}${day}${seq}`;

    const totalPrice = cart.items.reduce((total, item) => total + item.totalPrice, 0);
    const offerDiscount = await calculateOfferDiscount(cart);
    const finalAmount = totalPrice - offerDiscount - (cart.discount || 0);

    const order = new Order({
      user: userId, // Add the user field
      orderId,
      orderedItems: cart.items.map(item => ({
        product: item.productId._id,
        quantity: item.quantity,
        price: item.price,
      })),
      totalPrice,
      discount: cart.discount || 0,
      finalAmount,
      address: {
        name: selectedAddress.name,
        city: selectedAddress.city,
        landMark: selectedAddress.landMark,
        state: selectedAddress.state,
        pincode: selectedAddress.pincode,
        phone: selectedAddress.phone,
        altPhone: selectedAddress.altPhone,
        country: selectedAddress.country
      },
      status: "Pending",
      paymentMethod: "razorpay",
      invoiceDate: new Date(),
      couponApplied: !!cart.appliedCoupon,
      razorpayOrderId: razorpayOrder.id
    });

    await order.save();

    res.json({
      id: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency
    });
  } catch (error) {
    console.error("Error from createRazorpayOrder:", error);
    res.status(500).json({ error: error.message || "Failed to create Razorpay order." });
  }
};

const verifyRazorpayPayment = async (req, res) => {
  try {
    const userId = req.session.user;
    if (!userId) {
      return res.status(401).json({ success: false, error: "You are logged out. Please login again." });
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, error: "Missing payment details." });
    }

    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, error: "Invalid payment signature." });
    }

    const order = await Order.findOne({ razorpayOrderId: razorpay_order_id });
    if (!order) {
      return res.status(404).json({ success: false, error: "Order not found." });
    }

    order.status = "Processing";
    order.razorpayPaymentId = razorpay_payment_id;
    await order.save();

    const user = await User.findById(userId);
    user.orderHistory.push(order._id);
    await user.save();

    const cart = await Cart.findOne({ userId });
    if (cart) {
      for (const item of cart.items) {
        const product = await Product.findById(item.productId._id);
        if (product) {
          product.quantity -= item.quantity;
          await product.save();
        }
      }
      cart.items = [];
      cart.appliedCoupon = null;
      cart.discount = 0;
      await cart.save();
    }

    delete req.session.checkoutData;

    res.json({ success: true, redirect: "/orderSuccess" });
  } catch (error) {
    console.error("Error from verifyRazorpayPayment:", error)
    res.status(500).json({ success: false, error: "Payment verification failed." });
  }
};

const retryRazorpayPayment = async (req, res) => {
  try {
    const userId = req.session.user;
    if (!userId) {
      return res.status(401).json({ error: "You are logged out. Please login again." });
    }

    const { orderId } = req.body;
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ error: "Invalid order ID." });
    }

    const order = await Order.findById(orderId);
    if (!order || order.paymentMethod !== "razorpay" || order.status !== "Pending") {
      return res.status(400).json({ error: "Invalid or non-retryable order." });
    }

    if (!order.razorpayOrderId) {
      const options = {
        amount: order.finalAmount * 100,
        currency: "INR",
        receipt: `receipt_${order.orderId}`
      };
      const razorpayOrder = await razorpayInstance.orders.create(options);
      order.razorpayOrderId = razorpayOrder.id;
      await order.save();
    }

    res.json({
      id: order.razorpayOrderId,
      amount: order.finalAmount * 100,
      currency: "INR"
    });
  } catch (error) {
    console.error("Error from retryRazorpayPayment:", error.message, error.stack);
    res.status(500).json({ error: "Failed to retry payment." });
  }
};

const proceedCheckout = async (req, res) => {
  try {
    const userId = req.session.user;
    if (!userId) {
      return res.status(400).json({ success: false, error: "You are logged out. Please login again." });
    }

    const { paymentMethod } = req.body;
    if (!paymentMethod) {
      return res.status(400).json({ success: false, error: "Payment method is required." });
    }

    if (!req.session.checkoutData || !req.session.checkoutData.addressId) {
      return res.status(400).json({ success: false, error: "No address selected. Please go back to checkout." });
    }
    const addressId = req.session.checkoutData.addressId;

    const addressDoc = await Address.findOne({ userId });
    if (!addressDoc) {
      return res.status(400).json({ success: false, error: "No address found for user." });
    }

    const selectedAddress = addressDoc.address.id(addressId);
    if (!selectedAddress) {
      return res.status(400).json({ success: false, error: "Invalid address selected." });
    }

    const cart = await Cart.findOne({ userId }).populate("items.productId");
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ success: false, error: "Cart is empty." });
    }

    const productIds = cart.items.map(item => item.productId._id.toString());
    const uniqueProductIds = [...new Set(productIds)];
    if (productIds.length !== uniqueProductIds.length) {
      return res.status(400).json({ success: false, error: "Duplicate products detected in cart. Please clear cart and try again." });
    }

    const offerDiscount = await calculateOfferDiscount(cart);
    const totalPrice = cart.items.reduce((total, item) => total + item.totalPrice, 0);
    const finalAmount = totalPrice - offerDiscount - (cart.discount || 0);

    if (paymentMethod === 'wallet') {
      const wallet = await Wallet.findOne({ userId });
      if (!wallet || wallet.balance < finalAmount) {
        return res.status(400).json({
          success: false,
          error: 'Insufficient wallet balance',
        });
      }
    }

    for (const item of cart.items) {
      const product = await Product.findById(item.productId._id);
      if (!product) {
        return res.status(400).json({ success: false, error: `Product ${item.productId.productName} not found.` });
      }
      if (product.quantity < item.quantity) {
        return res.status(400).json({ success: false, error: `Insufficient stock for ${product.productName}.` });
      }
      product.quantity -= item.quantity;
      await product.save();
    }

    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const today = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const count = await Order.countDocuments({
      createdOn: { $gte: today, $lt: tomorrow }
    });
    const seq = (count % 100).toString().padStart(2, '0');
    const orderId = `${year}${month}${day}${seq}`;

    const order = new Order({
      user: userId, // Add the user field
      orderId,
      orderedItems: cart.items.map(item => ({
        product: item.productId._id,
        quantity: item.quantity,
        price: item.price,
      })),
      totalPrice,
      discount: cart.discount || 0,
      finalAmount,
      address: {
        name: selectedAddress.name,
        city: selectedAddress.city,
        landMark: selectedAddress.landMark,
        state: selectedAddress.state,
        pincode: selectedAddress.pincode,
        phone: selectedAddress.phone,
        altPhone: selectedAddress.altPhone,
        country: selectedAddress.country
      },
      status: paymentMethod === 'razorpay' ? 'Pending' : 'Processing',
      paymentMethod,
      invoiceDate: new Date(),
      couponApplied: !!cart.appliedCoupon
    });

    await order.save();

    if (paymentMethod === 'wallet') {
      await Wallet.findOneAndUpdate(
        { userId },
        {
          $inc: { balance: -finalAmount },
          $push: {
            transactions: {
              amount: finalAmount,
              type: 'debit',
              description: `Payment for order ${order.orderId}`,
              date: new Date(),
            },
          },
        },
        { upsert: true, new: true }
      );
    }

    const user = await User.findById(userId);
    user.orderHistory.push(order._id);
    await user.save();

    cart.items = [];
    cart.appliedCoupon = null;
    cart.discount = 0;
    await cart.save();

    delete req.session.checkoutData;

    res.json({ redirect: "/orderSuccess" });
  } catch (error) {
    console.error("Error from proceedCheckout:", error.message, error.stack);
    res.status(500).json({ success: false, error: error.message || "An error occurred. Please try again." });
  }
};

const getSuccess = async (req, res) => {
  try {
    const userId = req.session.user;
    if (!userId) {
      return res.redirect("/login");
    }

    const user = await User.findById(userId);

    const order = await Order.findOne({ _id: { $in: (await User.findById(userId)).orderHistory } })
      .populate("orderedItems.product")
      .sort({ createdOn: -1 });
    if (!order) {
      return res.redirect("/cart");
    }

    res.render("success", {
       user,
       order 
      });
  } catch (error) {
    console.error("Error from getSuccess:", error.message, error.stack);
    res.redirect("/pageNotFound");
  }
};

const getOrderList = async (req, res) => {
  try {
    const userId = req.session.user;
    if (!userId) {
      return res.redirect("/login");
    }

    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const skip = (page - 1) * limit;

    const user = await User.findById(userId);
    const totalOrders = await Order.countDocuments({ _id: { $in: user.orderHistory } });
    const totalPages = Math.ceil(totalOrders / limit);

    const orders = await Order.find({ _id: { $in: user.orderHistory } })
      .populate("orderedItems.product")
      .sort({ createdOn: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const formattedOrders = orders.map(order => {
      const firstItem = order.orderedItems[0] || {};
      return {
        orderId: order.orderId,
        productName: firstItem.product ? firstItem.product.productName : 'Unknown Product',
        productImage: firstItem.product && firstItem.product.productImage && firstItem.product.productImage.length > 0
          ? `${firstItem.product.productImage[0]}`
          : null,
        orderDate: order.createdOn ? order.createdOn.toLocaleDateString('en-GB') : 'N/A',
        status: order.status || 'Unknown',
        paymentMethod: order.paymentMethod || 'N/A',
        totalAmount: order.finalAmount || 0,
        deliveredOn: order.deliveredOn,
        canceledOn: order.canceledOn,
        items: order.orderedItems.map(item => ({
          productName: item.product ? item.product.productName : 'Unknown Product',
          productImage: item.product && item.product.productImage && item.product.productImage.length > 0
            ? `${item.product.productImage[0]}`
            : null,
          quantity: item.quantity,
          price: item.price,
          subtotal: item.quantity * item.price
        }))
      };
    });

    res.render("orderListing", {
      user,
      orders: formattedOrders,
      currentPage: page,
      totalPages: totalPages
    });
  } catch (error) {
    console.error("Error in getOrderList:", error.message, error.stack);
    res.redirect("/pageNotFound");
  }
};

const orderDetail = async (req, res) => {
  try {
    const userId = req.session.user;
    if (!userId) {
      return res.redirect("/login");
    }
    const orderId = req.params.id;
    const user = await User.findById(userId);
    const order = await Order.findOne({ orderId, _id: { $in: user.orderHistory } })
      .populate("orderedItems.product");
    if (!order) {
      return res.redirect("/pageNotFound");
    }
    res.render("orderDetail", {
      user,
      order
    });
  } catch (error) {
    console.error("Error from orderDetail:", error);
    res.redirect("/pageNotFound");
  }
};

const cancelOrder = async (req, res) => {
  try {
    const userId = req.session.user;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized: Please log in.' });
    }

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid order ID.' });
    }

    const user = await User.findById(userId);
    const order = await Order.findOne({ _id: id }).populate('orderedItems.product');
    if (!order || !user.orderHistory.includes(order._id)) {
      return res.status(404).json({ success: false, message: 'Order not found or unauthorized.' });
    }

    if (order.status.toLowerCase() === 'canceled' || order.status.toLowerCase() === 'delivered') {
      return res.status(400).json({ success: false, message: 'Order cannot be canceled.' });
    }

    for (const item of order.orderedItems) {
      const product = await Product.findById(item.product);
      if (product) {
        product.quantity += item.quantity;
        await product.save();
      }
    }

    if (order.finalAmount > 0 && order.paymentMethod !== 'COD') {
      if (order.paymentMethod === 'razorpay' && order.razorpayPaymentId) {
        try {
          const refund = await razorpayInstance.payments.refund(order.razorpayPaymentId, {
            amount: order.finalAmount * 100,
          });
          console.log('Razorpay refund initiated:', refund);
        } catch (refundError) {
          console.error('Razorpay refund error:', refundError.message);
          return res.status(500).json({
            success: false,
            message: 'Failed to process Razorpay refund',
          });
        }
      }

      await Wallet.findOneAndUpdate(
        { userId },
        {
          $inc: { balance: order.finalAmount },
          $push: {
            transactions: {
              amount: order.finalAmount,
              type: 'credit',
              description: `Refund for canceled order ${order.orderId}`,
              date: new Date()
            }
          }
        },
        { upsert: true, new: true }
      );
    }

    order.status = 'Canceled';
    order.totalPrice = 0;
    order.finalAmount = 0;
    order.discount = 0;
    await order.save();

    res.status(200).json({ success: true, message: 'Order canceled successfully.' });
  } catch (error) {
    console.error('Error canceling order:', error.message, error.stack);
    res.status(500).json({ success: false, message: `Server error: ${error.message}` });
  }
};

const cancelProduct = async (req, res) => {
  try {
    const userId = req.session.user;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized: Please log in.' });
    }

    const { id: orderId } = req.params;
    const { productId: orderedProductId } = req.body;
    if (!mongoose.Types.ObjectId.isValid(orderId) || !mongoose.Types.ObjectId.isValid(orderedProductId)) {
      return res.status(400).json({ success: false, message: 'Invalid order or product ID.' });
    }

    const user = await User.findById(userId);
    const order = await Order.findOne({ _id: orderId }).populate('orderedItems.product');
    if (!order || !user.orderHistory.includes(order._id)) {
      return res.status(404).json({ success: false, message: 'Order not found or unauthorized.' });
    }

    if (order.status.toLowerCase() === 'canceled' || order.status.toLowerCase() === 'delivered') {
      return res.status(400).json({ success: false, message: 'Order cannot be modified.' });
    }

    const itemIndex = order.orderedItems.findIndex(item => item._id.equals(orderedProductId));
    if (itemIndex === -1) {
      return res.status(404).json({ success: false, message: 'Product not found in order.' });
    }

    const item = order.orderedItems[itemIndex];
    if (item.quantity === 0) {
      return res.status(400).json({ success: false, message: 'Product is already canceled.' });
    }

    const subtotal = item.quantity * item.price;

    const product = await Product.findById(item.product);
    if (product) {
      product.quantity += item.quantity;
      await product.save();
    }

    if (subtotal > 0 && order.paymentMethod !== 'COD') {
      if (order.paymentMethod === 'razorpay' && order.razorpayPaymentId) {
        try {
          const refund = await razorpayInstance.payments.refund(order.razorpayPaymentId, {
            amount: subtotal * 100,
          });
          console.log('Razorpay partial refund initiated:', refund);
        } catch (refundError) {
          console.error('Razorpay partial refund error:', refundError.message);
          return res.status(500).json({
            success: false,
            message: 'Failed to process Razorpay partial refund',
          });
        }
      }

      await Wallet.findOneAndUpdate(
        { userId },
        {
          $inc: { balance: subtotal },
          $push: {
            transactions: {
              amount: subtotal,
              type: 'credit',
              description: `Refund for canceled product ${product ? product.productName : 'Unknown'} in order ${order.orderId}`,
              date: new Date()
            }
          }
        },
        { upsert: true, new: true }
      );
    }

    order.orderedItems[itemIndex].quantity = 0;
    order.totalPrice -= subtotal;
    order.finalAmount -= subtotal;

    const allCanceled = order.orderedItems.every(item => item.quantity === 0);
    if (allCanceled) {
      order.status = 'Canceled';
      order.totalPrice = 0;
      order.finalAmount = 0;
      order.discount = 0;
    }

    await order.save();

    res.status(200).json({ success: true, message: 'Product canceled successfully.' });
  } catch (error) {
    console.error('Error canceling product:', error.message, error.stack);
    res.status(500).json({ success: false, message: `Server error: ${error.message}` });
  }
};

const returnOrder = async (req, res) => {
  try {
    const userId = req.session.user;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized: Please log in.' });
    }

    const { id } = req.params;
    const { reason } = req.body;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid order ID.' });
    }

    if (!reason || reason.trim() === '') {
      return res.status(400).json({ success: false, message: 'Return reason is required.' });
    }

    const user = await User.findById(userId);
    const order = await Order.findOne({ _id: id }).populate('orderedItems.product');
    if (!order || !user.orderHistory.includes(order._id)) {
      return res.status(404).json({ success: false, message: 'Order not found or unauthorized.' });
    }

    if (order.status.toLowerCase() !== 'delivered') {
      return res.status(400).json({ success: false, message: 'Only delivered orders can be returned.' });
    }

    order.status = 'Return Request';
    order.returnReason = reason.trim();

    await Wallet.findOneAndUpdate(
      { userId },
      {
        $push: {
          transactions: {
            amount: order.finalAmount,
            type: 'credit',
            description: `Pending refund for return of order ${order.orderId}`,
            date: new Date()
          }
        }
      },
      { upsert: true }
    );

    await order.save();

    res.status(200).json({ success: true, message: 'Return request submitted successfully.' });
  } catch (error) {
    console.error('Error submitting return request:', error.message, error.stack);
    res.status(500).json({ success: false, message: `Server error: ${error.message}` });
  }
};

// const returnProduct = async (req, res) => {
//   try {
//     const userId = req.session.user;
//     if (!userId) {
//       return res.status(401).json({ success: false, message: 'Unauthorized: Please log in.' });
//     }

//     const { id } = req.params; // orderId
//     const { productId, reason } = req.body;
//     if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(productId)) {
//       return res.status(400).json({ success: false, message: 'Invalid order or product ID.' });
//     }

//     if (!reason || reason.trim() === '') {
//       return res.status(400).json({ success: false, message: 'Return reason is required.' });
//     }

//     const user = await User.findById(userId);
//     const order = await Order.findOne({ _id: id }).populate('orderedItems.product');
//     if (!order || !user.orderHistory.includes(order._id)) {
//       return res.status(404).json({ success: false, message: 'Order not found or unauthorized.' });
//     }

//     if (order.status.toLowerCase() !== 'delivered') {
//       return res.status(400).json({ success: false, message: 'Only delivered orders can be returned.' });
//     }

//     // Find the ordered item
//     const item = order.orderedItems.find(item => item._id.toString() === productId);
//     if (!item) {
//       return res.status(404).json({ success: false, message: 'Product not found in order.' });
//     }

//     // Check if the item is already returned
//     if (order.returnReasons && order.returnReasons.some(r => r.productId.toString() === productId)) {
//       return res.status(400).json({ success: false, message: 'This product is already returned.' });
//     }

//     // Add return reason for the product
//     if (!order.returnReasons) {
//       order.returnReasons = [];
//     }
//     order.returnReasons.push({
//       productId,
//       reason: reason.trim(),
//       requestedAt: new Date()
//     });

//     // Update order status to 'Return Request' if not already set
//     if (order.status.toLowerCase() !== 'return request') {
//       order.status = 'Return Request';
//     }

//     // Calculate refund amount for the product
//     const refundAmount = item.quantity * item.price;

//     // Add pending refund transaction to wallet
//     await Wallet.findOneAndUpdate(
//       { userId },
//       {
//         $push: {
//           transactions: {
//             amount: refundAmount,
//             type: 'credit',
//             description: `Pending refund for return of product ${item.product.productName} in order ${order.orderId}`,
//             date: new Date()
//           }
//         }
//       },
//       { upsert: true }
//     );

//     await order.save();

//     res.status(200).json({ success: true, message: 'Product return request submitted successfully.' });
//   } catch (error) {
//     console.error('Error submitting product return request:', error.message, error.stack);
//     res.status(500).json({ success: false, message: `Server error: ${error.message}` });
//   }
// };

const returnProduct = async (req, res) => {
  try {
    const userId = req.session.user;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized: Please log in.' });
    }

    const { id: orderId } = req.params;
    const { productId: orderedProductId, reason } = req.body;
    if (!mongoose.Types.ObjectId.isValid(orderId) || !mongoose.Types.ObjectId.isValid(orderedProductId)) {
      return res.status(400).json({ success: false, message: 'Invalid order or product ID.' });
    }

    if (!reason || reason.trim() === '') {
      return res.status(400).json({ success: false, message: 'Return reason is required.' });
    }

    const user = await User.findById(userId);
    const order = await Order.findOne({ _id: orderId }).populate('orderedItems.product');
    if (!order || !user.orderHistory.includes(order._id)) {
      return res.status(404).json({ success: false, message: 'Order not found or unauthorized.' });
    }

    if (order.status.toLowerCase() !== 'delivered') {
      return res.status(400).json({ success: false, message: 'Only delivered orders can be returned.' });
    }

    const itemIndex = order.orderedItems.findIndex(item => item._id.equals(orderedProductId));
    if (itemIndex === -1) {
      return res.status(404).json({ success: false, message: 'Product not found in order.' });
    }

    const item = order.orderedItems[itemIndex];
    if (item.quantity === 0) {
      return res.status(400).json({ success: false, message: 'Canceled products cannot be returned.' });
    }

    const subtotal = item.quantity * item.price;

    await Wallet.findOneAndUpdate(
      { userId },
      {
        $push: {
          transactions: {
            amount: subtotal,
            type: 'credit',
            description: `Pending refund for return of product in order ${order.orderId}`,
            date: new Date()
          }
        }
      },
      { upsert: true }
    );

    if (!order.returnReasons) {
      order.returnReasons = [];
    }
    order.returnReasons.push({
      productId: orderedProductId,
      reason: reason.trim()
    });

    await order.save();

    res.status(200).json({ success: true, message: 'Product return request submitted successfully.' });
  } catch (error) {
    console.error('Error submitting product return request:', error.message, error.stack);
    res.status(500).json({ success: false, message: `Server error: ${error.message}` });
  }
};

const getWallet = async (req, res) => {
  try {
    const userId = req.session.user;
    if (!userId) {
      return res.redirect("/login");
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.redirect("/login");
    }

    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const skip = (page - 1) * limit;

    const wallet = await Wallet.findOne({ userId });
    const walletData = wallet || { balance: 0, transactions: [] };

    const totalTransactions = walletData.transactions.length;
    const totalPages = Math.ceil(totalTransactions / limit);

    const transactions = walletData.transactions
      .sort((a, b) => b.date - a.date)
      .slice(skip, skip + limit);
      

    res.render("wallet", {
      user,
      wallet: walletData,
      transactions,
      currentPage: page,
      totalPages
    });
  } catch (error) {
    console.error("Error from getWallet:", error.message, error.stack);
    res.redirect("/pageNotFound");
  }
};

const getPaymentFail = async (req, res) => {
  try {
    const userId = req.session.user;
    if (!userId) {
      return res.redirect("/login");
    }

    const order = await Order.findOne({ userId, status: "Pending", paymentMethod: "razorpay" })
      .sort({ createdOn: -1 });

    res.render("paymentFail", { order });
  } catch (error) {
    console.error("Error from getPaymentFail:", error.message, error.stack);
    res.redirect("/pageNotFound");
  }
};

const getAvailableCoupons = async (req, res) => {
  try {
    const userId = req.session.user;
    if (!userId) {
      return res.status(401).json({ success: false, error: "You are logged out. Please login again." });
    }

    const currentDate = new Date();
    const coupons = await Coupon.find({
      isDeleted: false,
      validFrom: { $lte: currentDate },
      validUpto: { $gte: currentDate },
    }).lean();

    res.status(200).json({
      success: true,
      coupons,
    });
  } catch (error) {
    console.error("Error from getAvailableCoupons:", error.message, error.stack);
    res.status(500).json({
      success: false,
      error: "An error occurred. Please try again.",
    });
  }
};

module.exports = {
  getCheckout,
  applyCoupon,
  removeCoupon,
  proceedToPaymentPage,
  getPaymentPage,
  createRazorpayOrder,
  verifyRazorpayPayment,
  retryRazorpayPayment,
  proceedCheckout,
  getSuccess,
  getOrderList,
  orderDetail,
  cancelOrder,
  cancelProduct,
  returnOrder,
  returnProduct,
  getWallet,
  getPaymentFail,
  getAvailableCoupons
};