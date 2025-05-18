const Brand = require("../../models/brandSchema")
const Product = require("../../models/productSchema")

const getBrandPage = async(req,res)=>{
    try {
        const page = parseInt(req.query.page) || 1
        const limit = 4
        const skip = (page-1)*limit
        const search = req.query.search || ""

        const brandData = await Brand.find({
            $or:[
                {name:{$regex:new RegExp(search,"i")}},
                {description:{$regex:new RegExp(search,"i")}}
            ]
        })
            .sort({createdOn:-1})
            .skip(skip)
            .limit(limit)
            .exec()

            const totalBrands = await Brand.countDocuments({
                $or:[
                    {name:{$regex: new RegExp(search,"i")}},
                    {description:{$regex:new RegExp(search,"i")}}
                ]
            })

            const totalPages = Math.ceil(totalBrands/limit)
            res.render("brand",{
                brands:brandData,
                currentPage:page,
                totalPages:totalPages,
                totalBrands:totalBrands,
                limit:limit,
                searchQuery:search
            })
    } catch (error) {
        console.error("error in brandInfo",error);
        res.redirect("/pageerror")
    }
}

const addBrand = async (req, res) => {
    const { name, description } = req.body;
    try {
      console.log("Add Brand Request Received:", { name, description });
  
      const existingBrand = await Brand.findOne({ name });
      if (existingBrand) {
        console.log("Brand already exists");
        return res.status(400).json({ error: "Brand already exists" });
      }
  
      const newBrand = new Brand({ name, description });
      await newBrand.save();
  
      console.log("Brand saved successfully");
      return res.json({ message: "Brand added successfully" });
    } catch (error) {
      //console.error("🔥 Error while adding brand:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  };
  
const brandListed = async(req,res)=>{
    try {
        const id = req.query.id
        await Brand.updateOne({_id:id},{$set:{isListed:true}})
        res.redirect("/admin/brands")
    } catch (error) {
        res.redirect("/404-error")
    }
}

const brandunListed = async(req,res)=>{
    try {
        const id = req.query.id
        await Brand.updateOne({_id:id},{$set:{isListed:false}})
        res.redirect("/admin/brands")
    } catch (error) {
        res.redirect("/404-error")
    }
}

const editBrand = async(req,res)=>{
    try {
        const {brandId,name,description}=req.body
        const existingBrand = await Brand.findOne({name,_id:{$ne:brandId}})
        if (existingBrand) {
            return res.json({success:false,message:"Brand already exists,please choose another name"})
        }
        const updateBrand = await Brand.findByIdAndUpdate(
            brandId,
            {name,description},
            {new:true}
        )
        if (!updateBrand) {
            return res.json({success:false,message:"Brand not found"})
        }
        res.json({success:true,message:"Brand updated successfully"})
    } catch (error) {
        console.error("Error in editBrand:",error);
        res.json({success:false,message:"Internal Server Error"})
        
    }
}

const deleteBrand = async(req,res)=>{
    const {brandId} = req.body
    try {
        await Brand.findByIdAndUpdate(
            brandId,
            { isDeleted: true }, // Set isDeleted to true
            { new: true }
        )
        res.json({success:true,message:"Brand deleted successfully"})
    } catch (error) {
        res.status(500).json({success:false,message:"Error deleting brand"})
    }
}

module.exports = {
    getBrandPage,
    addBrand,
    brandListed,
    brandunListed,
    editBrand,
    deleteBrand
}