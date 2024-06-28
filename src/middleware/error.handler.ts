import { logger } from '../logger/logger';
import { ERRORTYPES } from '../constant/index';
import { Response, Request, NextFunction } from 'express';

function GenerateCustomError(err: any, statusCode: number, res: Response) {
    const ErrorObj = { statusCode, message: err.message };
    return res.status(statusCode).send(ErrorObj);
}

export function ErrorHandler(
    err: any,
    req: Request,
    res: Response,
    next: NextFunction,
) {
    if (err.ErrorName === undefined) {
        switch (err instanceof Error) {
            case err.name === ERRORTYPES.SEQUELIZE_VALIDATION:
                logger.error(`${err.message}`);
                return GenerateCustomError(err.errors[0], 400, res);

            case err.name === ERRORTYPES.SEQUELIZE_CONSTRAINT:
                logger.error(`${err.message}`);
                return GenerateCustomError(err.errors[0], 409, res);

            case err.name === ERRORTYPES.SEQUELIZE_FORRIGENKEY_CONSTRAINT:
                logger.error(`${err.message}`);
                return GenerateCustomError(err, 400, res);

            default:
                logger.error(`${err.message}`);
                GenerateCustomError(err, 500, res);
                break;
        }
    } else {
        switch (err.ErrorName) {
            case ERRORTYPES.FORBIDDEN:
                logger.error(`${err.message}`);
                GenerateCustomError(err, 403, res);
                break;

            case ERRORTYPES.CONFLICT:
                logger.error(`${err.message}`);
                GenerateCustomError(err, 409, res);
                break;

            case ERRORTYPES.INVALID_REQUEST:
                logger.error(`${err.message}`);
                GenerateCustomError(err, 400, res);
                break;

            case ERRORTYPES.NOT_FOUND:
                logger.error(`${err.message}`);
                GenerateCustomError(err, 404, res);
                break;

            case ERRORTYPES.UNAUTHORIZED:
                logger.error(`${err.message}`);
                GenerateCustomError(err, 401, res);
                break;

            case ERRORTYPES.VALIDATION_ERROR:
                logger.error(`${err.message}`);
                GenerateCustomError(err, 400, res);
                break;

            default:
                logger.error(`${err.message}`);
                GenerateCustomError(err, 500, res);
                break;
        }
    }
}
