const User = require('../../models/userSchema')
const Category = require('../../models/categorySchema')
const Product = require('../../models/productSchema')
const Brand = require('../../models/brandSchema')
const Wishlist = require('../../models/wishlistSchema')
const Wallet = require('../../models/walletSchema')
const Offer = require('../../models/offerSchema')
const nodemailer = require('nodemailer')
const env = require('dotenv').config()
const bcrypt = require('bcrypt')
const { render } = require('ejs')


// Function to generate a random 8-character referral code
const generateReferralCode = async () => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let referralCode = '';
    for (let i = 0; i < 8; i++) {
        referralCode += characters.charAt(Math.floor(Math.random() * characters.length));
    }

    // Check for uniqueness
    let existingUser = await User.findOne({ referralCode });
    while (existingUser) {
        referralCode = '';
        for (let i = 0; i < 8; i++) {
            referralCode += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        existingUser = await User.findOne({ referralCode });
    }

    return referralCode;
};

const pageNotFound = async(req,res)=>{
    try {
        res.render('page-404')
    } catch (error) {
    res.redirect('/pageNotFound')        
    }
}

// const loadHomepage = async(req,res)=>{
//     try {
//         const user = req.session.user
//         console.log(user);
        
//         if (user) {
//             const userData = await User.findOne({user})
//             res.render('home',{user:userData})
//         }else{
//             return res.render('home')
//         }
//     } catch (error) {
//         console.log('Home page not found');
//         res.status(500).send('Server error')
        
//     }
// }

const loadSignup = async(req,res)=>{
    try {
        return res.render('signup')
    } catch (error) {
        console.log('error from loadSignup',error)
        res.status(500).send('Server Error')
    }
}

function generateOtp() {
    return Math.floor(100000 + Math.random()*900000).toString()
    // console.log('1');
    
    //return otp
}
    //console.log('generated otp: ',otp);

async function sendVerificationEmail(email,otp) {
    try {
        // console.log('2');
       // console.log('Attempting to send email to:', email)
        const transporter = nodemailer.createTransport({
            service:'gmail',
            port:587,
            secure:false,
            requireTLS:true,
            auth:{
                user:process.env.NODEMAILER_EMAIL,
                pass:process.env.NODEMAILER_PASSWORD
            }
        })

        const info = await transporter.sendMail({
            from:process.env.NODEMAILER_EMAIL,
            to:email,
            subject:"Verify your account",
            text:`Your otp is ${otp}`,
            html:`<b> Your OTP :${otp}<b>`
        })
        console.log("Email sent: ", info.response)
        return info.accepted.length>0
    } catch (error) {
        console.error("Error sending email",error.message)
        return false
    }
}

const signup = async (req,res,next) => {
    try {
      
        console.log('Received body:', req.body);
        const {name,phone,email,password,cpassword,referralCode}= req.body
        console.log(password);
        
        if(password !== cpassword){
            
            console.log('Password mismatch or empty')
            return res.render("signup",{message:"Password do not match"})
        }

        console.log('Checking user with email:',email);
        
        const findUser = await User.findOne({email})
        if (findUser) {
            console.log('User found:', findUser)
            return res.render("signup",{message:"User with this email already exists"})
        }

        const otp = generateOtp()
       
        console.log('Sending OTP:', otp)
        const emailSent = await sendVerificationEmail(email,otp)
        if(!emailSent){
           
            console.log('Email sending failed')
            return res.render("signup", { message: "Failed to send verification email. Please try again." })
            //return res.json("emai-error")
        }
        req.session.userOtp = otp
         req.session.otpExpires = Date.now() + 60 * 1000
        req.session.userData = {name, phone,email,password,referralCode: referralCode || null}
        
        console.log('Session data set:', { userOtp: req.session.userOtp, userData: req.session.userData })
        
        return res.render("verify-otp", {
            email: email,
            timer: 10, // Initial timer value in seconds
            message: '' // Optional message
        })
        // console.log('OTP Sent',otp);
        
    } catch (error) {
         error.statusCode = 500;
        next(error);
        }
}

const securePassword = async(password)=>{
    try {
       const passwordHash = await bcrypt.hash(password,10)
       return passwordHash 
    } catch (error) {
        console.error('Error hashing password:', error)
        return null
    }
}

