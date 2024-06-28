export const paginationMiddleware = (req, res, next) => {
    try {
        const pageIndex = parseInt(req.body.data?.pageIndex);
        const pageSize = parseInt(req.body.data?.pageSize);

        if (!pageIndex || !pageSize || pageIndex <= 0 || pageSize <= 0) {
            req.paginations = {};
            return next();
        }
        const options = { limit: pageSize, offset: (pageIndex - 1) * pageSize };
        req.paginations = options;
        next();
    } catch (error) {
        next(error);
    }
};
