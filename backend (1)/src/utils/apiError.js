class ApiError extends Error {
  constructor(statusCode, message, fields = null) {
    super(message);
    this.statusCode = statusCode;
    this.fields = fields;
  }
}

export default ApiError;