const mongoose = require("mongoose")
const {Schema} = mongoose

const productSchema = new Schema({
    productName:{
        type:String,
        required:true,
    },
    description:{
        type:String,
        required:true
    },
    brand:{
        type:Schema.Types.ObjectId,
        ref:"Brand",
        required:true
    },
    category:{
        type:Schema.Types.ObjectId,
        ref:"Category",
        required:true
    },
    regularPrice:{
        type:Number,
        required:true
    },
    salePrice:{
        type:Number,
        required:true
    },
    productOffer:{
        type:Number,
        default:0
    },
    quantity:{
        type:Number,
        default:true, // Changed to required to match frontend
        default: 0 // Fixed default to a number
    },
   
    productImage:{
        type:[String],
        required:true
    },
    croppedImages: {
        type: [String],
        default: []
    },
    isBlocked:{
        type:Boolean,
        default:false
    },
    status:{
        type:String,
        enum:["Available","out of stock","Discountinued"],
        required:true,
        default:"Available"
    },
    isDeleted: { 
        type: Boolean,
         default: false
    }
},{timestamps:true})

const Product = mongoose.model("Product",productSchema)
module.exports = Product