const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const User = require('../../models/userSchema');
const Offer = require("../../models/offerSchema"); // Import the Offer model


// Helper function to calculate the highest discount for a product
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

const productDetails = async (req, res, next) => {
    try {
        const userId = req.session.user;
        const userData = userId ? await User.findById(userId) : null;

        const productId = req.query.id;
        const product = await Product.findOne({
            _id: productId,
            isDeleted: { $ne: true },
        }).populate('category brand');
        if (!product) {
            return res.redirect('/pageNotFound');
        }

        const findCategory = product.category;
        if (!findCategory) {
            return res.redirect('/pageNotFound');
        }

        const currentDate = new Date();
        const discountInfo = await calculateProductDiscount(product, currentDate);
        const discountPercentage = discountInfo.hasDiscount
            ? Math.round(((discountInfo.originalPrice - discountInfo.discountedPrice) / discountInfo.originalPrice) * 100)
            : 0;

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 4;
        const relatedQuery = {
            category: findCategory._id,
            _id: { $ne: productId },
        };
        const relatedProducts = await Product.find(relatedQuery)
            .populate('category brand')
            .limit(limit)
            .skip((page - 1) * limit)
            .lean();

        const relatedProductsWithDiscounts = await Promise.all(
            relatedProducts.map(async relatedProduct => {
                const relatedDiscountInfo = await calculateProductDiscount(relatedProduct, currentDate);
                return {
                    ...relatedProduct,
                    originalPrice: relatedDiscountInfo.originalPrice,
                    discountedPrice: relatedDiscountInfo.discountedPrice,
                    hasDiscount: relatedDiscountInfo.hasDiscount,
                    discountPercentage: relatedDiscountInfo.hasDiscount
                        ? Math.round(((relatedDiscountInfo.originalPrice - relatedDiscountInfo.discountedPrice) / relatedDiscountInfo.originalPrice) * 100)
                        : 0,
                };
            })
        );

        const totalRelatedProducts = await Product.countDocuments(relatedQuery);

        res.render('product-details', {
            user: userData,
            product: {
                ...product.toObject(),
                originalPrice: discountInfo.originalPrice,
                discountedPrice: discountInfo.discountedPrice,
                hasDiscount: discountInfo.hasDiscount,
                discountPercentage,
            },
            category: findCategory,
            relatedProducts: relatedProductsWithDiscounts,
            page,
            limit,
            totalRelatedProducts,
        });
    } catch (error) {
         error.statusCode = 500;
        next(error);
    }
};

module.exports = {
    productDetails,
};