const verifyOtp = async(req,res,next)=>{
    try {
        const{otp} = req.body
        console.log(otp);
        req.session.otpExpires = Date.now() + 60*1000;
        if (req.session.otpExpires && Date.now() > req.session.otpExpires) {
            res.status(400).json({success:false,message:"OTP time expired"})
        }
        if(req.session.userOtp && otp===req.session.userOtp){
            const user = req.session.userData
            const passwordHash = await securePassword(user.password)

             // Generate referral code for the new user
            const referralCode = await generateReferralCode();

            const saveUserData = new User({
                name:user.name,
                email:user.email,
                phone:user.phone,
                password:passwordHash,
                referralCode: referralCode, // Assign the referral code
                ProfilePicture:null
            })
            await saveUserData.save()

            // Create a wallet for the new user
            const newUserWallet = new Wallet({
                userId: saveUserData._id,
                balance: 0,
                transactions: []
            })
            await newUserWallet.save()

            // Handle referral logic if a referral code was provided
            if (user.referralCode) {
                // Validate the referral code
                const referrer = await User.findOne({ 
                    referralCode: user.referralCode,
                    isBlocked: false 
                })
                if (!referrer) {
                    console.log('Invalid or non-existent referral code:', user.referralCode)
                    req.session.user = saveUserData._id
                    return res.json({success:true,redirectUrl:"/"}) // Proceed without referral rewards
                }

                // Prevent users from using their own referral code
                if (referrer.email === user.email) {
                    console.log('User cannot use their own referral code')
                    req.session.user = saveUserData._id
                    return res.json({success:true,redirectUrl:"/"}) // Proceed without referral rewards
                }

                // Reward the new user: 500 in wallet
                newUserWallet.balance += 500
                newUserWallet.transactions.push({
                    amount: 500,
                    type: 'credit',
                    description: `Referral bonus for signing up with code ${user.referralCode}`,
                    date: new Date()
                })
                await newUserWallet.save()

                // Reward the existing user (referrer): 1000 in wallet
                let referrerWallet = await Wallet.findOne({ userId: referrer._id })
                if (!referrerWallet) {
                    referrerWallet = new Wallet({
                        userId: referrer._id,
                        balance: 0,
                        transactions: []
                    })
                }
                referrerWallet.balance += 1000
                referrerWallet.transactions.push({
                    amount: 1000,
                    type: 'credit',
                    description: `Referral reward for inviting user ${user.name}`,
                    date: new Date()
                })
                await referrerWallet.save()

                // Update referrer's redeemedUsers and redeemed status
                referrer.redeemedUsers.push(saveUserData._id)
                referrer.redeemed = true
                await referrer.save()

                // Update new user's redeemed status
                saveUserData.redeemed = true
                await saveUserData.save()
            }

            req.session.user = saveUserData._id
            res.json({success:true,redirectUrl:"/"})
        }else{
            res.status(400).json({success:false,message:"Invalid OTP,Please try again"})
        }
        
    } catch (error) {
        error.statusCode = 500;
        next(error);
    }
}

const resendOtp = async (req,res,next)=>{
    try {
        console.log('Session data:', req.session.userData)
        const {email} = req.session.userData
        if(!email){
            return res.status(400).json({success:false,message:"Email not found in session"})
        }
        const otp = generateOtp()
        req.session.userOtp = otp
        console.log('OTP:', otp)
        req.session.otpExpires = Date.now() + 30 * 1000;
        const emailSent = await sendVerificationEmail(email,otp)
        console.log(emailSent);
        

        if(emailSent){
            console.log("Resend Otp:",otp);
            res.status(200).json({success:true,message:"OTP Resend Successfully"})
        }else{
            res.status(500).json({success:false,message:"Failed to resend OTP. Please try again"})
        }
    } catch (error) {
         error.statusCode = 500;
        next(error);
        
    }
}

const loadLogin = async (req,res)=>{
    try {
    if(!req.session.user){
        return res.render("login")
    }else{
        res.redirect("/")
    }
    } catch (error) {
        console.error("error from loadLogin",error);  
        res.redirect("/pageNotFound")
    }
}

