import dotenv from 'dotenv';
dotenv.config();
import { db } from '../model';
import passport from 'passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import * as jwt from 'jsonwebtoken';
import { MODEL } from '../constant';
import { logger } from '../logger/logger';

const opts = {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: process.env.JWT_SECERET,
};

export default passport.use(
    new Strategy(opts, async function (jwtPayload, done) {
        try {
            const user = await db[MODEL.USER].findByPk(jwtPayload.id);
            if (user) {
                return done(null, user);
            }
        } catch (error) {
            return done(error, false);
        }
    }),
);

class Token {
    async createToken(payload, next) {
        try {
            const expiresIn = '365d';
            const token = jwt.sign(payload, process.env.JWT_SECERET, {
                algorithm: 'HS256',
                expiresIn,
            });
            return token;
        } catch (error) {
            return next(error);
        }
    }

    async decodeToken(token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECERET);
            return decoded;
        } catch (error) {
            logger.info('decode token in error', error);
        }
    }
}

export const TokenController = new Token();
