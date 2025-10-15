const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const Brand = require("../../models/brandSchema");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

// Get Product Listing Page
const getProductListPage = async (req, res, next) => {
    try {
        const categories = await Category.find({ isListed: true });
        const categoryIds = categories.map((category) => category._id.toString());

        // Pagination parameters
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 5;
        const skip = (page - 1) * limit;

        // Search query parameter
        const searchQuery = req.query.search || '';
        const queryConditions = { 
            isDeleted: false,
            category: { $in: categoryIds }
        };

        // Add search filter if searchQuery exists
        if (searchQuery) {
            queryConditions.productName = { $regex: searchQuery, $options: 'i' }; // Case-insensitive search
        }

        // Get total count of products for pagination
        const totalProducts = await Product.countDocuments(queryConditions);

        const products = await Product.find(queryConditions)
            .populate('category')
            .populate('brand')
            .sort({ createdAt: -1 }) // Sort by createdAt in descending order (latest first)
            .skip(skip)
            .limit(limit)
            .lean();

           

        res.render("products", {
            products: products,
            currentPage: page,
            totalPages: Math.ceil(totalProducts / limit),
            totalProducts: totalProducts,
            limit: limit,
            searchQuery: searchQuery,
            // sum

        });
    } catch (error) {
        error.statusCode = 500;
        next(error);
    }
};

// Get Add Product Page
const getProductAddPage = async (req, res, next) => {
    try {
        const category = await Category.find({ isListed: true, isDeleted:false });
        const brand = await Brand.find({ isListed: true, isDeleted:false });
        res.render("addproducts", {
            cat: category,
            brands: brand
        });
    } catch (error) {
         error.statusCode = 500;
        next(error);
    }
};

// Add Product
const addProducts= async (req, res, next) => {
    try {
        const { productName, brand, category, regularPrice, salePrice, quantity, description } = req.body;
        const files = req.files; // Array of uploaded files

        // Validate required fields
        if (!productName || !brand || !category || !regularPrice || !salePrice || !quantity || !description) {
            return res.status(400).json({ success: false, message: 'All fields are required.' });
        }

        if (!files || files.length < 3 || files.length > 4) {
            return res.status(400).json({ success: false, message: 'Please upload between 3 and 4 images.' });
        }

        // Check for existing product with case-insensitive name
        const existingProduct = await Product.findOne({
            productName: { $regex: new RegExp(`^${productName.trim()}$`, "i") },
            isDeleted: false
        });
        if (existingProduct) {
            return res.status(400).json({ success: false, message: 'Product name already exists (case-insensitive).' });
        }

        // Process files (e.g., save paths to database)
        const imagePaths = files.map(file => file.path);

        // Replace with your database logic
        const newProduct = new Product({
            productName,
            brand,
            category,
            regularPrice,
            salePrice,
            quantity,
            description,
            productImage: imagePaths
        });
        await newProduct.save();

        res.status(200).json({ success: true, message: 'Product added successfully!' });
    } catch (error) {
         error.statusCode = 500;
        next(error);
    }
};

const listProduct = async (req, res, next) => {
    try {
        await Product.findByIdAndUpdate(req.params.id, { status: 'Available',isBlocked:false });
        res.redirect('/admin/products');
    } catch (error) {
        error.statusCode = 500;
        next(error);
    }
};

const unlistProduct = async (req, res, next) => {
    try {
        await Product.findByIdAndUpdate(req.params.id, { status: 'out of stock',isBlocked:true });
        res.redirect('/admin/products');
    } catch (error) {
         error.statusCode = 500;
        next(error);
    }
};

const getProductEditPage = async (req, res,next) => {
    try {
        const productId = req.params.id;
        const product = await Product.findOne({
            _id: productId,
            isDeleted: false // Only retrieve non-deleted products
        }).populate('category').populate('brand');
        
        
        if (!product) {
            return res.redirect("/admin/products");
        }
        
        const category = await Category.find({ isListed: true,  isDeleted:false });
        const brand = await Brand.find({ isListed: true, isDeleted:false });
        
        res.render("editproducts", {
            product: product,
            cat: category,
            brands: brand
        });
    } catch (error) {
          error.statusCode = 500;
        next(error);
    }
};