const login = async(req,res, next)=>{
    try {
        const {email,password} = req.body
        
        console.log("1",email);
        
        const findUser = await User.findOne({isAdmin:false,email:email})
        console.log(findUser);

        
        
            if(!findUser){
                return res.json({success:false,message:"User not found"})
            }
            if(findUser.isBlocked){
                return res.json({success:false,message:"User is blocked by admin"})
            }
            const passwordMatch = await bcrypt.compare(password,findUser.password)
            console.log(passwordMatch);
            
            if(!passwordMatch){
                return res.json({success:false,message:"Incorrect Password"})
            }
            req.session.user = findUser._id
            console.log(req.session.user);
            
            res.json({success:true,redirectUrl:"/"})
        
    } catch (error) {
        error.statusCode = 500;
        next(error);
    }
}

const LoadHomepage = async (req, res, next) => {
    try {
        let userData = null;

        // Get listed categories
        const categories = await Category.find({ isListed: true });

        // Get non-blocked products in those categories with quantity > 0
        let productData = await Product.find({
            isBlocked: false,
            isDeleted: { $ne: true },
            category: { $in: categories.map(c => c._id) },
            quantity: { $gt: 0 }
        })
        .sort({ createdAt: -1 }) // Sort by newest first
        .limit(4);

        // Sort by newest and limit to 4
        productData.sort((a, b) => new Date(b.createdOn) - new Date(a.createdOn));
        productData = productData.slice(0, 4);

        // Check session or req.user
        if (req.session.user) {
            userData = await User.findById(req.session.user);
        } else if (req.user) {
            userData = req.user;
        }

        // Render homepage with products and optional user
        res.render("home", {
            user: userData,
            products: productData
        });

    } catch (error) {
        error.statusCode = 500;
        next(error);
    }
};


const logout = async(req,res, next)=>{
    try {
        req.session.user = null
        return res.redirect("/login")
    } catch (error) {
         error.statusCode = 500;
        next(error);
    }
}

const getForgotPassword = async(req,res)=>{
    try {
        res.render('forgot-password')
    } catch (error) {
        console.error("error from getForgotPassword",error);
        
    res.redirect('/pageNotFound')        
    }
}

const calculateProductDiscount = async (product, currentDate) => {
    try {
        const productId = product._id;
        const categoryId = product.category?._id || product.category;
        const brandId = product.brand?._id || product.brand;

        const offers = await Offer.find({
            isListed: true,
            isDeleted: false,
            validFrom: { $lte: currentDate },
            validUpto: { $gte: currentDate },
            $or: [
                { applicable: 'Product', applicableItem: productId },
                { applicable: 'Category', applicableItem: categoryId },
                { applicable: 'Brand', applicableItem: brandId },
            ],
        }).lean();

        let bestDiscount = {
            originalPrice: product.salePrice || product.regularPrice,
            discountedPrice: product.salePrice || product.regularPrice,
            hasDiscount: false,
        };

        if (offers.length > 0) {
            let maxSavings = 0;

            offers.forEach((offer) => {
                let currentPrice = product.salePrice || product.regularPrice;
                let discountPrice = currentPrice;

                if (offer.offerType === 'Percentage') {
                    const discount = (currentPrice * offer.offerAmount) / 100;
                    discountPrice = currentPrice - discount;
                } else if (offer.discountType === 'flat') {
                    discountPrice = currentPrice - offer.offerAmount;
                }

                discountPrice = Math.max(0, discountPrice);

                const savings = currentPrice - discountPrice;
                if (savings > maxSavings) {
                    maxSavings = savings;
                    bestDiscount = {
                        originalPrice: currentPrice,
                        discountedPrice: Math.round(discountPrice),
                        hasDiscount: true,
                    };
                }
            });
        }

        return bestDiscount;
    } catch (error) {
        console.error('Error in calculateProductDiscount:', error);
        return {
            originalPrice: product.salePrice || product.regularPrice,
            discountedPrice: product.salePrice || product.regularPrice,
            hasDiscount: false,
        };
    }
};

