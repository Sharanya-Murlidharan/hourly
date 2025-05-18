const mongoose = require('mongoose');
const { Schema } = mongoose;

const couponSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    description: {
        type: String,
        required: false,
        trim: true,
        maxlength: 200,
        default: ''
    },
    code: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    minCartValue: {
        type: Number,
        required: true,
        min: 0
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    validFrom: {
        type: Date,
        required: true
    },
    validUpto: {
        type: Date,
        required: true
    },
    isDeleted: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

const Coupon = mongoose.model("Coupon", couponSchema);
module.exports = Coupon;