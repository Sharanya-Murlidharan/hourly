const User = require("../../models/userSchema")

const customerInfo = async (req,res,next)=>{
    try {
       let search = ""
       if(req.query.search){
            search=req.query.search
       } 
       let page=1
       if(req.query.page){
        page=req.query.page
       }
       const limit = 4
       const userData = await User.find({
        isAdmin:false,
        $or:[
            {name:{$regex:".*"+search+"."}},
            {email:{$regex:".*"+search+"."}}
        ]
       })
       .sort({ createdOn: -1 })
       .limit(limit*1)
       .skip((page-1)*limit)
       .exec()

       const count = await User.find({
        isAdmin:false,
        $or:[
            {name:{$regex:".*"+search+"."}},
            {email:{$regex:".*"+search+"."}}
        ]
       }).countDocuments()
       res.render('customers', {
        users: userData,
        currentPage: page,
        totalPages: Math.ceil(count / limit),
        searchQuery: search,
    });
    } catch (error) {
         error.statusCode = 500;
        next(error);
    }
}

const customerBlocked = async(req,res,next)=>{
    try {
        let id=req.query.id
        await User.updateOne({_id:id},{$set:{isBlocked:true}})
        res.redirect("/admin/users")
    } catch (error) {
       error.statusCode = 500;
        next(error);
    }
}

const customerunBlocked = async(req,res,next)=>{
    try {
        let id=req.query.id
        await User.updateOne({_id:id},{$set:{isBlocked:false}})
        res.redirect("/admin/users")
    } catch (error) {
        error.statusCode = 500;
        next(error);
    }
}

module.exports = {
    customerInfo,
    customerBlocked,
    customerunBlocked
}