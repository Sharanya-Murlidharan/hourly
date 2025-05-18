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
router.post("/verify-otp",userController.verifyOtp)
router.post("/resend-otp",userController.resendOtp)
router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }))

router.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/signup' }),
    (req, res) => {
        req.session.user = req.user._id;
        res.redirect('/');
    }
)
// homepage
router.get('/',userAuth,userController.LoadHomepage)
router.post('/search',userAuth,userController.searchProducts)

// shopping page
router.get('/shop',userAuth,userController.loadShoppingPage)
router.get('/filter',userAuth,userController.filterProduct)
router.get('/filterByPrice', userController.filterByPrice)
router.post('/search', userController.searchProducts);

//product detail page
router.get('/productDetails',userAuth,productController.productDetails)

router.get("/login",userController.loadLogin)
router.post("/login",userController.login)
router.get("/logout",userController.logout)
//profile management
router.get('/forgot-password',profileController.getForgotPassword);
router.post("/forgot-email-valid",profileController.forgotEmailValid)
router.post('/verify-passForgot-otp',profileController.verifyForgotPassOtp)
router.get('/forgotpass-otp',profileController.forgotPassOtp)
router.get('/reset-password',profileController.getResetPassPage)
router.post('/resend-forgot-otp',profileController.resendOtp)
router.post('/reset-password',profileController.postNewPassword)
router.get('/userProfile',userAuth,profileController.userProfile)
//profile change email
router.get('/change-email',userAuth,profileController.changeEmail)
router.post('/change-email',userAuth,profileController.changeEmailValid)
router.get('/newemailpage',profileController.newEmailPage)
router.post('/verify-email-otp',userAuth,profileController.verifyEmailOtp)
router.post('/update-email',userAuth,profileController.updateEmail)
//profile change password
router.get('/change-password',userAuth,profileController.changePassword)
router.post('/change-password',userAuth,profileController.changePaawordValid)
router.post('/verify-change-password-otp',userAuth,profileController.verifyChangePassOtp)
router.post('/update-password', userAuth, profileController.updatePassword); 
// edit profile
router.get('/editProfile',userAuth,uploadProfilePicture,profileController.editProfile)
router.post('/update-profile',uploadProfilePicture, profileController.updateProfile);
// address management
router.get('/address',userAuth,profileController.getAddress)
router.get('/addAddress',userAuth,profileController.addAddress)//userAuth
router.post('/add-address',userAuth,profileController.postAddAddress)//userAuth
router.get('/editAddress',userAuth,profileController.editAddress)//userAuth
router.post('/edit-address',userAuth,profileController.postEditAddress)//userAuth
router.get('/deleteAddress',userAuth,profileController.deleteAddress)//userAuth
//cart management
router.get("/cart", userAuth, cartController.getCartPage)
router.post("/addToCart",userAuth, cartController.addToCart)
router.post("/changeQuantity", userAuth,cartController.changeQuantity)
router.post("/deleteCartProduct", userAuth, cartController.deleteProduct)
//checkout
router.get("/checkout",userAuth,orderController.getCheckout)
router.get("/payment", userAuth, orderController.getPaymentPage)
router.post("/proceed-to-payment", userAuth, orderController.proceedToPaymentPage)
router.post("/checkout",userAuth,orderController.proceedCheckout)
router.post("/create-razorpay-order", userAuth, orderController.createRazorpayOrder)
router.post("/verify-razorpay-payment", userAuth, orderController.verifyRazorpayPayment)
router.post("/retry-razorpay-payment", userAuth, orderController.retryRazorpayPayment)
router.post("/apply-coupon", userAuth, orderController.applyCoupon);
router.post("/remove-coupon", userAuth, orderController.removeCoupon);
router.get("/available-coupons", userAuth, orderController.getAvailableCoupons);
router.get("/orderSuccess",userAuth,orderController.getSuccess)
router.get("/paymentFail", userAuth, orderController.getPaymentFail)
// order Listing
router.get("/orderListing",orderController.getOrderList)
router.get("/orderDetail/:id",orderController.orderDetail)
router.post('/cancel/:id', orderController.cancelOrder);
router.post('/cancel-product/:id', orderController.cancelProduct);
router.post('/return/:id', orderController.returnOrder)
// wallet
router.get('/wallet', userAuth, orderController.getWallet)

// wishlist
router.get('/wishlist',userAuth,wishlistController.getWishlist)
router.post('/addToWishlist', userAuth, wishlistController.addToWishlist);
router.post('/removeFromWishlist', userAuth, wishlistController.removeFromWishlist);




module.exports = router