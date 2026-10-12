class AppError extends Error {
  constructor(message, status = 500, code = 'INTERNAL_ERROR', details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function notFound(_req, _res, next) {
  next(new AppError('Not found', 404, 'NOT_FOUND'));
}

function errorHandler(err, _req, res, _next) {
  const status = err.status || 500;
  const payload = {
    error: {
      message: status >= 500 ? 'An unexpected error occurred' : err.message,
      code: err.code || 'INTERNAL_ERROR',
    },
  };
  if (err.details) {
    payload.error.details = err.details;
  }
  if (status >= 500) {
    console.error(err);
  }
  res.status(status).json(payload);
}

module.exports = { AppError, notFound, errorHandler };
