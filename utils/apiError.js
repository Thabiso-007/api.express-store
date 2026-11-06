/** An error that carries the HTTP status code the API should respond with. */
class ApiError extends Error {
  constructor(statusCode, message, details = undefined) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
    if (Error.captureStackTrace) Error.captureStackTrace(this, ApiError);
  }

  static badRequest(message = "Bad request", details) {
    return new ApiError(400, message, details);
  }
  static unauthorized(message = "Not authorised") {
    return new ApiError(401, message);
  }
  static forbidden(message = "Forbidden") {
    return new ApiError(403, message);
  }
  static notFound(message = "Resource not found") {
    return new ApiError(404, message);
  }
  static conflict(message = "Resource already exists") {
    return new ApiError(409, message);
  }
  static badGateway(message = "Upstream service error") {
    return new ApiError(502, message);
  }
}

module.exports = ApiError;
