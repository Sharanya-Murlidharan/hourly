const User = require('../../models/userSchema')
const Category = require('../../models/categorySchema')
const Product = require('../../models/productSchema')
const Brand = require('../../models/brandSchema')
const nodemailer = require('nodemailer')
const env = require('dotenv').config()
const bcrypt = require('bcrypt')
const { render } = require('ejs')

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
        console.log('home page not loading',error)
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

const signup = async (req,res) => {
    try {
      
        console.log('Received body:', req.body);
        const {name,phone,email,password,cpassword}= req.body
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
         req.session.otpExpires = Date.now() + 30 * 1000
        req.session.userData = {name, phone,email,password}
        
        console.log('Session data set:', { userOtp: req.session.userOtp, userData: req.session.userData })
        
        return res.render("verify-otp", {
            email: email,
            timer: 10, // Initial timer value in seconds
            message: '' // Optional message
        })
        // console.log('OTP Sent',otp);
        
    } catch (error) {
        console.error("signup error",error)
        res.redirect("/pageNotFound")
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

const verifyOtp = async(req,res)=>{
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

            const saveUserData = new User({
                name:user.name,
                email:user.email,
                phone:user.phone,
                password:passwordHash
            })
            await saveUserData.save()
            req.session.user = saveUserData._id
            res.json({success:true,redirectUrl:"/"})
        }else{
            res.status(400).json({success:false,message:"Invalid OTP,Please try again"})
        }
        
    } catch (error) {
        console.error("Error verifying otp",error)
        res.status(500).json({success:false,message:"An error occured"})
    }
}

const resendOtp = async (req,res)=>{
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
        console.error("Error resending Otp",error);
        res.status(500).json({success:false,message:"Internal Server Error. Please try again"})
        
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
        res.redirect("/pageNotFound")
    }
}

const login = async(req,res)=>{
    try {
        const {email,password} = req.body
        
        console.log("1",email);
        
        const findUser = await User.findOne({isAdmin:false,email:email})
        console.log(findUser);

        
        
            if(!findUser){
                return res.render("login",{message:"User not found"})
            }
            if(findUser.isBlocked){
                return res.render("login",{message:"User is blocked by admin"})
            }
            const passwordMatch = await bcrypt.compare(password,findUser.password)
            console.log(passwordMatch);
            
            if(!passwordMatch){
                return res.render("login",{message:"Incorrect Password"})
            }
            req.session.user = findUser._id
            console.log(req.session.user);
            
            res.redirect( '/')
        
    } catch (error) {
       console.error("login error",error) 
       res.redirect("/pageNotFound")
    }
}

const LoadHomepage = async (req, res) => {
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
        .sort({ createdOn: -1 }) // Sort by newest first
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
        console.error("Home page is not working", error);
        res.status(500).send("Server error");
    }
};


const logout = async(req,res)=>{
    try {
        req.session.destroy((err)=>{
            if(err){
                console.log("Session destruction error",err.message);
                return res.redirect("/pageNotFound")
            }
            return res.redirect("/login")
        })
    } catch (error) {
        console.log("Logout error",error);
        res.redirect("/pageNotFound")
    }
}

const getForgotPassword = async(req,res)=>{
    try {
        res.render('forgot-password')
    } catch (error) {
    res.redirect('/pageNotFound')        
    }
}

