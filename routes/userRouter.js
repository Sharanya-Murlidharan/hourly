const express = require('express')
const router = express.Router()
const userController = require('../controllers/user/userController')
const passport = require('../config/passport') 
//const login  = require('../controllers/userController')
const {uploadProfilePicture} = require("../helpers/multer")

const profileController = require("../controllers/user/profileController")
const productController = require("../controllers/user/productController")
const cartController = require("../controllers/user/cartController")
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
        res.redirect('/')
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
router.get('/editProfile',userAuth,profileController.editProfile)
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


module.exports = router