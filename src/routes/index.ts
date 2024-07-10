import express, { Router } from 'express';
import { END_POINTS, ERRORTYPES, RES_TYPES, ROLES } from '../constant/index';
import { AppError } from '../utils';
import { instrumentRoutes } from './instruments/instrument.routes';
import { authRoutes } from './auth/auth.routes';
import { dashboardRoutes } from './dashboard/dashboard.routes';

class InvalidedRouter {
    handleRequest(req, res, next) {
        return next(
            new AppError(
                `${req.url} - ${RES_TYPES.BAD_URL}`,
                ERRORTYPES.NOT_FOUND,
            ),
        );
    }
}

class MainRouter {
    router: Router;
    invalidedRouter: InvalidedRouter;
    constructor() {
        this.router = express.Router();
        this.invalidedRouter = new InvalidedRouter();
    }

    setupRoutes() {
        this.router.use(END_POINTS.INSTRUMENT, instrumentRoutes);
        this.router.use(END_POINTS.STOCK, authRoutes);
        this.router.use(END_POINTS.DASHBOARD_API, dashboardRoutes);
        this.router.all(END_POINTS.ALL, (req, res, next) =>
            this.invalidedRouter.handleRequest(req, res, next),
        );
    }
}

const mainRouter = new MainRouter();
mainRouter.setupRoutes();

export default mainRouter.router;
