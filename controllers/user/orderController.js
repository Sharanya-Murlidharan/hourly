const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Cart = require("../../models/cartSchema");
const Address = require("../../models/addressSchema");
const Order = require("../../models/orderSchema");
const Wallet = require("../../models/walletSchema");
const Coupon = require("../../models/couponSchema");
const Offer = require("../../models/offerSchema");
const mongoose = require("mongoose");
const Razorpay = require('razorpay');
const crypto = require('crypto');
const env = require('dotenv').config();

const calculateOfferDiscount = async (cart) => {
  try {
    // console.log('1234567890',cart)
    const currentDate = new Date();
    let offerDiscount = 0;

    for (const item of cart.items) {
      const product = await Product.findById(item.productId._id)
        .populate('category')
        .populate('brand');

      if (!product) continue;

      // console.log('123456789098765432',product)

      let maxDiscount = 0;

      if (product.productOffer > 0) {
        const productDiscount = (product.salePrice * product.productOffer) / 100;
        maxDiscount = Math.max(maxDiscount, productDiscount);
      }

      if (product.category && product.category.categoryOffer > 0) {
        const categoryDiscount = (product.salePrice * product.category.categoryOffer) / 100;
        maxDiscount = Math.max(maxDiscount, categoryDiscount);
      }

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

      offerDiscount += maxDiscount * item.quantity;
    }

    return Math.round(offerDiscount);
  } catch (error) {
    console.error("Error in calculateOfferDiscount:", error.message, error.stack);
    return 0;
  }
};

const razorpayInstance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const getCheckout = async (req, res, next) => {
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

    const totalBeforeOffer = cart.items.reduce((total, item) => {
      return total + (item.price * item.quantity );
    }, 0);

    const totalAfterOffer  = cart.items.reduce((total, item) => {
      return total + item.totalPrice
    }, 0);

    const offerDiscount = totalBeforeOffer - totalAfterOffer;

    const couponDiscount = cart.discount || 0;
    const totalPrice = totalAfterOffer - couponDiscount;

    const isCouponApplied = !!cart.appliedCoupon;

    res.render("checkout", {
      user,
      addresses,
      items: cart.items,
      subtotal:totalBeforeOffer,
      offerDiscount,
      discount: couponDiscount,
      totalPrice,
      isCouponApplied,
    });
  } catch (error) {
     error.statusCode = 500;
        next(error);
  }
};

const applyCoupon = async (req, res, next) => {
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

    const totalAfterOffer = cart.items.reduce((total, item) => total + item.totalPrice, 0);
    const grandTotal = totalAfterOffer - (cart.discount || 0);
    if (grandTotal < coupon.minCartValue) {
      return res.status(400).json({
        success: false,
        error: `Minimum grand total of ₹${coupon.minCartValue} required for this coupon`,
      });
    }

    cart.appliedCoupon = coupon._id;
    cart.discount = coupon.amount;
    await cart.save();

    const totalBeforeOffer = cart.items.reduce((total, item) => {
      return total + (item.price * item.quantity);
    }, 0);

    const offerDiscount = totalBeforeOffer - totalAfterOffer;
    const couponDiscount = cart.discount || 0;
    const totalPrice = totalAfterOffer - couponDiscount;

    const isCouponApplied = !!cart.appliedCoupon;

    res.json({
      success: true,
      message: "Coupon applied successfully.",
      subtotal: totalBeforeOffer,
      offerDiscount,
      isCouponApplied,
      discount: coupon.amount,
      totalPrice,
    });
  } catch (error) {
    error.statusCode = 500;
    next(error);
  }
};

