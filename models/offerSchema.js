const mongoose = require('mongoose');
const { Schema } = mongoose;

const offerSchema = new Schema({
    offerName: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true,
        trim: true
    },
    offerType: {
        type: String,
        enum: ['Percentage', 'Fixed'],
        required: true
    },
    offerAmount: {
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
    applicable: {
        type: String,
        enum: ['Product', 'Brand', 'Category'],
        required: true
    },
    applicableItem: {
        type: Schema.Types.ObjectId,
        refPath: 'applicable',
        required:true
       },
    
    isListed: {
        type: Boolean,
        default: false
    },
    isDeleted: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Offer', offerSchema);