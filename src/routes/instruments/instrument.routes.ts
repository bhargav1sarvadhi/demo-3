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
            END_POINTS.INSTRUMENT_KOTAK_INSTALL,
            instrumentsController.instrument_add_kotak,
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
        this.router.get(
            END_POINTS.GENRATE_STRIKE,
            instrumentsController.strike_genrate,
        );
        this.router.post(
            END_POINTS.HEDGING_INSTALL,
            instrumentsController.insert_hedging_strategy,
        );
        this.router.post(
            END_POINTS.CREATE_STRATEGY,
            instrumentsController.strategy_create,
        );
        this.router.delete(
            END_POINTS.DELETE_HEDGING_OPTIONS,
            instrumentsController.hedging_options_removes,
        );
        this.router.get(
            END_POINTS.ADD_HEDGING_OPTIONS,
            instrumentsController.get_add_hedging_options_list,
        );
    }
}
export const instrumentRoutes = new InstrumentRoutes().router;
