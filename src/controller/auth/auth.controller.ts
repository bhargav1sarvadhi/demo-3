import axios from 'axios';
import { MODEL, RES_STATUS, USER_DETAILS } from '../../constant';
import { sendResponse } from '../../utils';
import { UpstoxClient } from 'upstox-js-sdk';
import { db } from '../../model';
import { exec } from 'child_process';

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
                    // function restartServer() {
                    exec('nodemon src\\app.ts', (err, stdout, stderr) => {
                        if (err) {
                            console.error('Error restarting server:', err);
                            console.error('Error details:', err.message);
                            return;
                        }

                        console.log('Server restarted successfully.');
                        console.log('stdout:', stdout);
                        console.log('stderr:', stderr);
                    });
                    // }

                    // Set timeout for one minute (60 seconds)
                    // setTimeout(restartServer, 60 * 1000);
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
}

export const authController = new AuthController();
