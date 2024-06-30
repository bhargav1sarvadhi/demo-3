import BaseRoute from '../base.routes';
import { END_POINTS, ROLES } from '../../constant/index';
import { authController } from '../../controller/auth';

class AuthRoutes extends BaseRoute {
    async initializeRoutes() {
        this.router.get(END_POINTS.BLANK, authController.upstock_login);
    }
}
export const authRoutes = new AuthRoutes().router;
