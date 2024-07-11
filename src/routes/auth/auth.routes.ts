import BaseRoute from '../base.routes';
import { END_POINTS, ROLES } from '../../constant/index';
import { authController } from '../../controller/auth';

class AuthRoutes extends BaseRoute {
    async initializeRoutes() {
        this.router.get(END_POINTS.BLANK, authController.upstock_login);
        this.router.post(END_POINTS.TOKEN, authController.update_token);
        this.router.post(END_POINTS.LOGIN, authController.login);
    }
}
export const authRoutes = new AuthRoutes().router;
