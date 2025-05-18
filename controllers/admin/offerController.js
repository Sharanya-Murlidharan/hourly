const Offer = require("../../models/offerSchema");
const Product = require("../../models/productSchema");
const Brand = require("../../models/brandSchema");
const Category = require("../../models/categorySchema");
const mongoose = require("mongoose");

const getOffer = async (req, res) => {
   try {
        const searchQuery = req.query.search || '';
        const page = parseInt(req.query.page) || 1;
        const limit = 10;

        const offers = await Offer.find({
            offerName: { $regex: searchQuery, $options: 'i' },
            isDeleted: false
        })
            .populate('applicableItem')
            .skip((page - 1) * limit)
            .limit(limit);

        const totalOffers = await Offer.countDocuments({
            offerName: { $regex: searchQuery, $options: 'i' },
            isDeleted: false
        });

        // Fetch categories (potentially problematic query)
        const categories = await Category.find({ isDeleted: false});
        const products = await Product.find({ isDeleted: false });
        const brands = await Brand.find({ isDeleted: false });

        res.render('offer', {
            offers,
            products,
            categories,
            brands,
            searchQuery,
            currentPage: page,
            totalPages: Math.ceil(totalOffers / limit)
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

const addOffer = async (req, res) => {
    try {
        const { offerName, description, offerType, applicable, applicableItem, offerAmount, validFrom, validUpto, status } = req.body;

        if (['Product', 'Category', 'Brand'].includes(applicable) && !applicableItem) {
            return res.json({ success: false, message: `Applicable ${applicable.toLowerCase()} is required` });
        }
        if (applicable === 'All Products' && applicableItem) {
            return res.json({ success: false, message: 'Applicable item should not be set for All Products' });
        }

        const offer = new Offer({
            offerName,
            description,
            offerType,
            applicable,
            applicableItem: applicableItem || undefined,
            offerAmount: parseFloat(offerAmount),
            validFrom: new Date(validFrom),
            validUpto: new Date(validUpto),
            isListed: status
        });

        await offer.save();
        return res.json({ success: true, message: 'Offer added successfully' });
    } catch (error) {
        console.error('Error in addOffer:', error);
        return res.json({ success: false, message: error.message });
    }
};

const editOffer = async (req, res) => {
    try {
        const { offerId, offerName, description, offerType, applicable, applicableItem, offerAmount, validFrom, validUpto, status } = req.body;

        if (!mongoose.Types.ObjectId.isValid(offerId)) {
            return res.json({ success: false, message: 'Invalid offer ID' });
        }

        if (['Product', 'Category', 'Brand'].includes(applicable) && !applicableItem) {
            return res.json({ success: false, message: `Applicable ${applicable.toLowerCase()} is required` });
        }
        if (applicable === 'All Products' && applicableItem) {
            return res.json({ success: false, message: 'Applicable item should not be set for All Products' });
        }

        const updatedOffer = await Offer.findByIdAndUpdate(
            offerId,
            {
                offerName,
                description,
                offerType,
                applicable,
                applicableItem: applicableItem || undefined,
                offerAmount: parseFloat(offerAmount),
                validFrom: new Date(validFrom),
                validUpto: new Date(validUpto),
                isListed: status
            },
            { new: true, runValidators: true }
        );

        if (!updatedOffer) {
            return res.json({ success: false, message: 'Offer not found' });
        }

        return res.json({ success: true, message: 'Offer updated successfully' });
    } catch (error) {
        console.error('Error in editOffer:', error);
        return res.json({ success: false, message: error.message });
    }
};

const deleteOffer = async (req, res) => {
    try {
        const { offerId } = req.body;

        if (!mongoose.Types.ObjectId.isValid(offerId)) {
            return res.json({ success: false, message: 'Invalid offer ID' });
        }

        const updatedOffer = await Offer.findByIdAndUpdate(
            offerId,
            { isDeleted: true },
            { new: true }
        );

        if (!updatedOffer) {
            return res.json({ success: false, message: 'Offer not found' });
        }

        return res.json({ success: true, message: 'Offer deleted successfully' });
    } catch (error) {
        console.error('Error in deleteOffer:', error);
        return res.json({ success: false, message: error.message });
    }
};

module.exports = { getOffer, addOffer, editOffer, deleteOffer };