const loadShoppingPage = async (req, res, next) => {
    try {
        const user = req.session.user;
        const userData = user ? await User.findOne({ _id: user }) : null;
        let wishlistProductIds = [];
        if (user) {
            const wishlist = await Wishlist.findOne({ userId: user }).lean();
            if (wishlist && wishlist.products) {
                wishlistProductIds = wishlist.products.map(item => item.productId.toString());
            }
        }
        const categories = await Category.find({ isListed: true,isDeleted: false });
        const categoryIds = categories.map(category => category._id.toString());
        const brands = await Brand.find({ isListed: true,isDeleted: false}).lean();
        const brandIds = brands.map(brand => brand._id.toString())
        const categoriesWithIds = categories.map(category => ({ _id: category._id, name: category.name }));

        let query = {
            isBlocked: false,
            isDeleted: { $ne: true },
            category: { $in: categoryIds },
            brand : {$in: brandIds}
        };

        const priceRange = req.query.priceRange;
        if (priceRange) {
            switch (priceRange) {
                case 'under500':
                    query.salePrice = { $lt: 500 };
                    break;
                case '500-1000':
                    query.salePrice = { $gte: 500, $lte: 1000 };
                    break;
                case '1000-1500':
                    query.salePrice = { $gte: 1000, $lte: 1500 };
                    break;
                case 'above1500':
                    query.salePrice = { $gt: 1500 };
                    break;
            }
        }

        const sortOption = req.query.sort || 'newest';
        let sortOptions = {};
        switch (sortOption) {
            case 'price-low':
                sortOptions.salePrice = 1;
                break;
            case 'price-high':
                sortOptions.salePrice = -1;
                break;
            case 'a-z':
                sortOptions.productName = 1;
                break;
            case 'z-a':
                sortOptions.productName = -1;
                break;
            case 'newest':
            default:
                sortOptions.createdAt = -1;
                break;
        }

        const page = parseInt(req.query.page) || 1;
        const limit = 8;
        const skip = (page - 1) * limit;

        const products = await Product.find(query)
            .populate('category brand')
            .sort(sortOptions)
            .skip(skip)
            .limit(limit)
            .lean();

        const currentDate = new Date();
        const productsWithDiscounts = await Promise.all(
            products.map(async product => {
                const discountInfo = await calculateProductDiscount(product, currentDate);
                return {
                    ...product,
                    originalPrice: discountInfo.originalPrice,
                    discountedPrice: discountInfo.discountedPrice,
                    hasDiscount: discountInfo.hasDiscount,
                    discountPercentage: discountInfo.hasDiscount
                        ? Math.round(((discountInfo.originalPrice - discountInfo.discountedPrice) / discountInfo.originalPrice) * 100)
                        : 0,
                };
            })
        );

        const totalProducts = await Product.countDocuments(query);
        const totalPages = Math.ceil(totalProducts / limit);

        req.session.filteredProducts = productsWithDiscounts;

        console.log(productsWithDiscounts)

        res.render('shop', {
            user: userData,
            products: productsWithDiscounts,
            category: categoriesWithIds,
            brands,
            totalProducts,
            currentPage: page,
            totalPages,
            priceRange: priceRange || '',
            sort: sortOption,
            count: totalProducts,
            wishlistProductIds,
        });
    } catch (error) {
         error.statusCode = 500;
        next(error);
    }
};

