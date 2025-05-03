const mongoose = require('mongoose')
const {Schema} = mongoose

const brandSchema = new Schema({
    name:{
        type:String,
        required:true
    },
    description: {
        type: String, 
        required: true,
      },
    isListed:{
        type:Boolean,
        default:false
    },
    isDeleted: {
        type: Boolean,
        default: false // Default to false (not deleted)
    },
    createdOn:{
        type:Date,
        default:Date.now
    }
})

const Brand = mongoose.model("Brand",brandSchema)
module.exports = Brand