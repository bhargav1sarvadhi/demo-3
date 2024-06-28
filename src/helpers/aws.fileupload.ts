import S3 from 'aws-sdk/clients/s3';
import { config } from 'dotenv';
import { ERRORTYPES, RES_TYPES } from '../constant';
import { logger } from '../logger/logger';
import { AppError } from '../utils/index';

config();

const region = process.env.REGION;
const bucket = process.env.BUCKET;
const accessKeyId = process.env.AWS_ACCESS_KEY;
const secretAccessKey = process.env.SECRET_ACCESS_KEY;

const uploadConfig = {
    region,
    bucket,
    accessKeyId,
    secretAccessKey,
};

const s3 = new S3(uploadConfig);

// async function getFileName(id, img, parts) {
//     return `project/${id}.${parts}`;
// }

// export async function uploadImage(id, img, type) {
//     try {
//         const parts = type.split('/')[1];
//         const buf = Buffer.from(img.split(';base64,').pop(), 'base64');
//         const filename = await getFileName(id, img, parts);
//         const upload = {
//             Bucket: bucket,
//             Key: filename,
//             Body: buf,
//             ContentType: type,
//         };
//         const { Location } = await s3.upload(upload).promise();
//         if (!Location)
//             throw new AppError(RES_TYPES.NOT_UPLOAD, ERRORTYPES.UNKNOWN_ERROR);
//         return Location;
//     } catch (error) {
//         logger.error(error);
//     }
// }
// export async function uploadVideo(filename, video_data) {
//     try {
//         const file = `${process.env.FOLDER_NAME2}/${filename}`;
//         const upload = {
//             Bucket: bucket,
//             Key: file,
//             Body: video_data,
//             ContentType: 'video/mp4',
//         };
//         const { Location } = await s3.upload(upload).promise();
//         if (!Location)
//             throw new AppError(RES_TYPES.NOT_UPLOAD, ERRORTYPES.UNKNOWN_ERROR);
//         return Location;
//     } catch (error) {
//         logger.error(error);
//     }
// }

// export const uploadFileToS3 = async (fileKey, fileContent) => {
//     try {
//         const contentType = 'application/octet-stream';
//         const file = `${process.env.FOLDER_NAME}/${fileKey}`;
//         const params = {
//             Bucket: bucket,
//             Key: file,
//             Body: fileContent,
//             ContentType: contentType,
//         };
//         const { Location } = await s3.upload(params).promise();
//         if (!Location)
//             throw new AppError(RES_TYPES.NOT_UPLOAD, ERRORTYPES.UNKNOWN_ERROR);
//         return Location;
//     } catch (error) {
//         logger.error(`Error uploading file to S3: ${error.message}`);
//         throw new AppError(RES_TYPES.NOT_UPLOAD, ERRORTYPES.UNKNOWN_ERROR);
//     }
// };

// export const deleteImageAWS = (key) => {
//     const image = `${process.env.FOLDER_NAME2}/${key}`;
//     const params = {
//         Bucket: bucket,
//         Key: image,
//     };
//     s3.deleteObject(params, (deleteErr, deleteData) => {
//         if (deleteErr) {
//             logger.error(`Error deleting object: ${deleteErr.message}`);
//             return false;
//         } else {
//             logger.info(`Object deleted: ${key}`);
//             return true;
//         }
//     });
//     return true;
// };
// export const renameImageAWS = async (oldKey) => {
//     const image = `${process.env.FOLDER_NAME2}/${oldKey}`;

//     await s3
//         .copyObject({
//             Bucket: bucket,
//             CopySource: `/${bucket}/${image}`,
//             Key: `${process.env.FOLDER_NAME2}/default-image1.jpg`,
//         })
//         .promise();
//     return true;
// };

// export const updateImageToS3 = async (key, id, img, type) => {
//     if (!img) {
//         throw new AppError(RES_TYPES.NOT_FOUND_IMAGE, ERRORTYPES.UNKNOWN_ERROR);
//     }

//     if (!key) {
//         throw new AppError(RES_TYPES.NOT_FOUND_IMAGE, ERRORTYPES.UNKNOWN_ERROR);
//     }
//     const parts = type.split('/')[1];
//     const buf = Buffer.from(img.split(';base64,').pop(), 'base64');
//     const filename = await getFileName(id, img, parts);
//     const image = `${process.env.FOLDER_NAME2}/${key}`;
//     const uploadParams = {
//         Bucket: bucket,
//         Key: key,
//         ContentType: type,
//         Body: filename,
//     };
//     const { Location } = await s3.upload(uploadParams).promise();
//     if (!Location) {
//         throw new AppError(RES_TYPES.NOT_UPLOAD, ERRORTYPES.UNKNOWN_ERROR);
//     }
//     return Location;
// };