const filterProduct = async (req, res, next) => {
    try {
        const user = req.session.user;
        const category = req.query.category;
        const brand = req.query.brands;

        const findCategory = category ? await Category.findOne({ _id: category }) : null;
        const findBrand = brand ? await Brand.findOne({ _id: brand }) : null;
        const brands = await Brand.find({}).lean();
        const query = {
            isBlocked: false,
            isDeleted: { $ne: true },
            quantity: { $gt: 0 },
        };

        if (findCategory) query.category = findCategory._id;
        if (findBrand) query.brand = findBrand._id;

        let findProducts = await Product.find(query)
            .populate('category brand')
            .lean();

        const currentDate = new Date();
        findProducts = await Promise.all(
            findProducts.map(async product => {
                const discountInfo = await calculateProductDiscount(product, currentDate);
                return {
                    ...product,
                    originalPrice: discountInfo.originalPrice,
                    discountedPrice: discountInfo.discountedPrice,
                    hasDiscount: discountInfo.hasDiscount,
                    discountPercentage: discountInfo.hasDiscount
                        ? Math.round(((discountInfo.originalPrice - discountInfo.discountedPrice) / discountInfo.originalPrice) * 100)
                        : 0,
                };
            })
        );

        const sortOption = req.query.sort || 'newest';
        switch (sortOption) {
            case 'price-low':
                findProducts.sort((a, b) => a.discountedPrice - b.discountedPrice);
                break;
            case 'price-high':
                findProducts.sort((a, b) => b.discountedPrice - a.discountedPrice);
                break;
            case 'a-z':
                findProducts.sort((a, b) => a.productName.localeCompare(b.productName));
                break;
            case 'z-a':
                findProducts.sort((a, b) => b.productName.localeCompare(b.productName));
                break;
            case 'newest':
            default:
                findProducts.sort((a, b) => new Date(b.createdOn) - new Date(a.createdOn));
                break;
        }

        const categories = await Category.find({ isListed: true }).lean();
        let itemsPerPage = 8;
        let currentPage = parseInt(req.query.page) || 1;
        let startIndex = (currentPage - 1) * itemsPerPage;
        let endIndex = startIndex + itemsPerPage;
        let totalPages = Math.ceil(findProducts.length / itemsPerPage);
        let currentProduct = findProducts.slice(startIndex, endIndex);

        let userData = null;
        let wishlistProductIds = [];
        if (user) {
            userData = await User.findOne({ _id: user });
            const wishlist = await Wishlist.findOne({ userId: user }).lean();
            if (wishlist && wishlist.products) {
                wishlistProductIds = wishlist.products.map(item => item.productId.toString());
            }
            if (userData) {
                const searchEntry = {
                    category: findCategory ? findCategory._id : null,
                    brand: findBrand ? findBrand.name : null,
                    searchedOn: new Date(),
                };
                userData.searchHistory.push(searchEntry);
                await userData.save();
            }
        }

        req.session.filteredProducts = findProducts;

        res.render('shop', {
            user: userData,
            products: currentProduct,
            category: categories,
            brands,
            totalPages,
            currentPage,
            selectedCategory: category || null,
            selectedBrand: brand || null,
            priceRange: req.query.priceRange || '',
            sort: sortOption,
            count: findProducts.length,
            wishlistProductIds,
        });
    } catch (error) {
         error.statusCode = 500;
        next(error);
    }
};

const filterByPrice = async (req, res, next) => {
    try {
        const user = req.session.user;
        const userData = user ? await User.findOne({ _id: user }) : null;
        let wishlistProductIds = [];
        if (user) {
            const wishlist = await Wishlist.findOne({ userId: user }).lean();
            if (wishlist && wishlist.products) {
                wishlistProductIds = wishlist.products.map(item => item.productId.toString());
            }
        }
        const categories = await Category.find({ isListed: true });
        const categoryIds = categories.map(category => category._id.toString());
        const brands = await Brand.find({}).lean();
        const categoriesWithIds = categories.map(category => ({ _id: category._id, name: category.name }));

        let query = {
            isBlocked: false,
            isDeleted: { $ne: true },
            category: { $in: categoryIds },
        };

        const priceRange = req.query.priceRange;
        if (priceRange) {
            switch (priceRange) {
                case 'under500':
                    query.salePrice = { $lt: 500 };
                    break;
                case '500-1000':
                    query.salePrice = { $gte: 500, $lte: 1000 };
                    break;
                case '1000-1500':
                    query.salePrice = { $gte: 1000, $lte: 1500 };
                    break;
                case 'above1500':
                    query.salePrice = { $gt: 1500 };
                    break;
            }
        }

        const sortOption = req.query.sort || 'newest';
        let sortOptions = {};
        switch (sortOption) {
            case 'price-low':
                sortOptions.salePrice = 1;
                break;
            case 'price-high':
                sortOptions.salePrice = -1;
                break;
            case 'a-z':
                sortOptions.productName = 1;
                break;
            case 'z-a':
                sortOptions.productName = -1;
                break;
            case 'newest':
            default:
                sortOptions.createdOn = -1;
                break;
        }

        const page = parseInt(req.query.page) || 1;
        const limit = 8;
        const skip = (page - 1) * limit;

        let findProducts = await Product.find(query)
            .populate('category brand')
            .sort(sortOptions)
            .skip(skip)
            .limit(limit)
            .lean();

        const currentDate = new Date();
        findProducts = await Promise.all(
            findProducts.map(async product => {
                const discountInfo = await calculateProductDiscount(product, currentDate);
                return {
                    ...product,
                    originalPrice: discountInfo.originalPrice,
                    discountedPrice: discountInfo.discountedPrice,
                    hasDiscount: discountInfo.hasDiscount,
                    discountPercentage: discountInfo.hasDiscount
                        ? Math.round(((discountInfo.originalPrice - discountInfo.discountedPrice) / discountInfo.originalPrice) * 100)
                        : 0,
                };
            })
        );

        const totalProducts = await Product.countDocuments(query);
        const totalPages = Math.ceil(totalProducts / limit);

        req.session.filteredProducts = findProducts;

        res.render('shop', {
            user: userData,
            products: findProducts,
            category: categoriesWithIds,
            brands,
            totalProducts,
            currentPage: page,
            totalPages,
            priceRange: priceRange || '',
            sort: sortOption,
            count: totalProducts,
            wishlistProductIds,
        });
    } catch (error) {
         error.statusCode = 500;
        next(error);
    }
};

