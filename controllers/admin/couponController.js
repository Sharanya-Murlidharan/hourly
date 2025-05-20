const Coupon = require('../../models/couponSchema');

const getCoupon = async (req, res, next) => {
    try {
        const searchTerm = req.query.search || ''; // Get search term from query parameter
        const page = parseInt(req.query.page) || 1; // Get page number from query parameter, default to 1
        const limit = 10; // Number of coupons per page (adjust as needed)
        const skip = (page - 1) * limit; // Calculate how many documents to skip

        // Build the query
        let query = { isDeleted: false };
        if (searchTerm) {
            query.$or = [
                { name: { $regex: searchTerm, $options: 'i' } }, // Case-insensitive search on name
                { code: { $regex: searchTerm, $options: 'i' } }  // Case-insensitive search on code
            ];
        }

        // Get the total number of matching coupons (for pagination)
        const totalCoupons = await Coupon.countDocuments(query);
        const totalPages = Math.ceil(totalCoupons / limit); // Calculate total pages

        // Fetch the coupons for the current page
        const coupons = await Coupon.find(query)
            .sort({ createdAt: -1 }) // Sort by creation date (newest first)
            .skip(skip) // Skip documents for pagination
            .limit(limit); // Limit the number of documents per page

        console.log(`Fetched coupons (Page ${page}, Total: ${totalCoupons}):`, coupons); // Debug log

        // Render the template with pagination data
        res.render('coupon', {
            coupons,
            searchTerm,
            currentPage: page,
            totalPages,
            searchQuery: searchTerm // Pass search term for pagination links
        });
    } catch (error) {
        error.statusCode = 500;
        next(error);
    }
};

const addCoupon = async (req, res, next) => {
    try {
        const { name, description, code, minCartValue, amount, validFrom, validUpto } = req.body;

        if (!name || !code || !minCartValue || !amount || !validFrom || !validUpto) {
            console.log('Validation failed: Missing required fields', { body: req.body });
            return res.status(400).json({ success: false, error: 'Name, code, min cart value, amount, valid from, and valid upto are required' });
        }
        if (description && description.length > 200) {
            console.log('Validation failed: Description too long', { description });
            return res.status(400).json({ success: false, error: 'Description must be 200 characters or less' });
        }
        const minCartValueNum = parseFloat(minCartValue);
        const amountNum = parseFloat(amount);
        if (isNaN(minCartValueNum) || isNaN(amountNum)) {
            console.log('Validation failed: Invalid number format', { minCartValue, amount });
            return res.status(400).json({ success: false, error: 'Invalid number format for minCartValue or amount' });
        }
        if (minCartValueNum < 0) {
            console.log('Validation failed: Negative minCartValue', { minCartValueNum });
            return res.status(400).json({ success: false, error: 'Minimum cart value cannot be negative' });
        }
        if (amountNum <= 0) {
            console.log('Validation failed: Invalid amount', { amountNum });
            return res.status(400).json({ success: false, error: 'Amount must be greater than 0' });
        }
        const existingCoupon = await Coupon.findOne({ $or: [{ code, isDeleted: false }, { name, isDeleted: false }] });
        if (existingCoupon) {
            if (existingCoupon.code === code) {
                console.log('Validation failed: Coupon code exists', { code });
                return res.status(400).json({ success: false, error: 'Coupon code already exists' });
            }
            if (existingCoupon.name === name) {
                console.log('Validation failed: Coupon name exists', { name });
                return res.status(400).json({ success: false, error: 'Coupon name already exists' });
            }
        }
        const newCoupon = new Coupon({
           
            name: name.trim(),
            description: description ? description.trim() : '',
            code: code.trim(),
            minCartValue: minCartValueNum,
            amount: amountNum,
            validFrom,
            validUpto,
            isDeleted: false
        });
        console.log('Saving coupon:', newCoupon); // Debug log
        await newCoupon.save();
        console.log('Coupon saved successfully'); // Debug log
        res.json({ success: true, message: 'Coupon added successfully' });
    } catch (error) {
        error.statusCode = 500;
        next(error);
    }
};

const editCoupon = async (req, res,next) => {
    try {
        const { couponId, name, description, code, minCartValue, amount, validFrom, validUpto } = req.body;
        console.log('Received data:', req.body); // Debug log

        if (!couponId || !name || !code || !minCartValue || !amount || !validFrom || !validUpto) {
            return res.status(400).json({ success: false, error: 'All fields are required' });
        }
        if (description && description.length > 200) {
            return res.status(400).json({ success: false, error: 'Description must be 200 characters or less' });
        }
        const minCartValueNum = parseFloat(minCartValue);
        const amountNum = parseFloat(amount);
        if (isNaN(minCartValueNum) || isNaN(amountNum)) {
            return res.status(400).json({ success: false, error: 'Invalid number format for minCartValue or amount' });
        }
        if (minCartValueNum < 0) {
            return res.status(400).json({ success: false, error: 'Minimum cart value cannot be negative' });
        }
        if (amountNum <= 0) {
            return res.status(400).json({ success: false, error: 'Amount must be greater than 0' });
        }
        const existingCoupon = await Coupon.findOne({
            $or: [{ code, isDeleted: false }, { name, isDeleted: false }],
            _id: { $ne: couponId }
        });
        if (existingCoupon) {
            if (existingCoupon.code === code) {
                return res.status(400).json({ success: false, error: 'Coupon code already exists' });
            }
            if (existingCoupon.name === name) {
                return res.status(400).json({ success: false, error: 'Coupon name already exists' });
            }
        }
        const updatedCoupon = await Coupon.findByIdAndUpdate(
            couponId,
            {
                name,
                description: description || '',
                code,
                minCartValue: minCartValueNum,
                amount: amountNum,
                validFrom: new Date(validFrom),
                validUpto: new Date(validUpto)
            },
            { new: true }
        );
        if (!updatedCoupon) {
            return res.status(404).json({ success: false, error: 'Coupon not found' });
        }
        res.json({ success: true, message: 'Coupon updated successfully' });
    } catch (error) {
        error.statusCode = 500;
        next(error);
    }
};

const deleteCoupon = async (req, res, next) => {
    try {
        const { couponId } = req.body;
        console.log('Received data:', req.body); // Debug log

        if (!couponId) {
            return res.status(400).json({ success: false, error: 'Coupon ID is required' });
        }
        const coupon = await Coupon.findByIdAndUpdate(
            couponId,
            { isDeleted: true },
            { new: true }
        );
        if (!coupon) {
            return res.status(404).json({ success: false, error: 'Coupon not found' });
        }
        res.json({ success: true, message: 'Coupon deleted successfully' });
    } catch (error) {
         error.statusCode = 500;
        next(error);
    }
};

module.exports = {
    getCoupon,
    addCoupon,
    editCoupon,
    deleteCoupon
};