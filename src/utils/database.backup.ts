// import * as childProcess from 'child_process';
// import util from 'util';
// import fs from 'fs';
// import { config } from 'dotenv';
// import { uploadFileToS3 } from '../helpers/aws.fileupload';
// import { logger } from '../logger/logger';
// config();
// const execute = util.promisify(childProcess.exec);

// export const backupDatabase = async () => {
//     try {
//         const {
//             DB_USER: username,
//             DB_NAME: database,
//             DB_HOST: host,
//             DB_PASSWORD: password,
//             DB_PORT: port,
//             DB_BACKUP_FOLDER_PATH: backupFolderPath,
//         } = process.env;

//         const date = new Date();
//         const year = date.getFullYear();
//         const month = date.getMonth() + 1;
//         const currentDate = `${year}.${month}.${date.getDate()}.${date.getHours()}.${date.getMinutes()}`;
//         const folderPath = `${backupFolderPath}/${year}/${month}`;
//         const fileName = `shidduch-backup-${currentDate}.sql`;
//         const filePath = `${folderPath}/${fileName}`;
//         const pgDumpPath = '/Library/PostgreSQL/15/bin/pg_dump';
//         if (!fs.existsSync(folderPath)) {
//             fs.mkdirSync(folderPath, { recursive: true });
//         }

//         const backupfile = await execute(
//             `PGPASSWORD=${password} pg_dump -U ${username} -d ${database} -h ${host} -p ${port} -Fc -f "${filePath}"`,
//         );

//         const fileData = fs.readFileSync(filePath);
//         const backupUpload = await uploadFileToS3(filePath, fileData);
//         if (backupUpload) {
//             logger.info(`sucessfully uploaded ${backupUpload}`);
//             fs.unlinkSync(filePath);
//         }
//     } catch (error) {
//         logger.info(`backup file in arrived error :  ${error.message}`);
//     }
// };
