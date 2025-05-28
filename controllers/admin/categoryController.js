const Category = require("../../models/categorySchema");

const categoryInfo = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 4; // Define limit here
        const skip = (page - 1) * limit;
        const search = req.query.search || ""; // Handle search query

        const categoryData = await Category.find({
           
            $or: [
                { name: { $regex: new RegExp(search, "i") } },
                { description: { $regex: new RegExp(search, "i") } }
            ]
        
    
        })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .exec();

        const totalCategories = await Category.countDocuments({
            $or: [
                { name: { $regex: new RegExp(search, "i") } },
                { description: { $regex: new RegExp(search, "i") } }
            ]
        });

        const totalPages = Math.ceil(totalCategories / limit);

        res.render("category", {
            cat: categoryData, // Match variable name with template
            currentPage: page,
            totalPages: totalPages,
            totalCategories: totalCategories,
            limit: limit, // Pass limit to template
            searchQuery: search // Pass search query for pagination
        });
    } catch (error) {
        error.statusCode = 500;
        next(error);
    }
};

const addCategory = async (req, res, next) => {
  const { name, description } = req.body;
  try {
    const existingCategory = await Category.findOne({ name: { $regex: new RegExp(`^${name}$`, "i") } });
    if (existingCategory) {
      return res.status(400).json({ error: "Category already exists (case-insensitive)" });
    }
    const newCategory = new Category({
      name,
      description,
    });
    await newCategory.save();
    return res.json({ message: "Category added successfully" });
  } catch (error) {
    error.statusCode = 500;
    next(error);
  }
};

const categoryListed = async (req, res, next) => {
    try {
        const id = req.query.id;
        await Category.updateOne({ _id: id }, { $set: { isListed:true } });
        res.redirect("/admin/category");
    } catch (error) {
         error.statusCode = 500;
        next(error);
    }
}; 

const categoryunListed = async (req, res,next) => {
    try {
        const id = req.query.id;
        await Category.updateOne({ _id: id }, { $set: {isListed:false } });
        res.redirect("/admin/category");
    } catch (error) {
        error.statusCode = 500;
        next(error);
    }
};


const editCategory = async (req, res, next) => {
  try {
    const { categoryId, name, description } = req.body;

    const existingCategory = await Category.findOne({
      name: { $regex: new RegExp(`^${name}$`, "i") },
      _id: { $ne: categoryId }
    });
    if (existingCategory) {
      return res.json({ success: false, message: "Category already exists with this name (case-insensitive)" });
    }

    const updatedCategory = await Category.findByIdAndUpdate(
      categoryId,
      { name, description },
      { new: true }
    );
    if (!updatedCategory) {
      return res.json({ success: false, message: "Category not found" });
    }

    res.json({ success: true, message: "Category updated successfully" });
  } catch (error) {
    error.statusCode = 500;
    next(error);
  }
};

const deleteCategory = async (req, res, next) => {
    const { categoryId } = req.body;
    try {
      await Category.findByIdAndUpdate(
        categoryId,
        { isDeleted: true }, // Set isDeleted to true
        { new: true }
    );
    console.log(`Category ${categoryId} updated to isDeleted: true`);
      res.json({ success: true, message: "Category deleted successfully" });
    } catch (error) {
         error.statusCode = 500;
        next(error);
    }
  };
  
  

module.exports = {
    categoryInfo,
    addCategory,
    categoryListed,
    categoryunListed,
    editCategory,
    deleteCategory
};