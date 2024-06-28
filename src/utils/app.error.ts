class AppError extends Error {
    public ErrorName: string;
    public message: string;
    constructor(message: string, ErrorName: string) {
        super(message);
        this.ErrorName = ErrorName;
        this.message = message;
        Error.captureStackTrace(this, this.constructor);
    }
}

export default AppError;
