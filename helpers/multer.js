const multer = require('multer');

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'Uploads/product-images'); // Ensure this directory exists
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const uploads = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png/;
        const extname = filetypes.test(file.originalname.toLowerCase());
        const mimetype = filetypes.test(file.mimetype);
        if (extname && mimetype) {
            cb(null, true);
        } else {
            cb(new Error('Only JPEG and PNG images are allowed!'));
        }
    },
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
}).array('productImages', 4); // Expect up to 4 files under 'productImages'

const singleupload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png/;
        const extname = filetypes.test(file.originalname.toLowerCase());
        const mimetype = filetypes.test(file.mimetype);
        if (extname && mimetype) {
            cb(null, true);
        } else {
            cb(new Error('Only JPEG and PNG images are allowed!'));
        }
    },
    limits: { fileSize: 5 * 1024 * 1024 }
}).single('product-images'); // Keep for other routes if needed

module.exports = {
    uploads,
    singleupload
};