const loadShoppingPage = async (req, res) => {
    try {
        const user = req.session.user;
        const userData = await User.findOne({ _id: user });
        const categories = await Category.find({ isListed: true });
        const categoryIds = categories.map((category) => category._id.toString());
        const brands = await Brand.find({}).lean(); // Changed isListed to true (assuming active brands)
        const categoriesWithIds = categories.map(category => ({ _id: category._id, name: category.name }));

        // Base query for products
        let query = {
            isBlocked: false,
            isDeleted: { $ne: true },
            category: { $in: categoryIds },
            quantity: { $gt: 0 }
        };

        // Apply price range filter
        const priceRange = req.query.priceRange;
        if (priceRange) {
            switch (priceRange) {
                case 'under500':
                    query.salePrice = { $lt: 500 };
                    console.log('Price filter: under ₹500');
                    break;
                case '500-1000':
                    query.salePrice = { $gte: 500, $lte: 1000 };
                    console.log('Price filter: ₹500 - ₹1000');
                    break;
                case '1000-1500':
                    query.salePrice = { $gte: 1000, $lte: 1500 };
                    console.log('Price filter: ₹1000 - ₹1500');
                    break;
                case 'above1500':
                    query.salePrice = { $gt: 1500 };
                    console.log('Price filter: above ₹1500');
                    break;
                default:
                    console.log('Invalid price range');
            }
        }

        // Apply sorting
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

        // Pagination
        const page = parseInt(req.query.page) || 1;
        const limit = 2; // Products per page
        const skip = (page - 1) * limit;

        // Fetch products with filters and sorting
        const products = await Product.find(query)
            .sort(sortOptions)
            .skip(skip)
            .limit(limit)
            .lean();

        // Get total count for pagination
        const totalProducts = await Product.countDocuments(query);
        const totalPages = Math.ceil(totalProducts / limit);

        req.session.filteredProducts = products; // Store filtered products

        res.render('shop', {
            user: userData,
            products,
            category: categoriesWithIds,
            brands,
            totalProducts,
            currentPage: page,
            totalPages,
            priceRange: priceRange || '',
            sort: sortOption,
            count: totalProducts
        });
    } catch (error) {
        console.error('Error in loadShoppingPage:', error);
        res.redirect('/pageNotFound');
    }
};


const filterProduct = async (req, res) => {
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
            quantity: { $gt: 0 }
        };

        if (findCategory) {
            query.category = findCategory._id;
        }
        if (findBrand) {
            query.brand = findBrand._id;
        }

        let findProducts = await Product.find(query).lean();

        // Sorting logic
        const sortOption = req.query.sort || 'newest';
        switch (sortOption) {
            case 'price-low':
                findProducts.sort((a, b) => a.salePrice - b.salePrice);
                break;
            case 'price-high':
                findProducts.sort((a, b) => b.salePrice - a.salePrice);
                break;
            case 'a-z':
                findProducts.sort((a, b) => a.productName.localeCompare(b.productName));
                break;
            case 'z-a':
                findProducts.sort((a, b) => b.productName.localeCompare(a.productName));
                break;
            case 'newest':
            default:
                findProducts.sort((a, b) => new Date(b.createdOn) - new Date(a.createdOn));
                break;
        }

        const categories = await Category.find({ isListed: true }).lean();
        let itemsPerPage = 2;
        let currentPage = parseInt(req.query.page) || 1;
        let startIndex = (currentPage - 1) * itemsPerPage;
        let endIndex = startIndex + itemsPerPage;
        let totalPages = Math.ceil(findProducts.length / itemsPerPage);
        let currentProduct = findProducts.slice(startIndex, endIndex);

        let userData = null;
        if (user) {
            userData = await User.findOne({ _id: user });
            if (userData) {
                const searchEntry = {
                    category: findCategory ? findCategory._id : null,
                    brand: findBrand ? findBrand.name : null,
                    searchedOn: new Date()
                };
                userData.searchHistory.push(searchEntry);
                await userData.save();
            }
        }

        req.session.filteredProducts = findProducts; // Store full product list, not just paginated

        res.render("shop", {
            user: userData,
            products: currentProduct,
            category: categories,
            brands: brands,
            totalPages,
            currentPage,
            selectedCategory: category || null,
            selectedBrand: brand || null,
            priceRange: req.query.priceRange || '',
            sort: sortOption,
            count: findProducts.length
        });
    } catch (error) {
        res.redirect("/pageNotFound");
        console.log(error, 'filter error:');
    }
};

