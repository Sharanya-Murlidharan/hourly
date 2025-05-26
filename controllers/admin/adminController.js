const User = require('../../models/userSchema');
const Order = require('../../models/orderSchema');
const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const Brand = require('../../models/brandSchema');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const moment = require('moment');

const pageerror = async (req, res) => {
    res.render("404-error");
}

const loadLogin = (req, res) => {
    if (req.session.admin) {
        return res.redirect('/admin/dashboard');
    }
    res.render('admin-login', { message: null });
};

const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;
        const admin = await User.findOne({ email, isAdmin: true });

        if (admin) {
            const passwordmatch = await bcrypt.compare(password, admin.password);
            if (passwordmatch) {
                req.session.admin = admin;
                req.session.Mess = "Admin Login Successfully";
                return res.redirect("/admin/dashboard");
            } else {
                req.session.Mes = { type: "error", text: "Password do not match" };
                return res.redirect("/admin/login");
            }
        } else {
            req.session.Mes = { type: "error", text: "INVALID ADMIN" };
            return res.redirect("/admin/login");
        }
    } catch (error) {
        error.statusCode = 500;
        next(error);
    }
}

const loadDashboard = async (req, res, next) => {
    if (req.session.admin) {
        try {
            // Fetch initial chart data (this year)
            const chartData = await Order.aggregate([
                { $match: { status: "Delivered" } },
                {
                    $match: {
                        createdOn: {
                            $gte: new Date(new Date().getFullYear(), 0, 1),
                            $lte: new Date(new Date().getFullYear(), 11, 31)
                        }
                    }
                },
                {
                    $group: {
                        _id: { $dateToString: { format: "%Y-%m", date: "$createdOn" } },
                        total: { $sum: "$finalAmount" }
                    }
                },
                { $sort: { _id: 1 } }
            ]);

            const labels = chartData.map(item => item._id);
            const values = chartData.map(item => item.total);

            // Fetch top 10 products
            const topProducts = await Order.aggregate([
                { $match: { status: "Delivered" } },
                { $unwind: "$orderedItems" },
                {
                    $group: {
                        _id: "$orderedItems.product",
                        totalSold: { $sum: "$orderedItems.quantity" }
                    }
                },
                {
                    $lookup: {
                        from: "products",
                        localField: "_id",
                        foreignField: "_id",
                        as: "product"
                    }
                },
                { $unwind: "$product" },
                { $sort: { totalSold: -1 } },
                { $limit: 10 },
                {
                    $project: {
                        productName: "$product.productName",
                        totalSold: 1
                    }
                }
            ]);

            // Fetch top 10 categories
            const topCategories = await Order.aggregate([
                { $match: { status: "Delivered" } },
                { $unwind: "$orderedItems" },
                {
                    $lookup: {
                        from: "products",
                        localField: "orderedItems.product",
                        foreignField: "_id",
                        as: "product"
                    }
                },
                { $unwind: "$product" },
                {
                    $group: {
                        _id: "$product.category",
                        totalSold: { $sum: "$orderedItems.quantity" }
                    }
                },
                {
                    $lookup: {
                        from: "categories",
                        localField: "_id",
                        foreignField: "_id",
                        as: "category"
                    }
                },
                { $unwind: "$category" },
                { $sort: { totalSold: -1 } },
                { $limit: 10 },
                {
                    $project: {
                        name: "$category.name",
                        totalSold: 1
                    }
                }
            ]);

            // Fetch top 10 brands
            const topBrands = await Order.aggregate([
                { $match: { status: "Delivered" } },
                { $unwind: "$orderedItems" },
                {
                    $lookup: {
                        from: "products",
                        localField: "orderedItems.product",
                        foreignField: "_id",
                        as: "product"
                    }
                },
                { $unwind: "$product" },
                {
                    $group: {
                        _id: "$product.brand",
                        totalSold: { $sum: "$orderedItems.quantity" }
                    }
                },
                {
                    $lookup: {
                        from: "brands",
                        localField: "_id",
                        foreignField: "_id",
                        as: "brand"
                    }
                },
                { $unwind: "$brand" },
                { $sort: { totalSold: -1 } },
                { $limit: 10 },
                {
                    $project: {
                        name: "$brand.name",
                        totalSold: 1
                    }
                }
            ]);

            // Fetch recent orders (last 5)
            const recentOrders = await Order.aggregate([
                { $match: { status: { $in: ["Delivered", "Pending"] } } },
                { $sort: { createdOn: -1 } },
                { $limit: 5 },
                { $unwind: "$orderedItems" },
                {
                    $lookup: {
                        from: "products",
                        localField: "orderedItems.product",
                        foreignField: "_id",
                        as: "product"
                    }
                },
                { $unwind: "$product" },
                {
                    $lookup: {
                        from: "categories",
                        localField: "product.category",
                        foreignField: "_id",
                        as: "category"
                    }
                },
                { $unwind: "$category" },
                {
                    $group: {
                        _id: "$_id",
                        createdOn: { $first: "$createdOn" },
                        status: { $first: "$status" },
                        finalAmount: { $first: "$finalAmount" },
                        orderedItems: {
                            $push: {
                                productName: "$product.productName",
                                categoryName: "$category.name",
                                price: "$orderedItems.price",
                                quantity: "$orderedItems.quantity"
                            }
                        }
                    }
                },
                { $sort: { createdOn: -1 } }
            ]);

            res.render("dashboard", {
                chartData: { labels, values },
                topProducts,
                topCategories,
                topBrands,
                recentOrders
            });
        } catch (error) {
            console.error("error from loadDashboard", error);
            res.redirect("/pageerror");
        }
    } else {
        res.redirect("/admin/login");
    }
};

