import BaseRoute from '../base.routes';
import { END_POINTS, ROLES } from '../../constant/index';
import { instrumentsController, strategyController } from '../../controller';
import { paginationMiddleware } from '../../middleware';

class InstrumentRoutes extends BaseRoute {
    async initializeRoutes() {
        this.router.get(
            END_POINTS.INSTRUMENT_INSTALL,
            instrumentsController.instrument_add,
        );
        this.router.get(
            END_POINTS.INSTRUMENT_INSTALL_JSON,
            instrumentsController.instrument_add_JSON,
        );
        this.router.get(
            END_POINTS.OPTIONS_STOCK,
            instrumentsController.get_by_options,
        );
        this.router.put(
            END_POINTS.OPTIONS_STOCK_ACTIVE,
            instrumentsController.stocks_active_deactive,
        );
        this.router.get(
            END_POINTS.GET_STRIKE,
            instrumentsController.get_index_strike,
        );
        this.router.get(
            END_POINTS.GET_STRIKE_TO_GENRATE_OPTIONS,
            instrumentsController.strike_to_genrate_options,
        );
        this.router.post(
            END_POINTS.GENRATE_STRIKE,
            instrumentsController.strike_genrate,
        );
        this.router.get(
            END_POINTS.STRIKE_ACTIVE_DEACTIVE,
            instrumentsController.is_active_deactive_strike_stock,
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
        this.router.get(
            END_POINTS.INSTRUMENT_TO_OPTIONSCHAIN,
            instrumentsController.instuments_to_optionschain,
        );
        this.router.get(
            END_POINTS.CHECK_SCALLPING,
            instrumentsController.check_scalping,
        );
        this.router.post(
            END_POINTS.CHECK_ORDER_PLACE,
            instrumentsController.check_order_place,
        );
        this.router.get(
            END_POINTS.STOCK_LIST,
            paginationMiddleware,
            instrumentsController.stock_list,
        );
        this.router.get(
            END_POINTS.TRADE_HISTORY_LIST,
            paginationMiddleware,
            instrumentsController.trade_historylist,
        );
        this.router.get(
            END_POINTS.CURRENT_POSTIONS,
            paginationMiddleware,
            instrumentsController.current_postions,
        );
        this.router.get(END_POINTS.DASHBOARD, instrumentsController.dashboard);
    }
}
export const instrumentRoutes = new InstrumentRoutes().router;
