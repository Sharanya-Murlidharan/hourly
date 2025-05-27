const multer = require('multer');
const path = require('path');
const fs = require('fs');

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

// Updated profile picture storage configuration
const profileStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Create the directory if it doesn't exist
        const uploadDir = 'public/Uploads/profile-images';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Generate a unique filename with original extension
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, 'profile-' + uniqueSuffix + ext);
    }
});

const uploadProfilePicture = multer({
    storage: profileStorage,
    limits: {
        fileSize: 2 * 1024 * 1024, // 2MB
        files: 1
    },
    fileFilter: (req, file, cb) => {
        // Check if file and file.originalName exist
        if (!file || !file.originalname) {
            return cb(new Error('No file uploaded or invalid file data'));
        }

        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        const extname = /\.(jpe?g|png|webp)$/i.test(path.extname(file.originalname));
        const mimetype = allowedTypes.includes(file.mimetype);

        if (extname && mimetype) {
            cb(null, true);
        } else {
            cb(new Error('Only JPEG, PNG, and WEBP image files are allowed'));
        }
    }
}).single('profileImage');

module.exports = {
    uploads,
    singleupload,
    uploadProfilePicture
};