// Update Product
const editProducts = async (req, res,next) => {
    try {
        const productId = req.body.productId;
        const { productName, brand, category, regularPrice, salePrice, quantity, description, imagesToDelete } = req.body;
        const files = req.files;

        console.log('Received fields for edit:', req.body);
        console.log('Received files for edit:', files);

        // Validate required fields
        if (!productId || !productName || !brand || !category || !regularPrice || !salePrice || !quantity || !description) {
            return res.status(400).json({ success: false, message: 'All fields are required.' });
        }

        // Find the product to update
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found.' });
        }

        // Check for existing product with same name (case-insensitive), excluding current product
        const existingProduct = await Product.findOne({
            productName: { $regex: new RegExp(`^${productName.trim()}$`, "i") },
            _id: { $ne: productId },
            isDeleted: false
        });
        if (existingProduct) {
            return res.status(400).json({ success: false, message: 'Product name already exists (case-insensitive).' });
        }

        // Parse imagesToDelete
        let imagesToDeleteArray = [];
        try {
            imagesToDeleteArray = JSON.parse(imagesToDelete || '[]');
        } catch (e) {
            error.statusCode = 500;
            next(error);
        }

        // Remove specified images from product.productImage and filesystem
        if (imagesToDeleteArray.length > 0) {
            product.productImage = product.productImage.filter(img => !imagesToDeleteArray.includes(img));
            imagesToDeleteArray.forEach(imgPath => {
                const fullPath = path.join(__dirname, '../../', imgPath);
                if (fs.existsSync(fullPath)) {
                    try {
                        fs.unlinkSync(fullPath);
                    } catch (unlinkError) {
                        console.error('Error deleting image:', unlinkError);
                    }
                }
            });
        }

        // Update basic fields
        product.productName = productName;
        product.brand = brand;
        product.category = category;
        product.regularPrice = parseFloat(regularPrice);
        product.salePrice = parseFloat(salePrice);
        product.quantity = parseInt(quantity);
        product.description = description;

        // Handle new image uploads
        if (files && files.length > 0) {
            const imagePaths = files.map(file => file.path);
            product.productImage = [...product.productImage, ...imagePaths];
        }

        // Validate image count
        if (product.productImage.length < 1 || product.productImage.length > 4) {
            return res.status(400).json({ success: false, message: 'Product must have between 1 and 4 images.' });
        }

        // Save the updated product
        await product.save();

        res.status(200).json({ success: true, message: 'Product updated successfully!' });
    } catch (error) {
        console.error('Error updating product:', error.stack);
        res.status(500).json({ success: false, message: error.message || 'An error occurred on the server.' });
    }
};

const deleteProduct = async (req, res, next) => {
    const { productId } = req.body;
    try {
      // Validate productId
      if (!productId) {
        return res.status(400).json({ success: false, message: "Product ID is required" });
      }
  
      // Attempt to delete the product
      const product = await Product.findByIdAndUpdate(
        productId,
        { isDeleted: true }, // Set isDeleted to true
        { new: true }
    );
      if (!product) {
        return res.status(404).json({ success: false, message: "Product not found" });
      }
  
      // Optionally delete associated images from the filesystem
      if (product.productImage && product.productImage.length > 0) {
        product.productImage.forEach(imgPath => {
          const fullPath = path.join(__dirname, '../../', imgPath);
          if (fs.existsSync(fullPath)) {
            try {
              fs.unlinkSync(fullPath);
              console.log(`Deleted image: ${fullPath}`);
            } catch (unlinkError) {
              console.error('Error deleting image:', unlinkError);
            }
          } else {
            console.log(`Image not found: ${fullPath}`);
          }
        });
      }
  
      console.log(`Product deleted successfully: ${productId}`);
      res.json({ success: true, message: "Product deleted successfully" });
    } catch (error) {
       error.statusCode = 500;
        next(error);
    }
};

module.exports = {
    getProductListPage,
    getProductAddPage,
    addProducts,
    listProduct,
    unlistProduct,
    getProductEditPage,
    editProducts,
    deleteProduct,
};