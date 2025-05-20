const Brand = require("../../models/brandSchema")
const Product = require("../../models/productSchema")

const getBrandPage = async(req,res,next)=>{
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
         error.statusCode = 500;
        next(error);
    }
}

const addBrand = async (req, res, next) => {
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
       error.statusCode = 500;
        next(error);
    }
  };
  
const brandListed = async(req,res,next)=>{
    try {
        const id = req.query.id
        await Brand.updateOne({_id:id},{$set:{isListed:true}})
        res.redirect("/admin/brands")
    } catch (error) {
         error.statusCode = 500;
        next(error);
    }
}

const brandunListed = async(req,res,next)=>{
    try {
        const id = req.query.id
        await Brand.updateOne({_id:id},{$set:{isListed:false}})
        res.redirect("/admin/brands")
    } catch (error) {
        error.statusCode = 500;
        next(error);
    }
}

const editBrand = async(req,res,next)=>{
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
         error.statusCode = 500;
        next(error);
        
    }
}

const deleteBrand = async(req,res,next)=>{
    const {brandId} = req.body
    try {
        await Brand.findByIdAndUpdate(
            brandId,
            { isDeleted: true }, // Set isDeleted to true
            { new: true }
        )
        res.json({success:true,message:"Brand deleted successfully"})
    } catch (error) {
        error.statusCode = 500;
        next(error);
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