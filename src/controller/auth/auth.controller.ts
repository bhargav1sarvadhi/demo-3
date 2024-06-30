import axios from 'axios';
import { RES_STATUS } from '../../constant';
import { sendResponse } from '../../utils';

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
                postBody: {
                    code: code,
                    client_id: process.env.CLIENT_ID,
                    client_secret: process.env.CLIENT_SECRET,
                    redirect_uri: process.env.REDIRECT_URL,
                    grant_type: 'authorization_code',
                },
            };
            const response = await axios(config);
            console.log(response.data);

            return sendResponse(res, {
                responseType: RES_STATUS.CREATE,
                data: response.data,
                message: res.__('instruments').insert,
            });
        } catch (error) {
            return next(error);
        }
    }
}

export const authController = new AuthController();
