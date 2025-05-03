const Category = require("../../models/categorySchema");

const categoryInfo = async (req, res) => {
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
        console.error("Error in categoryInfo:", error);
        res.redirect("/pageerror");
    }
};

const addCategory = async (req, res) => {
    const { name, description } = req.body;
    try {
        const existingCategory = await Category.findOne({ name });
        if (existingCategory) {
            return res.status(400).json({ error: "Category already exists" });
        }
        const newcategory = new Category({
            name,
            description,
        });
        await newcategory.save(); // Fixed typo: newcategory instead of newCategory
        return res.json({ message: "Category added successfully" });
    } catch (error) {
        return res.status(500).json({ error: "Internal Server Error" });
    }
};

const categoryListed = async (req, res) => {
    try {
        const id = req.query.id;
        await Category.updateOne({ _id: id }, { $set: { isListed:true } });
        res.redirect("/admin/category");
    } catch (error) {
        res.redirect("/404-error");
    }
}; 

const categoryunListed = async (req, res) => {
    try {
        const id = req.query.id;
        await Category.updateOne({ _id: id }, { $set: {isListed:false } });
        res.redirect("/admin/category");
    } catch (error) {
        res.redirect("/404-error");
    }
};


const editCategory = async (req, res) => {
  try {
    const { categoryId, name, description } = req.body;

    
    const existingCategory = await Category.findOne({ name, _id: { $ne: categoryId } });
    if (existingCategory) {
      return res.json({ success:false, message: "Category exists, please choose another name" });
    }

    
    const updatedCategory = await Category.findByIdAndUpdate(
      categoryId,
      { name, description },
      { new: true }
    );
    if (!updatedCategory) {
      return res.json({ success:false, message: "Category not found" });
    }

    res.json({ success:true, message: "Category updated successfully" });
    
  } catch (error) {
    console.error("Error in editCategory:", error);
    res.json({ success:false, message: "Internal Server Error" });
  }
};

const deleteCategory = async (req, res) => {
    const { categoryId } = req.body;
    try {
      await Category.findByIdAndDelete(
        categoryId,
        { isDeleted: true }, // Set isDeleted to true
        { new: true }
    );
    console.log(`Category ${categoryId} updated to isDeleted: true`);
      res.json({ success: true, message: "Category deleted successfully" });
    } catch (error) {
        console.error('Error deleting category:', error.message, error.stack);
      res.status(500).json({ success: false, message: "Error deleting category" });
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