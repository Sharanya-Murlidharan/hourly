const User = require('../../models/userSchema');
const Order = require('../../models/orderSchema');
const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const Brand = require('../../models/brandSchema');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const moment = require('moment');

// Render 404 error page
const pageerror = async (req, res) => {
  res.render('404-error');
};

// Load admin login page
const loadLogin = (req, res) => {
  if (req.session.admin) {
    return res.redirect('/admin/dashboard');
  }
  res.render('admin-login', { message: null });
};

// Handle admin login
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const admin = await User.findOne({ email, isAdmin: true });

    if (admin) {
      const passwordMatch = await bcrypt.compare(password, admin.password);
      if (passwordMatch) {
        req.session.admin = admin;
        req.session.Mess = 'Admin Login Successfully';
        return res.redirect('/admin/dashboard');
      } else {
        req.session.Mes = { type: 'error', text: 'Password do not match' };
        return res.redirect('/admin/login');
      }
    } else {
      req.session.Mes = { type: 'error', text: 'INVALID ADMIN' };
      return res.redirect('/admin/login');
    }
  } catch (error) {
    error.statusCode = 500;
    next(error);
  }
};

// Load admin dashboard
const loadDash = async (req, res) => {
  try {
    res.render('dashboard')

  } catch (error) {
    console.error("Error generating dashboard:", error);
    res.redirect('/admin/loaderror');
  }
}

