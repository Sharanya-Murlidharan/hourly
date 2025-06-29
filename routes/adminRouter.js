    const express = require('express')
    const router = express.Router()
    const adminController = require('../controllers/admin/adminController')
    const {adminAuth} = require("../middlewares/auth")
    const {adminErrorHandler} = require("../middlewares/error")
    const multer = require("multer")
    // const storage = require("../helpers/multer")
    const {uploads} = require("../helpers/multer")
    const customerController = require("../controllers/admin/customerController")
    const categoryController = require('../controllers/admin/categoryController')
    const brandController = require("../controllers/admin/brandController")
    const productController = require("../controllers/admin/productController")
    const orderController = require("../controllers/admin/orderController")
    const couponController = require("../controllers/admin/couponController")
    const offerController = require("../controllers/admin/offerController")
    const salesController = require('../controllers/admin/salesController');


    router.get('/login',adminController.loadLogin)
    router.post("/login",adminController.login)
    router.get('/dashboard',adminAuth,adminController.loadDash);
    router.get('/dashboard/data/:filter', adminAuth, adminController.getChartData);
    router.get("/pageError",adminController.pageerror)
    router.get('/logout',adminController.logout)
    //customer
    router.get("/users",adminAuth,customerController.customerInfo)
    router.get('/blockCustomer',adminAuth,customerController.customerBlocked)
    router.get('/unblockCustomer',adminAuth,customerController.customerunBlocked)
    //category
    router.get('/category',adminAuth,categoryController.categoryInfo)
    router.post("/addCategory",adminAuth,categoryController.addCategory)
    router.get('/listCategory',adminAuth, categoryController.categoryListed);
    router.get('/unlistCategory', adminAuth,categoryController.categoryunListed);
    router.patch('/editCategory', adminAuth, categoryController.editCategory);
    router.patch('/deleteCategory', adminAuth,categoryController.deleteCategory)
    //brand
    router.get('/brands', adminAuth, brandController.getBrandPage); // Display brand management page
    router.post("/addBrand",adminAuth,brandController.addBrand)
    router.get("/listBrand",adminAuth,brandController.brandListed)
    router.get("/unlistBrand",adminAuth,brandController.brandunListed)
    router.patch("/editBrand",adminAuth,brandController.editBrand)
    router.patch("/deleteBrand",adminAuth,brandController.deleteBrand)
    // product
    router.get('/products', adminAuth, productController.getProductListPage);
    router.get("/addProducts",adminAuth,productController.getProductAddPage)
    router.post("/addProducts",uploads,productController.addProducts)
    router.get('/listProduct/:id', adminAuth, productController.listProduct);
    router.get('/unlistProduct/:id', adminAuth, productController.unlistProduct);
    router.get('/editProducts/:id', adminAuth, productController.getProductEditPage);
    router.patch('/editProducts', adminAuth,uploads, productController.editProducts);
    router.patch("/deleteProducts", adminAuth, productController.deleteProduct);
    // order
    router.get('/orders', adminAuth, orderController.getOrdersPage);
    router.get('/orderDetail/:orderId', adminAuth, orderController.getOrderDetailPage);
    router.post('/orders/:orderId/status', adminAuth, orderController.updateOrderStatus)
    router.post('/orders/:orderId/:productId/return', orderController.verifySingleProductReturn);
    // return requests
    router.post('/verify-return/:id', adminAuth, orderController.verifyReturn);
    
    //coupon management
    router.get("/coupon",adminAuth,couponController.getCoupon)
    router.post('/addCoupon',adminAuth, couponController.addCoupon);
    router.patch('/editCoupon',adminAuth,couponController.editCoupon)
    router.patch('/deleteCoupon',adminAuth,couponController.deleteCoupon)
    //offer management
    router.get("/offers", adminAuth, offerController.getOffer);
    router.post('/addOffer', adminAuth, offerController.addOffer);
    router.patch('/editOffer', adminAuth, offerController.editOffer);
    router.patch('/deleteOffer', adminAuth, offerController.deleteOffer);

    // Sales routes
    router.get('/sales', adminAuth, salesController.getSalesReport);
    router.get('/sales/data', adminAuth, salesController.getSalesData);
    router.get('/sales/report/pdf', adminAuth, salesController.generatePDFReport);
    router.get('/sales/report/excel', adminAuth, salesController.generateExcelReport);

    router.use(adminErrorHandler)
    module.exports = router