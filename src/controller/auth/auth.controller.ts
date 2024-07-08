import axios from 'axios';
import { MODEL, RES_STATUS, USER_DETAILS } from '../../constant';
import { sendResponse } from '../../utils';
import { UpstoxClient } from 'upstox-js-sdk';
import { db } from '../../model';
import * as childProcess from 'child_process';
import util from 'util';
import path from 'path';
import fs from 'fs';
const execute = util.promisify(childProcess.exec);

class AuthController {
    async upstock_login(req, res, next) {
        try {
            const {
                query: { code },
            } = req;
            console.log(code);
            console.log(process.env.CLIENT_ID);
            console.log(process.env.CLIENT_SECERET);
            console.log(process.env.REDIRECT_URL);
            let config = {
                method: 'post',
                maxBodyLength: Infinity,
                url: 'https://api.upstox.com/v2/login/authorization/token',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    Accept: 'application/json',
                },
                data: new URLSearchParams({
                    code: code,
                    client_id: process.env.CLIENT_ID,
                    client_secret: process.env.CLIENT_SECERET,
                    redirect_uri: process.env.REDIRECT_URL,
                    grant_type: 'authorization_code',
                }).toString(),
            };

            const response = await axios(config);
            if (response?.data) {
                const [update] = await db[MODEL.USER].update(
                    {
                        token: response.data?.access_token,
                    },
                    { where: { email: USER_DETAILS.EMAIL } },
                );
                if (update === 1) {
                    console.log(update);
                    async function restartServer() {
                        console.log('arrived in restart');
                        const fileName = 'restart.json';
                        const data = {
                            username: 'exampleUser',
                            firstName: 'Example',
                            lastName: 'User',
                            email: 'example.user@example.com',
                        };
                        const folderPath = path.join(__dirname, '../../config');
                        if (!fs.existsSync(folderPath)) {
                            fs.mkdirSync(folderPath, { recursive: true });
                        }
                        const filePath = path.join(folderPath, fileName);
                        fs.writeFileSync(
                            filePath,
                            JSON.stringify(data, null, 2),
                            'utf-8',
                        );
                    }
                    setTimeout(restartServer, 30 * 1000);
                }
            }

            return sendResponse(res, {
                responseType: RES_STATUS.CREATE,
                message: res.__('instruments').insert,
            });
        } catch (error) {
            return next(error);
        }
    }

    async update_token(req, res, next) {
        try {
            const {
                body: {
                    data: { token },
                },
            } = req;
            const [update] = await db[MODEL.USER].update(
                { token: token },
                { where: { email: USER_DETAILS.EMAIL } },
            );
            if (update === 1) {
                console.log(update);
                async function restartServer() {
                    console.log('arrived in restart');
                    const fileName = 'restart.json';
                    const data = {
                        username: 'exampleUser',
                        firstName: 'Example',
                        lastName: 'User',
                        email: 'example.user@example.com',
                    };
                    const folderPath = path.join(__dirname, '../../config');
                    if (!fs.existsSync(folderPath)) {
                        fs.mkdirSync(folderPath, { recursive: true });
                    }
                    const filePath = path.join(folderPath, fileName);
                    fs.writeFileSync(
                        filePath,
                        JSON.stringify(data, null, 2),
                        'utf-8',
                    );
                }
                setTimeout(restartServer, 30 * 1000);
            }
            return sendResponse(res, {
                responseType: RES_STATUS.CREATE,
                message: res.__('instruments').insert,
            });
        } catch (error) {
            return next(error);
        }
    }
}

export const authController = new AuthController();