const getChartData = async (req, res) => {
  const filter = req.params.filter || 'monthly';
  const year = parseInt(req.query.year) || new Date().getFullYear();

  let startDate, endDate = new Date();

  if (filter === 'yearly') {
    startDate = new Date(year, 0, 1);
    endDate = new Date(year, 11, 31, 23, 59, 59);
  } else {
    startDate = new Date(endDate);
    if (filter === 'daily') {
      startDate.setDate(endDate.getDate() - 1);
    } else if (filter === 'weekly') {
      startDate.setDate(endDate.getDate() - 6); // 7 days including today
    } else if (filter === 'monthly') {
      startDate.setDate(endDate.getDate() - 29); // 30 days including today
    }
  }

  try {
    const orders = await Order
      .find({
        createdOn: { $gte: startDate, $lte: endDate },
        status: { $nin: ['Canceled', 'Returned'] },
      })
      .populate({
        path: 'orderedItems.product',
        populate: [
          { path: 'category', select: 'name' },
          { path: 'brand', select: 'name' },
        ],
      });

    // Fixed Sales Map
    let salesLabels = [];
    let salesData = [];

    const now = new Date();

    if (filter === 'daily') {
      const today = now.toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
      const yesterday = new Date();
      yesterday.setDate(now.getDate() - 1);
      const yest = yesterday.toLocaleDateString('en-US', { day: '2-digit', month: 'short' });

      const dayMap = { [yest]: 0, [today]: 0 };

      orders.forEach(order => {
        const d = new Date(order.createdOn).toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
        if (dayMap[d] !== undefined) {
          dayMap[d] += order.finalAmount
        }
      });

      salesLabels = Object.keys(dayMap);
      salesData = Object.values(dayMap);
    }

    else if (filter === 'weekly' || filter === 'monthly') {
      const days = filter === 'weekly' ? 7 : 30;
      const dayMap = {};
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(now.getDate() - i);
        const label = d.toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
        dayMap[label] = 0;
      }

      orders.forEach(order => {
        const d = new Date(order.createdOn).toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
        if (dayMap[d] !== undefined) {
          dayMap[d] += order.finalAmount
        }
      });

      salesLabels = Object.keys(dayMap);
      salesData = Object.values(dayMap);
    }

    else if (filter === 'yearly') {
      const monthMap = {};
      for (let i = 0; i < 12; i++) {
        const month = new Date(year, i).toLocaleString('en-US', { month: 'short' });
        monthMap[month] = 0;
      }

      orders.forEach(order => {
        const d = new Date(order.createdOn);
        if (d.getFullYear() === year) {
          const label = d.toLocaleString('en-US', { month: 'short' });
          if (monthMap[label] !== undefined) {
            monthMap[label] += order.finalAmount
          }
        }
      });

      salesLabels = Object.keys(monthMap);
      salesData = Object.values(monthMap);
    }

    // Product Data
    const productMap = {};
    console.log(orders,'1234567890')
    orders.forEach((order) => {
      order.orderedItems.forEach((item) => {
        console.log(item.product._id)
        const productId = item.product._id.toString();
        productMap[productId] = (productMap[productId] || 0) + item.quantity;
      });
    });

    const sortedProducts = Object.entries(productMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    const productIds = sortedProducts.map(([id]) => id);
    const productDocs = await Product.find({ _id: { $in: productIds } });
    const productDetails = productDocs.reduce((acc, p) => {
      acc[p._id.toString()] = p.productName;
      return acc;
    }, {});
    const productLabels = sortedProducts.map(([id]) => productDetails[id] || 'Unknown');
    const productData = sortedProducts.map(([_, qty]) => qty);

    // Category Data
    const categoryMap = {};
    orders.forEach((order) => {
      order.orderedItems.forEach((item) => {
        const categoryName = item.product?.category?.name || 'Unknown';
        const itemRevenue = item.quantity * item.product.salePrice;
        categoryMap[categoryName] = (categoryMap[categoryName] || 0) + itemRevenue;
      });
    });

    const sortedCategories = Object.entries(categoryMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    const categoryLabels = sortedCategories.map(([label]) => label);
    const categoryData = sortedCategories.map(([_, value]) => value);

    // Brand Data
    const brandMap = {};
    orders.forEach((order) => {
      order.orderedItems.forEach((item) => {
        const brandName = item.product?.brand?.name || 'Unknown';
        const itemRevenue = item.quantity * item.product.salePrice;
        brandMap[brandName] = (brandMap[brandName] || 0) + itemRevenue;
      });
    });

    const sortedBrands = Object.entries(brandMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    const brandLabels = sortedBrands.map(([label]) => label);
    const brandData = sortedBrands.map(([_, value]) => value);

    // Order Status
    const statusMap = {};
    orders.forEach((order) => {
      const status = order.status || 'Unknown';
      statusMap[status] = (statusMap[status] || 0) + 1;
    });
    const statusLabels = Object.keys(statusMap);
    const statusData = Object.values(statusMap);

    // Recent Orders
    const lastOrders = await Order
      .find({
        createdOn: { $gte: startDate, $lte: endDate },
        status: { $nin: ['Canceled', 'Returned'] },
      })
      .populate('user')
      .sort({ createdOn: -1 })
      .limit(10);

    const recentOrders = lastOrders.map((order) => ({
      order: order._id.toString(),
      orderId: `ORD-${order.orderId || order._id}`,
      customerName: order.user?.name || 'Unknown',
      email: order.user?.email || '',
      createdOn: order.createdOn.toLocaleDateString('en-US', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
      amount: order.finalAmount,
      status: order.status || 'Unknown',
    }));

    res.json({
      labels: {
        salesOverview: salesLabels,
        products: productLabels,
        categories: categoryLabels,
        brands: brandLabels,
        orderStatus: statusLabels,
      },
      datasets: {
        sales: salesData,
        products: productData,
        categories: categoryData,
        brands: brandData,
        orderStatus: statusData,
      },
      recentOrders,
    });
  } catch (error) {
    console.error('Error fetching chart data:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
};

// Admin logout
const logout = async (req, res, next) => {
  try {
    
    req.session.admin = null
    res.redirect('/admin/login')

  } catch (error) {
    error.statusCode = 500;
    next(error);
  }
};

module.exports = {
  loadLogin,
  login,
  loadDash,
  getChartData,
  pageerror,
  logout,
};