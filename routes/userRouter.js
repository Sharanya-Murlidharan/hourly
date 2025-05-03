const express = require('express')
const router = express.Router()
const userController = require('../controllers/user/userController')
const passport = require('../config/passport') 
//const login  = require('../controllers/userController')
const profileController = require("../controllers/user/profileController")
const productController = require("../controllers/user/productController")
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
router.get('/reset-password',profileController.getResetPassPage)
router.post('/resend-forgot-otp',profileController.resendOtp)
router.post('/reset-password',profileController.postNewPassword)

module.exports = router