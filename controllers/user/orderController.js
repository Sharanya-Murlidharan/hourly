const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Cart = require("../../models/cartSchema");
const Address = require("../../models/addressSchema");
const Order = require("../../models/orderSchema");
const mongoose = require("mongoose");

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

    const totalPrice = cart.items.reduce((total, item) => {
      return total + item.totalPrice;
    }, 0);

    res.render("checkout", {
      user,
      addresses,
      cartItems: cart.items,
      totalPrice,
    });
  } catch (error) {
    console.error("Error from getCheckout:", error.message, error.stack);
    res.redirect("/pageNotFound");
  }
};

const proceedCheckout = async (req, res) => {
  try {
    console.log("proceedCheckout called with body:", req.body);
    console.log("Session userId:", req.session.user);

    const userId = req.session.user;
    if (!userId) {
      return res.status(400).json({ success: false, error: "You are logged out. Please login again." });
    }

    const { addressId, paymentMethod } = req.body;
    if (!addressId || !paymentMethod) {
      return res.status(400).json({ success: false, error: "Address and payment method are required." });
    }

    console.log("Fetching address for userId:", userId, "addressId:", addressId);
    const addressDoc = await Address.findOne({ userId });
    if (!addressDoc) {
      return res.status(400).json({ success: false, error: "No address found for user." });
    }

    const selectedAddress = addressDoc.address.id(addressId);
    if (!selectedAddress) {
      console.log("Address not found for addressId:", addressId, "in addressDoc:", addressDoc);
      return res.status(400).json({ success: false, error: "Invalid address selected." });
    }

    console.log("Fetching cart for userId:", userId);
    const cart = await Cart.findOne({ userId }).populate("items.productId");
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ success: false, error: "Cart is empty." });
    }

    const totalPrice = cart.items.reduce((total, item) => {
      return total + item.totalPrice;
    }, 0);

    console.log("Generating orderId");
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
    console.log("Generated orderId:", orderId);

    console.log("Creating order with totalPrice:", totalPrice);
    const order = new Order({
      orderId,
      orderedItems: cart.items.map(item => ({
        product: item.productId._id,
        quantity: item.quantity,
        price: item.price,
      })),
      totalPrice,
      finalAmount: totalPrice,
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
      paymentMethod,
      invoiceDate: new Date(),
    });

    console.log("Saving order:", order);
    await order.save();

    console.log("Updating user orderHistory for userId:", userId);
    const user = await User.findById(userId);
    user.orderHistory.push(order._id);
    await user.save();

    console.log("Clearing cart for userId:", userId);
    cart.items = [];
    await cart.save();

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

    const order = await Order.findOne({ _id: { $in: (await User.findById(userId)).orderHistory } })
      .populate("orderedItems.product")
      .sort({ createdOn: -1 });
    if (!order) {
      return res.redirect("/cart");
    }

    res.render("success", { order });
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

    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = 5; // Number of orders per page
    const skip = (page - 1) * limit;

    // Fetch total number of orders for pagination
    const user = await User.findById(userId);
    const totalOrders = await Order.countDocuments({ _id: { $in: user.orderHistory } });
    const totalPages = Math.ceil(totalOrders / limit);

    // Fetch orders for the current page
    const orders = await Order.find({ _id: { $in: user.orderHistory } })
      .sort({ createdOn: -1 }) // Sort by creation date, newest first
      .skip(skip)
      .limit(limit);

    // Render the page
    res.render("orderListing", {
      orders: orders.map(order => ({
        orderId: order.orderId,
        orderDate: order.createdOn.toLocaleDateString('en-GB'),
        status: order.status,
        paymentMethod: order.paymentMethod === 'cod' ? 'Cash on Delivery' : order.paymentMethod,
        totalAmount: order.finalAmount
      })),
      currentPage: page,
      totalPages: totalPages
    });
  } catch (error) {
    console.error("Error in getOrderList:", error.message, error.stack);
    res.redirect("/pageNotFound");
  }
};

module.exports = {
  getCheckout,
  proceedCheckout,
  getSuccess,
  getOrderList
};