import multer from 'multer';
import path from 'path';

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, '..', 'uploads'));
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname);
        const fieldnameWithOriginalFilename = `${file.fieldname}-${uniqueSuffix}${ext}`;
        cb(null, fieldnameWithOriginalFilename);
    },
});

export const upload_video = multer({ storage: storage }).single('video');
