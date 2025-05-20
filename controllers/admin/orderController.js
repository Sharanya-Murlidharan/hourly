const Order = require('../../models/orderSchema');
const User = require('../../models/userSchema');
const Product = require('../../models/productSchema')

const getOrdersPage = async (req, res, next) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = 6;
      const skip = (page - 1) * limit;
      const searchQuery = req.query.search ? req.query.search.trim() : '';
  
      console.log('Search Query:', searchQuery); // Debug: Log the search query
  
      // Initialize search filter
      let searchFilter = {};
  
      if (searchQuery) {
        // Find users matching the search query
        const matchingUsers = await User.find({
          name: { $regex: searchQuery, $options: 'i' },
        }).select('_id name orderHistory');
  
        console.log('Matching Users:', matchingUsers); // Debug: Log matching users
  
        const userOrderIds = matchingUsers
          .flatMap(user => user.orderHistory)
          .map(id => id.toString());
  
        console.log('User Order IDs:', userOrderIds); // Debug: Log order IDs from user.orderHistory
  
        // Build search filter
        searchFilter = {
          $or: [
            { orderId: { $regex: searchQuery, $options: 'i' } }, // Search by orderId
            { _id: { $in: userOrderIds } }, // Search by orders linked to users
          ],
        };
  
        console.log('Search Filter:', JSON.stringify(searchFilter, null, 2)); // Debug: Log the final filter
      }
  
      // Count total orders for pagination
      const totalOrders = await Order.countDocuments(searchFilter);
      const totalPages = Math.ceil(totalOrders / limit);
  
      console.log('Total Orders:', totalOrders, 'Total Pages:', totalPages); // Debug: Log pagination info
  
      // Fetch orders
      const orders = await Order.find(searchFilter)
        .populate('orderedItems.product')
        .sort({ createdOn: -1 })
        .skip(skip)
        .limit(limit);
  
      console.log('Fetched Orders:', orders.length); // Debug: Log number of orders fetched
  
      // Attach user data to orders
      const ordersWithUsers = await Promise.all(
        orders.map(async (order) => {
          const user = await User.findOne({ orderHistory: order._id });
          return {
            ...order._doc,
            user: user
              ? { name: user.name, email: user.email, phone: user.phone }
              : { name: 'Unknown', email: '', phone: '' },
          };
        })
      );
  
      res.render('order', {
        orders: ordersWithUsers,
        currentPage: page,
        totalPages: totalPages,
        searchQuery: searchQuery,
      });
    } catch (error) {
       error.statusCode = 500;
        next(error);
    }
  };

const getOrderDetailPage = async (req, res, next) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findOne({ orderId })
      .populate('orderedItems.product');

    if (!order) {
      return res.status(404).render('pageerror', { message: 'Order not found' });
    }

    const user = await User.findOne({ orderHistory: order._id });

    const orderWithUser = {
      ...order._doc,
      user: user ? { name: user.name, email: user.email, phone: user.phone } : { name: 'Unknown', email: '', phone: '' }
    };

    res.render('viewOrders', {
      order: orderWithUser,
      currentPage: parseInt(req.query.page) || 1,
      searchQuery: req.query.search || ''
    });
  } catch (error) {
     error.statusCode = 500;
        next(error);
  }
};

const updateOrderStatus = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    const validStatuses = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Canceled', 'Return Request', 'Returned'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const order = await Order.findOneAndUpdate(
      { orderId },
      { status },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.status(200).json({ message: 'Status updated successfully', status });
  } catch (error) {
     error.statusCode = 500;
        next(error);
  }
};

const verifyReturn = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { action, rejectReason } = req.body;

    if (!["approve", "reject"].includes(action)) {
      return res.status(400).json({ success: false, message: "Invalid action." });
    }

    const order = await Order.findById(id).populate("orderedItems.product");
    if (!order || order.status !== "Return Request") {
      return res.status(404).json({ success: false, message: "Order not found or not in return request status." });
    }

    const user = await User.findOne({ orderHistory: order._id });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    if (action === "approve") {
      // Restore stock for returned items
      for (const item of order.orderedItems) {
        if (!item.product || !item.product._id) {
          console.error(`Product not found for item in order ${order.orderId}`);
          continue; // Skip this item if product is not populated
        }
        if (!Product) {
          console.error("Product model is not defined. Skipping stock restoration.");
          continue;
        }
        const product = await Product.findById(item.product._id);
        if (product) {
          product.quantity += item.quantity;
          await product.save();
        } else {
          console.error(`Product with ID ${item.product._id} not found in database.`);
        }
      }

      // Update wallet balance (wallet is a number in the old schema)
      if (typeof user.wallet !== 'number') {
        user.wallet = 0; // Initialize if undefined
      }
      user.wallet += order.finalAmount;
      await user.save();

      order.status = "Returned";
    } else {
      // Reject return, revert to Delivered
      if (!rejectReason || rejectReason.trim() === "") {
        return res.status(400).json({ success: false, message: "Rejection reason is required." });
      }
      order.status = "Delivered";
      order.returnReason = `Return rejected: ${rejectReason.trim()}`;
    }

    await order.save();
    res.status(200).json({ success: true, message: `Return ${action}d successfully.` });
  } catch (error) {
     error.statusCode = 500;
        next(error);
  }
};


  


module.exports = {
  getOrdersPage,
  getOrderDetailPage,
  updateOrderStatus,
  verifyReturn
};