export const paginationMiddleware = (req, res, next) => {
    try {
        const pageIndex = parseInt(req.query.pageIndex);
        const pageSize = parseInt(req.query.pageSize);

        if (!pageIndex || !pageSize || pageIndex <= 0 || pageSize <= 0) {
            req.paginations = {};
            return next();
        }
        const options = { limit: pageSize, offset: (pageIndex - 1) * pageSize };
        console.log(options);

        req.paginations = options;
        next();
    } catch (error) {
        next(error);
    }
};
