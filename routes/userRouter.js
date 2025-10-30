const express = require('express')
const router = express.Router()
const userController = require('../controllers/user/userController')
const passport = require('../config/passport') 
//const login  = require('../controllers/userController')
const {uploadProfilePicture} = require("../helpers/multer")

const profileController = require("../controllers/user/profileController")
const productController = require("../controllers/user/productController")
const cartController = require("../controllers/user/cartController")
const orderController = require("../controllers/user/orderController")
const wishlistController = require("../controllers/user/wishlistController")
const {userAuth} = require("../middlewares/auth")



router.get('/pageNotFound',userController.pageNotFound)
router.get('/signup',userController.loadSignup)
router.post('/signup',userController.signup)
router.post("/verifyOtp",userController.verifyOtp)
router.post("/resendOtp",userController.resendOtp)
router.get('/auth/google',(req, res, next) => {
  const referralCode = req.query.referralCode || "";

  passport.authenticate("google", {
    scope: ["profile", "email"],
    state: JSON.stringify({ referralCode }),
  })(req, res, next);
});

router.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/signup' }),
    (req, res) => {
        req.session.user = req.user._id;
        res.redirect('/');
    }
)
router.get('/', userAuth, userController.LoadHomepage);
router.get('/shop', userAuth, userController.loadShoppingPage);
router.get('/productDetails/:id', userAuth, productController.productDetails);

/* ---------- PROFILE ---------- */
router.get('/userProfile', userAuth, profileController.userProfile);

/* Change Email */
router.get('/changeEmail', userAuth, profileController.changeEmail);
router.post('/changeEmail', userAuth, profileController.changeEmailValid);
router.get('/newEmailPage', userAuth, profileController.newEmailPage);
router.post('/verifyEmailOtp', userAuth, profileController.verifyEmailOtp);
router.put('/updateEmail', userAuth, profileController.updateEmail);

/* Change Password */
router.get('/changePassword', userAuth, profileController.changePassword);
router.post('/changePassword', userAuth, profileController.changePaawordValid);
router.post('/verifyChangePasswordOtp', userAuth, profileController.verifyChangePassOtp);
router.put('/updatePassword', userAuth, profileController.updatePassword);

/* Edit Profile */
router.get('/editProfile', userAuth, profileController.editProfile);
router.put('/updateProfile', userAuth, uploadProfilePicture, profileController.updateProfile);
router.patch('/removeProfilePicture', userAuth, profileController.removeProfilePicture); // PATCH instead of DELETE

/* ---------- ADDRESS ---------- */
router.get('/address', userAuth, profileController.getAddress);
router.get('/addAddress', userAuth, profileController.addAddress);
router.post('/addAddress', userAuth, profileController.postAddAddress);

router.get('/editAddress/:id', userAuth, profileController.editAddress);
router.put('/editAddress/:id', userAuth, profileController.postEditAddress);   // PUT = full replace

router.patch('/deleteAddress/:id', userAuth, profileController.deleteAddress); // PATCH for soft-delete / removal
router.patch('/setDefaultAddress/:id', userAuth, profileController.setDefaultAddress);

/* ---------- CART ---------- */
router.get('/cart', userAuth, cartController.getCartPage);
router.post('/addToCart', userAuth, cartController.addToCart);
router.put('/changeQuantity', userAuth, cartController.changeQuantity);
router.patch('/deleteCartProduct/:id', userAuth, cartController.deleteProduct); // PATCH instead of DELETE

/* ---------- CHECKOUT & PAYMENT ---------- */
router.get('/checkout', userAuth, orderController.getCheckout);
router.get('/payment', userAuth, orderController.getPaymentPage);
router.post('/proceedToPayment', userAuth, orderController.proceedToPaymentPage);
router.post('/checkout', userAuth, orderController.proceedCheckout);
router.post('/createRazorpayOrder', userAuth, orderController.createRazorpayOrder);
router.post('/verifyRazorpayPayment', userAuth, orderController.verifyRazorpayPayment);
router.post('/retryRazorpayPayment', userAuth, orderController.retryRazorpayPayment);
router.post('/applyCoupon', userAuth, orderController.applyCoupon);
router.patch('/removeCoupon', userAuth, orderController.removeCoupon); // PATCH instead of DELETE
router.get('/availableCoupons', userAuth, orderController.getAvailableCoupons);
router.get('/orderSuccess', userAuth, orderController.getSuccess);
router.get('/paymentFail', userAuth, orderController.getPaymentFail);

/* ---------- ORDERS ---------- */
router.get('/orderListing', userAuth, orderController.getOrderList);
router.get('/orderDetail/:id', userAuth, orderController.orderDetail);

router.patch('/cancel/:id', userAuth, orderController.cancelOrder);
router.patch('/cancel-product/:id', userAuth, orderController.cancelProduct);
router.patch('/return/:id', userAuth, orderController.returnOrder);
router.patch('/return-product/:id', userAuth, orderController.returnProduct);

/* ---------- WALLET ---------- */
router.get('/wallet', userAuth, orderController.getWallet);
router.get('/addMoney', userAuth, orderController.getAddMoneyPage);
router.post('/createWalletTopupOrder', userAuth, orderController.createWalletTopupOrder);
router.post('/verifyWalletTopup', userAuth, orderController.verifyWalletTopup);

/* ---------- WISHLIST ---------- */
router.get('/wishlist', userAuth, wishlistController.getWishlist);
router.post('/addToWishlist', userAuth, wishlistController.addToWishlist);
router.patch('/removeFromWishlist/:id', userAuth, wishlistController.removeFromWishlist); // PATCH instead of DELETE

/* ---------- STATIC PAGES ---------- */
router.get('/about', userAuth, userController.aboutpage);
router.get('/contact', userAuth, userController.loadContact);



module.exports = router