// const searchProducts = async (req, res,next) => {
//     try {
//         const user = req.session.user;
//         const userData = user ? await User.findOne({ _id: user }) : null;
//         let wishlistProductIds = [];
//         if (user) {
//             const wishlist = await Wishlist.findOne({ userId: user }).lean();
//             if (wishlist && wishlist.products) {
//                 wishlistProductIds = wishlist.products.map(item => item.productId.toString());
//             }
//         }
//         const categories = await Category.find({ isListed: true });
//         const brands = await Brand.find({}).lean();
//         const categoriesWithIds = categories.map(category => ({ _id: category._id, name: category.name }));

//         const searchQuery = req.query.q || '';
//         let query = {
//             isBlocked: false,
//             isDeleted: { $ne: true },
//             productName: { $regex: searchQuery, $options: 'i' },
//         };

//         const priceRange = req.query.priceRange;
//         if (priceRange) {
//             switch (priceRange) {
//                 case 'under500':
//                     query.salePrice = { $lt: 500 };
//                     break;
//                 case '500-1000':
//                     query.salePrice = { $gte: 500, $lte: 1000 };
//                     break;
//                 case '1000-1500':
//                     query.salePrice = { $gte: 1000, $lte: 1500 };
//                     break;
//                 case 'above1500':
//                     query.salePrice = { $gt: 1500 };
//                     break;
//             }
//         }

//         const sortOption = req.query.sort || 'newest';
//         let sortOptions = {};
//         switch (sortOption) {
//             case 'price-low':
//                 sortOptions.salePrice = 1;
//                 break;
//             case 'price-high':
//                 sortOptions.salePrice = -1;
//                 break;
//             case 'a-z':
//                 sortOptions.productName = 1;
//                 break;
//             case 'z-a':
//                 sortOptions.productName = -1;
//                 break;
//             case 'newest':
//             default:
//                 sortOptions.createdOn = -1;
//                 break;
//         }

//         const page = parseInt(req.query.page) || 1;
//         const limit = 8;
//         const skip = (page - 1) * limit;

//         let findProducts = await Product.find(query)
//             .populate('category brand')
//             .sort(sortOptions)
//             .skip(skip)
//             .limit(limit)
//             .lean();

//         const currentDate = new Date();
//         findProducts = await Promise.all(
//             findProducts.map(async product => {
//                 const discountInfo = await calculateProductDiscount(product, currentDate);
//                 return {
//                     ...product,
//                     originalPrice: discountInfo.originalPrice,
//                     discountedPrice: discountInfo.discountedPrice,
//                     hasDiscount: discountInfo.hasDiscount,
//                     discountPercentage: discountInfo.hasDiscount
//                         ? Math.round(((discountInfo.originalPrice - discountInfo.discountedPrice) / discountInfo.originalPrice) * 100)
//                         : 0,
//                 };
//             })
//         );

