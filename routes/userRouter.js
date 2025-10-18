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
// homepage
router.get('/',userAuth,userController.LoadHomepage)

// shopping page
router.get('/shop',userAuth,userController.loadShoppingPage)

//product detail page
router.get('/productDetails',userAuth,productController.productDetails)

router.get("/login",userController.loadLogin)
router.post("/login",userController.login)
router.get("/logout",userAuth,userController.logout)
//profile management
router.get('/forgotPassword',profileController.getForgotPassword);
router.post("/forgotEmailValid",profileController.forgotEmailValid)
router.post('/verifyPassForgotOtp',profileController.verifyForgotPassOtp)
router.get('/forgotPassOtp',profileController.forgotPassOtp)
router.get('/resetPassword',profileController.getResetPassPage)
router.post('/resendForgotOtp',profileController.resendOtp)
router.post('/resetPassword',profileController.postNewPassword)
router.get('/userProfile',userAuth,profileController.userProfile)
//profile change email
router.get('/changeEmail',userAuth,profileController.changeEmail)
router.post('/changeEmail',userAuth,profileController.changeEmailValid)
router.get('/newEmailPage',userAuth,profileController.newEmailPage)
router.post('/verifyEmailOtp',userAuth,profileController.verifyEmailOtp)
router.post('/updateEmail',userAuth,profileController.updateEmail)
//profile change password
router.get('/changePassword',userAuth,profileController.changePassword)
router.post('/changePassword',userAuth,profileController.changePaawordValid)
router.post('/verifyChangePasswordOtp',userAuth,profileController.verifyChangePassOtp)
router.post('/updatePassword', userAuth, profileController.updatePassword); 
// edit profile
router.get('/editProfile', userAuth, profileController.editProfile)
router.post('/updateProfile', userAuth, uploadProfilePicture, profileController.updateProfile);
router.post('/removeProfilePicture', userAuth, profileController.removeProfilePicture);
// address management
router.get('/address',userAuth,profileController.getAddress)
router.get('/addAddress',userAuth,profileController.addAddress)
router.post('/addAddress',userAuth,profileController.postAddAddress)
router.get('/editAddress',userAuth,profileController.editAddress)
router.post('/editAddress',userAuth,profileController.postEditAddress)
router.get('/deleteAddress',userAuth,profileController.deleteAddress)
router.get('/setDefaultAddress', userAuth, profileController.setDefaultAddress)
//cart management
router.get("/cart", userAuth, cartController.getCartPage)
router.post("/addToCart",userAuth, cartController.addToCart)
router.post("/changeQuantity", userAuth,cartController.changeQuantity)
router.post("/deleteCartProduct", userAuth, cartController.deleteProduct)
//checkout
router.get("/checkout",userAuth,orderController.getCheckout)
router.get("/payment", userAuth, orderController.getPaymentPage)
router.post("/proceedToPayment", userAuth, orderController.proceedToPaymentPage)
router.post("/checkout",userAuth,orderController.proceedCheckout)
router.post("/createRazorpayOrder", userAuth, orderController.createRazorpayOrder)
router.post("/verifyRazorpayPayment", userAuth, orderController.verifyRazorpayPayment)
router.post("/retryRazorpayPayment", userAuth, orderController.retryRazorpayPayment)
router.post("/applyCoupon", userAuth, orderController.applyCoupon);
router.post("/removeCoupon", userAuth, orderController.removeCoupon);
router.get("/availableCoupons", userAuth, orderController.getAvailableCoupons);
router.get("/orderSuccess",userAuth,orderController.getSuccess)
router.get("/paymentFail", userAuth, orderController.getPaymentFail)
// order Listing
router.get("/orderListing",userAuth,orderController.getOrderList)
router.get("/orderDetail/:id",userAuth,orderController.orderDetail)
router.post('/cancel/:id', userAuth,orderController.cancelOrder);
router.post('/cancel-product/:id', userAuth,orderController.cancelProduct);
router.post('/return/:id', userAuth,orderController.returnOrder)
router.post('/return-product/:id', userAuth,orderController.returnProduct);
// wallet
router.get('/wallet', userAuth, orderController.getWallet)
router.get('/addMoney', orderController.getAddMoneyPage);
router.post('/createWalletTopupOrder', orderController.createWalletTopupOrder);
router.post('/verifyWalletTopup', orderController.verifyWalletTopup);

// wishlist
router.get('/wishlist',userAuth,wishlistController.getWishlist)
router.post('/addToWishlist', userAuth, wishlistController.addToWishlist);
router.post('/removeFromWishlist', userAuth, wishlistController.removeFromWishlist);
// about
router.get('/about',userAuth,userController.aboutpage)
// contact
router.get('/contact',userAuth,userController.loadContact)



module.exports = router