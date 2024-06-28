import BaseRoute from '../base.routes';
import { END_POINTS, ROLES } from '../../constant/index';
import { instrumentsController } from '../../controller';

class InstrumentRoutes extends BaseRoute {
    async initializeRoutes() {
        this.router.get(
            END_POINTS.INSTRUMENT_INSTALL,
            instrumentsController.instrument_add,
        );
        this.router.get(
            END_POINTS.OPTIONS_STOCK,
            instrumentsController.get_by_options,
        );
    }
}
export const instrumentRoutes = new InstrumentRoutes().router;
