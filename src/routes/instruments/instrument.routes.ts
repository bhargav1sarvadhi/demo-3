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
        this.router.get(
            END_POINTS.GET_STRIKE,
            instrumentsController.get_index_strike,
        );
        this.router.get(
            END_POINTS.GET_STRIKE_TO_GENRATE_OPTIONS,
            instrumentsController.strike_to_genrate_options,
        );
    }
}
export const instrumentRoutes = new InstrumentRoutes().router;
