import BaseRoute from '../base.routes';
import { END_POINTS, ROLES } from '../../constant/index';
import { dashboardController } from '../../controller';

class DashboardRoutes extends BaseRoute {
    async initializeRoutes() {
        this.router.post(
            END_POINTS.POSTIONS_DATA,
            dashboardController.dashboard_api,
        );
        this.router.get(
            END_POINTS.STRATEGY_LIST,
            dashboardController.strategy_list,
        );
    }
}
export const dashboardRoutes = new DashboardRoutes().router;
