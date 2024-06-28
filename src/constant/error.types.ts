export enum ERRORTYPES {
    NOT_FOUND = 'not_found',
    FORBIDDEN = 'Forbidden',
    INVALID_REQUEST = 'invalid_request',
    CONFLICT = 'conflict',
    UNAUTHORIZED = 'unauthorized',
    UNKNOWN_ERROR = 'unknown_error',
    VALIDATION_ERROR = 'validation_error',
    SEQUELIZE_VALIDATION = 'SequelizeValidationError',
    SEQUELIZE_CONSTRAINT = 'SequelizeUniqueConstraintError',
    SEQUELIZE_FORRIGENKEY_CONSTRAINT = 'SequelizeForeignKeyConstraintError',
}