const removeCoupon = async (req, res, next) => {
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
    
    const totalBeforeOffer = cart.items.reduce((total, item) => {
      return total + (item.price * item.quantity );
    }, 0);

    const offerDiscount = totalBeforeOffer - subtotal;
    const couponDiscount = cart.discount || 0;
    const totalPrice = subtotal - couponDiscount;

    const isCouponApplied = !!cart.appliedCoupon;
   
    res.json({
      success: true,
      message: "Coupon removed successfully.",
      subtotal:totalBeforeOffer,
      offerDiscount,
      isCouponApplied,
      discount: couponDiscount,
      totalPrice
    });

  } catch (error) {
     error.statusCode = 500;
        next(error);
  }
};

const proceedToPaymentPage = async (req, res, next) => {
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

    const cart = await Cart.findOne({ userId }).populate({
      path: "items.productId",
      populate: [
        { path: "category", model: "Category" },
        { path: "brand", model: "Brand" },
      ],
    });
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ success: false, error: "Cart is empty." });
    }

    // Validate each cart item
    for (const item of cart.items) {
      const product = item.productId;
      if (!product) {
        return res.status(400).json({
          success: false,
          error: "One or more products in the cart are invalid.",
        });
      }
      if (product.isDeleted || product.isBlocked || product.status !== "Available") {
        return res.status(400).json({
          success: false,
          error: `Product '${product.productName}' is unavailable, deleted, or blocked.`,
        });
      }
      if (!product.category || product.category.isDeleted || !product.category.isListed) {
        return res.status(400).json({
          success: false,
          error: `Category for product '${product.productName}' is unlisted or deleted.`,
        });
      }
      if (!product.brand || product.brand.isDeleted || !product.brand.isListed) {
        return res.status(400).json({
          success: false,
          error: `Brand for product '${product.productName}' is unlisted or deleted.`,
        });
      }
    }

    req.session.checkoutData = { addressId };

    res.json({ redirect: "/payment" });
  } catch (error) {
    error.statusCode = 500;
    next(error);
  }
};

const getPaymentPage = async (req, res, next) => {
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

    let cart, totalBeforeOffer, totalAfterOffer, offerDiscount, couponDiscount, totalPrice, isCouponApplied;

    // Check if this is a retry payment scenario
    if (req.session.checkoutData.orderId) {
      const order = await Order.findOne({ orderId: req.session.checkoutData.orderId, user: userId }).populate("orderedItems.product");
      if (!order || order.status !== "Payment Failed") {
        return res.redirect("/orderListing");
      }

      totalBeforeOffer = order.orderedItems.reduce((total, item) => {
        return total + (item.regularPrice * item.quantity);
      }, 0);

      totalAfterOffer = order.totalPrice;
      offerDiscount = order.discount - (order.couponDiscount || 0);
      couponDiscount = order.couponDiscount || 0;
      totalPrice = order.finalAmount;
      isCouponApplied = order.couponApplied;

      // Map orderedItems to match cart.items structure for paymentCheckout.ejs
      cart = {
        items: order.orderedItems.map(item => ({
          productId: item.product,
          quantity: item.quantity,
          price: item.regularPrice,
          totalPrice: item.price * item.quantity
        }))
      };
    } else {
      cart = await Cart.findOne({ userId }).populate("items.productId");
      if (!cart || cart.items.length === 0) {
        return res.redirect("/cart");
      }

      totalBeforeOffer = cart.items.reduce((total, item) => {
        return total + (item.price * item.quantity);
      }, 0);

      totalAfterOffer = cart.items.reduce((total, item) => {
        return total + item.totalPrice;
      }, 0);

      offerDiscount = totalBeforeOffer - totalAfterOffer;
      couponDiscount = cart.discount || 0;
      totalPrice = totalAfterOffer - couponDiscount;
      isCouponApplied = !!cart.appliedCoupon;
    }

    const wallet = await Wallet.findOne({ userId });
    const walletBalance = wallet ? wallet.balance : 0;

    res.render("paymentCheckout", {
      user,
      addresses,
      items: cart.items,
      subtotal: totalBeforeOffer,
      offerDiscount,
      discount: couponDiscount,
      totalPrice,
      isCouponApplied,
      walletBalance
    });
  } catch (error) {
    error.statusCode = 500;
    next(error);
  }
};