//         const totalProducts = await Product.countDocuments(query);
//         const totalPages = Math.ceil(totalProducts / limit);

//         req.session.filteredProducts = findProducts;

//         res.render('shop', {
//             user: userData,
//             products: findProducts,
//             category: categoriesWithIds,
//             brands,
//             totalProducts,
//             currentPage: page,
//             totalPages,
//             priceRange: priceRange || '',
//             sort: sortOption,
//             count: totalProducts,
//             wishlistProductIds,
//             searchQuery,
//         });
//     } catch (error) {
//         error.statusCode = 500;
//         next(error);
//     }
// };

const searchProducts = async (req, res, next) => {
    try {
        const user = req.session.user;
        const userData = user ? await User.findOne({ _id: user }) : null;
        let wishlistProductIds = [];
        if (user) {
            const wishlist = await Wishlist.findOne({ userId: user }).lean();
            if (wishlist && wishlist.products) {
                wishlistProductIds = wishlist.products.map(item => item.productId.toString());
            }
        }
        const categories = await Category.find({ isListed: true });
        const brands = await Brand.find({}).lean();
        const categoriesWithIds = categories.map(category => ({ _id: category._id, name: category.name }));

        const searchQuery = req.body.query || ''; // Use req.body.query from POST form
        if (!searchQuery.trim()) {
            return res.redirect('/shop'); // Redirect if query is empty
        }

        let query = {
            isBlocked: false,
            isDeleted: { $ne: true },
            productName: { $regex: searchQuery, $options: 'i' },
        };

        const priceRange = req.query.priceRange; // Keep query params for filters
        if (priceRange) {
            switch (priceRange) {
                case 'under500':
                    query.salePrice = { $lt: 500 };
                    break;
                case '500-1000':
                    query.salePrice = { $gte: 500, $lte: 1000 };
                    break;
                case '1000-1500':
                    query.salePrice = { $gte: 1000, $lte: 1500 };
                    break;
                case 'above1500':
                    query.salePrice = { $gt: 1500 };
                    break;
            }
        }

        const sortOption = req.query.sort || 'newest';
        let sortOptions = {};
        switch (sortOption) {
            case 'price-low':
                sortOptions.salePrice = 1;
                break;
            case 'price-high':
                sortOptions.salePrice = -1;
                break;
            case 'a-z':
                sortOptions.productName = 1;
                break;
            case 'z-a':
                sortOptions.productName = -1;
                break;
            case 'newest':
            default:
                sortOptions.createdOn = -1;
                break;
        }

        const page = parseInt(req.query.page) || 1;
        const limit = 8;
        const skip = (page - 1) * limit;

        let findProducts = await Product.find(query)
            .populate('category brand')
            .sort(sortOptions)
            .skip(skip)
            .limit(limit)
            .lean();

        const currentDate = new Date();
        findProducts = await Promise.all(
            findProducts.map(async product => {
                const discountInfo = await calculateProductDiscount(product, currentDate);
                return {
                    ...product,
                    originalPrice: discountInfo.originalPrice,
                    discountedPrice: discountInfo.discountedPrice,
                    hasDiscount: discountInfo.hasDiscount,
                    discountPercentage: discountInfo.hasDiscount
                        ? Math.round(((discountInfo.originalPrice - discountInfo.discountedPrice) / discountInfo.originalPrice) * 100)
                        : 0,
                };
            })
        );

        const totalProducts = await Product.countDocuments(query);
        const totalPages = Math.ceil(totalProducts / limit);

        req.session.filteredProducts = findProducts;

        res.render('shop', {
            user: userData,
            products: findProducts,
            category: categoriesWithIds,
            brands,
            totalProducts,
            currentPage: page,
            totalPages,
            priceRange: priceRange || '',
            sort: sortOption,
            count: totalProducts,
            wishlistProductIds,
            query: searchQuery, // Pass query to repopulate input
        });
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).render('page-404', { message: 'Error performing search' });
    }
};


module.exports = {
    LoadHomepage,
    pageNotFound,
    loadSignup,
    signup,
    verifyOtp,
    resendOtp,
    loadLogin,
    login,
    logout,
    getForgotPassword,
    loadShoppingPage,
    filterProduct,
    filterByPrice,
    searchProducts
}