const filterByPrice = async (req, res) => {
    try {
        const user = req.session.user;
        const userData = await User.findOne({ _id: user });
        const brands = await Brand.find({}).lean();
        const categories = await Category.find({ isListed: true }).lean();

        // Parse priceRange into gt and lt
        let gt = 0;
        let lt = Infinity;
        const priceRange = req.query.priceRange;
        if (priceRange) {
            if (priceRange === '250000+') {
                gt = 250000;
                lt = Infinity;
            } else {
                const [min, max] = priceRange.split('-').map(Number);
                gt = min || 0;
                lt = max || Infinity;
            }
        }

        let findProducts = await Product.find({
            salePrice: {
                $gt: gt,
                $lt: lt
            },
            isBlocked: false,
            isDeleted: { $ne: true },
            quantity: { $gt: 0 }
        }).lean();

        // Sorting logic
        const sortOption = req.query.sort || 'newest';
        switch (sortOption) {
            case 'price-low':
                findProducts.sort((a, b) => a.salePrice - b.salePrice);
                break;
            case 'price-high':
                findProducts.sort((a, b) => b.salePrice - a.salePrice);
                break;
            case 'a-z':
                findProducts.sort((a, b) => a.productName.localeCompare(b.productName));
                break;
            case 'z-a':
                findProducts.sort((a, b) => b.productName.localeCompare(a.productName));
                break;
            case 'newest':
            default:
                findProducts.sort((a, b) => new Date(b.createdOn) - new Date(a.createdOn));
                break;
        }

        let itemsPerPage = 2;
        let currentPage = parseInt(req.query.page) || 1;
        let startIndex = (currentPage - 1) * itemsPerPage;
        let endIndex = startIndex + itemsPerPage;
        let totalPages = Math.ceil(findProducts.length / itemsPerPage);
        const currentProduct = findProducts.slice(startIndex, endIndex);

        req.session.filteredProducts = findProducts;

        res.render('shop', {
            user: userData,
            products: currentProduct,
            category: categories,
            brands: brands,
            totalPages,
            currentPage,
            priceRange: priceRange || '',
            sort: sortOption,
            count: findProducts.length
        });
    } catch (error) {
        console.log(error);
        res.redirect("/pageNotFound");
    }
};

const searchProducts = async (req, res) => {
    try {
        const user = req.session.user;
        const userData = await User.findOne({ _id: user });
        let search = req.body.query;
        console.log('Search query:', search); // Debug log

        const brands = await Brand.find({}).lean();
        const categories = await Category.find({ isListed: true }).lean();
        const categoryIds = categories.map(category => category._id.toString());
        let searchResult = [];

        if (req.session.filteredProducts && req.session.filteredProducts.length > 0) {
            searchResult = req.session.filteredProducts.filter(product =>
                product.productName.toLowerCase().includes(search.toLowerCase())
            );
        } else {
            searchResult = await Product.find({
                productName: { $regex: ".*" + search + ".*", $options: "i" },
                isBlocked: false,
                isDeleted: { $ne: true },
                quantity: { $gt: 0 },
                category: { $in: categoryIds }
            }).lean();
        }

        // Sorting logic
        const sortOption = req.query.sort || 'newest';
        switch (sortOption) {
            case 'price-low':
                searchResult.sort((a, b) => a.salePrice - b.salePrice);
                break;
            case 'price-high':
                searchResult.sort((a, b) => b.salePrice - a.salePrice);
                break;
            case 'a-z':
                searchResult.sort((a, b) => a.productName.localeCompare(b.productName));
                break;
            case 'z-a':
                searchResult.sort((a, b) => b.productName.localeCompare(a.productName));
                break;
            case 'newest':
            default:
                searchResult.sort((a, b) => new Date(b.createdOn) - new Date(a.createdOn));
                break;
        }

        let itemsPerPage = 2;
        let currentPage = parseInt(req.query.page) || 1;
        let startIndex = (currentPage - 1) * itemsPerPage;
        let endIndex = startIndex + itemsPerPage;
        let totalPages = Math.ceil(searchResult.length / itemsPerPage);
        const currentProduct = searchResult.slice(startIndex, endIndex);

        res.render('shop', {
            user: userData,
            products: currentProduct,
            category: categories,
            brands: brands,
            totalPages,
            currentPage,
            priceRange: req.query.priceRange || '',
            sort: sortOption,
            count: searchResult.length
        });
    } catch (error) {
        console.log('search error:', error);
        res.redirect("/pageNotFound");
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