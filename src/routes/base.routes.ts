import express from 'express';
import { AppError } from '../utils';
import { ERRORTYPES, RES_TYPES } from '../constant';
class BaseRoute {
    router: any;
    constructor() {
        this.router = express.Router();
        this.initializeRoutes();
    }
    initializeRoutes() {
        throw new AppError(
            RES_TYPES.INTIALROUTES_SUBCLASSES,
            ERRORTYPES.NOT_FOUND,
        );
    }
}
export default BaseRoute;