const getDashboardData = async (req, res, next) => {
    try {
        const { range, startDate, endDate } = req.query;
        let dateFilter = { status: "Delivered" };

        // Handle date range
        if (range === 'custom' && startDate && endDate) {
            const startDateObj = moment(startDate, 'DD-MM-YYYY').startOf('day').toDate();
            const endDateObj = moment(endDate, 'DD-MM-YYYY').endOf('day').toDate();
            dateFilter.createdOn = {
                $gte: startDateObj,
                $lte: endDateObj
            };
        } else if (range) {
            const today = moment().startOf('day');
            switch (range) {
                case 'today':
                    dateFilter.createdOn = {
                        $gte: today.toDate(),
                        $lte: today.endOf('day').toDate()
                    };
                    break;
                case 'last7days':
                    dateFilter.createdOn = {
                        $gte: today.subtract(6, 'days').startOf('day').toDate(),
                        $lte: moment().endOf('day').toDate()
                    };
                    break;
                case 'thisMonth':
                    dateFilter.createdOn = {
                        $gte: today.startOf('month').toDate(),
                        $lte: today.endOf('month').toDate()
                    };
                    break;
                case 'thisYear':
                    dateFilter.createdOn = {
                        $gte: today.startOf('year').toDate(),
                        $lte: today.endOf('year').toDate()
                    };
                    break;
            }
        }

        // Fetch chart data
        const chartData = await Order.aggregate([
            { $match: dateFilter },
            {
                $group: {
                    _id: { $dateToString: { format: range === 'today' ? '%Y-%m-%d' : '%Y-%m', date: "$createdOn" } },
                    total: { $sum: "$finalAmount" }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        const labels = chartData.map(item => item._id);
        const values = chartData.map(item => item.total);

        // Fetch top 10 products
        const topProducts = await Order.aggregate([
            { $match: dateFilter },
            { $unwind: "$orderedItems" },
            {
                $group: {
                    _id: "$orderedItems.product",
                    totalSold: { $sum: "$orderedItems.quantity" }
                }
            },
            {
                $lookup: {
                    from: "products",
                    localField: "_id",
                    foreignField: "_id",
                    as: "product"
                }
            },
            { $unwind: "$product" },
            { $sort: { totalSold: -1 } },
            { $limit: 10 },
            {
                $project: {
                    productName: "$product.productName",
                    totalSold: 1
                }
            }
        ]);

        // Fetch top 10 categories
        const topCategories = await Order.aggregate([
            { $match: dateFilter },
            { $unwind: "$orderedItems" },
            {
                $lookup: {
                    from: "products",
                    localField: "orderedItems.product",
                    foreignField: "_id",
                    as: "product"
                }
            },
            { $unwind: "$product" },
            {
                $group: {
                    _id: "$product.category",
                    totalSold: { $sum: "$orderedItems.quantity" }
                }
            },
            {
                $lookup: {
                    from: "categories",
                    localField: "_id",
                    foreignField: "_id",
                    as: "category"
                }
            },
            { $unwind: "$category" },
            { $sort: { totalSold: -1 } },
            { $limit: 10 },
            {
                $project: {
                    name: "$category.name",
                    totalSold: 1
                }
            }
        ]);

        // Fetch top 10 brands
        const topBrands = await Order.aggregate([
            { $match: dateFilter },
            { $unwind: "$orderedItems" },
            {
                $lookup: {
                    from: "products",
                    localField: "orderedItems.product",
                        foreignField: "_id",
                        as: "product"
                    }
                },
                { $unwind: "$product" },
                {
                    $group: {
                        _id: "$product.brand",
                        totalSold: { $sum: "$orderedItems.quantity" }
                    }
                },
                {
                    $lookup: {
                        from: "brands",
                        localField: "_id",
                        foreignField: "_id",
                        as: "brand"
                    }
                },
                { $unwind: "$brand" },
                { $sort: { totalSold: -1 } },
                { $limit: 10 },
                {
                    $project: {
                        name: "$brand.name",
                        totalSold: 1
                    }
                }
            ]);

            // Fetch recent orders (last 5)
            const recentOrders = await Order.aggregate([
                { $match: { status: { $in: ["Delivered", "Pending"] } } },
                { $sort: { createdOn: -1 } },
                { $limit: 5 },
                { $unwind: "$orderedItems" },
                {
                    $lookup: {
                        from: "products",
                        localField: "orderedItems.product",
                        foreignField: "_id",
                        as: "product"
                    }
                },
                { $unwind: "$product" },
                {
                    $lookup: {
                        from: "categories",
                        localField: "product.category",
                        foreignField: "_id",
                        as: "category"
                    }
                },
                { $unwind: "$category" },
                {
                    $group: {
                        _id: "$_id",
                        createdOn: { $first: "$createdOn" },
                        status: { $first: "$status" },
                        finalAmount: { $first: "$finalAmount" },
                        orderedItems: {
                            $push: {
                                productName: "$product.productName",
                                categoryName: "$category.name",
                                price: "$orderedItems.price",
                                quantity: "$orderedItems.quantity"
                            }
                        }
                    }
                },
                { $sort: { createdOn: -1 } }
            ]);

            res.json({
                success: true,
                chartData: { labels, values },
                topProducts,
                topCategories,
                topBrands,
                recentOrders
            });
        } catch (error) {
            res.json({ success: false, message: error.message });
            error.statusCode = 500;
            next(error);
        }
    };

    const logout = async (req, res, next) => {
        try {
            req.session.destroy(err => {
                if (err) {
                    console.log("Error destroying session", err);
                    return res.redirect("/pageerror");
                }
                res.redirect("/admin/login");
            });
        } catch (error) {
            error.statusCode = 500;
            next(error);
        }
    }

    module.exports = {
        loadLogin,
        login,
        loadDashboard,
        getDashboardData,
        pageerror,
        logout
    };