const createRazorpayOrder = async (req, res, next) => {
  console.log("creating order on razorpay:,,,343")
  try {
    const userId = req.session.user;
    if (!userId) {
      return res.status(401).json({ error: "You are logged out. Please login again." });
    }

    const { amount } = req.body;
    console.log("total cart amount:",amount);
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
    console.log(razorpayOrder,"order is here")
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
    const finalAmount = totalPrice - (cart.discount || 0);

    const  subtotal  = cart.items.reduce((total, item) => total + ( item.price  *  item.quantity ), 0);
    const totalDiscount = subtotal - finalAmount ; 

    const order = new Order({
      user: userId,
      orderId,
      orderedItems: cart.items.map(item => ({
        product: item.productId._id,
        quantity: item.quantity,
        regularPrice:item.price,
        price: ( item.totalPrice /item.quantity ),
      })),
      totalPrice,
      discount: totalDiscount,
      couponDiscount: cart.discount || 0,
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
     req.session.order = order
    // await order.save();

    res.json({
      id: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency
    });
  } catch (error) {
    error.statusCode = 500;
        next(error);
  }
};

const verifyRazorpayPayment = async (req, res, next) => {
  try {
    const userId = req.session.user;
    if (!userId) {
      return res.status(401).json({ success: false, error: "You are logged out. Please login again." });
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      const order = await Order.findOne({ razorpayOrderId: razorpay_order_id });
      if (order) {
        order.status = "Payment Failed";
        await order.save();
      }
      return res.status(400).json({ success: false, error: "Missing payment details." });
    }

    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      const order = await Order.findOne({ razorpayOrderId: razorpay_order_id });
      if (order) {
        order.status = "Payment Failed";
        await order.save();
      }
      return res.status(400).json({ success: false, error: "Invalid payment signature." });
    }

    // Find existing order by razorpayOrderId
    const order = await Order.findOne({ razorpayOrderId: razorpay_order_id });
    if (!order) {
      return res.status(404).json({ success: false, error: "Order not found." });
    }

    order.status = "Pending";
    order.razorpayPaymentId = razorpay_payment_id;
    await order.save();

    const user = await User.findById(userId);
    if (!user.orderHistory.includes(order._id)) {
      user.orderHistory.push(order._id);
      await user.save();
    }

    // Clear cart if this is a retry or normal flow
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
    req.session.order = null; // Clear session order

    res.json({ success: true, redirect: "/orderSuccess" });
  } catch (error) {
    const { razorpay_order_id } = req.body;
    if (razorpay_order_id) {
      const order = await Order.findOne({ razorpayOrderId: razorpay_order_id });
      if (order) {
        order.status = "Payment Failed";
        await order.save();
      }
    }
    error.statusCode = 500;
    next(error);
  }
};

const retryRazorpayPayment = async (req, res, next) => {
  try {
    const userId = req.session.user;
    if (!userId) {
      return res.status(401).json({ error: "You are logged out. Please login again." });
    }

    const { orderId } = req.body; // This is the order.orderId (string), not _id
    if (!orderId) {
      return res.status(400).json({ error: "Invalid order ID." });
    }

    const order = await Order.findOne({ orderId, user: userId });
    if (!order || order.paymentMethod !== "razorpay" || order.status !== "Payment Failed") {
      return res.status(400).json({ error: "Invalid or non-retryable order." });
    }

    // Store order details in session to reuse in paymentCheckout
    req.session.checkoutData = {
      addressId: order.address._id, // Assuming address is stored as an object; adjust if needed
      orderId: order.orderId
    };

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

    // Return Razorpay order details instead of redirect
    res.json({
      success: true,
      id: order.razorpayOrderId,
      amount: order.finalAmount * 100,
      currency: "INR"
    });
  } catch (error) {
    error.statusCode = 500;
    next(error);
  }
};

const proceedCheckout = async (req, res, next) => {
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

    const totalPrice = cart.items.reduce((total, item) => total + item.totalPrice, 0);
    const finalAmount = totalPrice - (cart.discount || 0);
    const subtotal = cart.items.reduce((total, item) => total + (item.price * item.quantity), 0);
    const totalDiscount = subtotal - finalAmount;

    // Added: Restrict COD for orders above ₹1000
    if (paymentMethod === 'cod' && finalAmount > 1000) {
      return res.status(400).json({
        success: false,
        error: 'Cash on Delivery is not available for orders above ₹1000'
      });
    }
    // End of addition

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
      user: userId,
      orderId,
      orderedItems: cart.items.map(item => ({
        product: item.productId._id,
        quantity: item.quantity,
        regularPrice: item.price,
        price: (item.totalPrice / item.quantity),
      })),
      totalPrice,
      discount: totalDiscount,
      couponDiscount: cart.discount || 0,
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
      status: paymentMethod === 'razorpay' ? 'Pending' : 'Pending',
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
    error.statusCode = 500;
    next(error);
  }
};

