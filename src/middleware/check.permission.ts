import { ERRORTYPES, RES_TYPES } from '../constant/index';
import { AppError } from '../utils/index';

export function checkPermission(roles) {
    return function (req, res, next) {
        if (roles.includes(req.user.role)) {
            return next();
        }
        throw new AppError(RES_TYPES.NOT_PERMISSION, ERRORTYPES.FORBIDDEN);
    };
}
