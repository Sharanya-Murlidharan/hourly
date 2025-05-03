const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const User = require('../../models/userSchema');

const productDetails = async (req, res) => {
    try {
        // Fetch user data (if logged in)
        const userId = req.session.user;
        const userData = userId ? await User.findById(userId) : null;

        // Fetch product details
        const productId = req.query.id;
        const product = await Product.findOne({
            _id: productId,
            isDeleted: { $ne: true } // Exclude soft-deleted products
        }).populate('category');
        if (!product) {
            return res.redirect("/pageNotFound");
        }

        // Fetch category and calculate offers
        const findCategory = product.category;
        if (!findCategory) {
            return res.redirect("/pageNotFound");
        }
        const categoryOffer = findCategory?.categoryOffer || 0;
        const productOffer = product.productOffer || 0;
        const totalOffer = categoryOffer + productOffer;

        // Pagination for related products
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 4;
        const relatedQuery = {
            category: findCategory._id,
            _id: { $ne: productId }
        };
        const relatedProducts = await Product.find(relatedQuery)
            .limit(limit)
            .skip((page - 1) * limit)
            .exec();
        const totalRelatedProducts = await Product.countDocuments(relatedQuery);

        // Render the view
        res.render("product-details", {
            user: userData,
            product: product,
            totalOffer: totalOffer,
            category: findCategory,
            relatedProducts,
            page,
            limit,
            totalRelatedProducts
        });
    } catch (error) {
        console.error('Error in productDetails:', error.message, error.stack);
        res.status(500).redirect("/pageNotFound");
    }
};

module.exports = {
    productDetails
};