const getSuccess = async (req, res, next) => {
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
     error.statusCode = 500;
        next(error);
  }
};

const getOrderList = async (req, res, next) => {
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
    console.log(orders,'orders')
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
      totalPages,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID // Add Razorpay key
    });
  } catch (error) {
    error.statusCode = 500;
    next(error);
  }
};

const orderDetail = async (req, res, next) => {
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
     error.statusCode = 500;
        next(error);
  }
};

const cancelOrder = async (req, res, next) => {
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
     error.statusCode = 500;
        next(error);
  }
};

const cancelProduct = async (req, res, next) => {
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
     error.statusCode = 500;
        next(error);
  }
};

const returnOrder = async (req, res, next) => {
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
        $inc: { balance: order.finalAmount },
        $push: {
          transactions: {
            amount: order.finalAmount,
            type: 'credit',
            description: `Refund for return of order ${order.orderId}`,
            date: new Date()
          }
        }
      },
      { upsert: true }
    );

    await order.save();

    res.status(200).json({ success: true, message: 'Return request submitted successfully.' });
  } catch (error) {
    error.statusCode = 500;
        next(error);
  }
};

const returnProduct = async (req, res, next) => {
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

    item.itemStatus = 'Return Request'

    if (!order.productReturnReasons) {
      order.productReturnReasons = [];
    }
    order.productReturnReasons.push({
      productId: orderedProductId,
      reason: reason.trim()
    });

    await order.save();

    res.status(200).json({ success: true, message: 'Product return request submitted successfully.' });
  } catch (error) {
     error.statusCode = 500;
        next(error);
  }
};

const getWallet = async (req, res, next) => {
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
     error.statusCode = 500;
        next(error);
  }
};

const getPaymentFail = async (req, res, next) => {
  try {
    const userId = req.session.user;
    if (!userId) {
      return res.redirect("/login");
    }
    const user = await User.findById(userId);
    
    // Find the most recent failed order
    const order = await Order.findOne({ user: userId, status: "Payment Failed", paymentMethod: "razorpay" })
      .sort({ createdOn: -1 });
    
    // If there's a pending order in session, update its status
    if (req.session.order) {
      const newOrder = new Order(req.session.order);
      newOrder.status = "Payment Failed";
      await newOrder.save();
      user.orderHistory.push(newOrder._id);
      await user.save();
      req.session.order = null; // Clear session order after saving
    }

    // Do NOT delete the cart
    // const cart = await Cart.findOneAndDelete({ userId });

    res.render("paymentFail", { order, user, razorpayKeyId: process.env.RAZORPAY_KEY_ID });
  } catch (error) {
    error.statusCode = 500;
    next(error);
  }
};

const getAvailableCoupons = async (req, res,next) => {
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
     error.statusCode = 500;
        next(error);
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