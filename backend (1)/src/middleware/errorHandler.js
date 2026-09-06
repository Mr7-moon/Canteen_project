const errorHandler = (err, req, res, next) => {
  const status = err.statusCode || 500;
  console.log("Error:", err);
  res.status(status).json({
    success: false,
    message: err.message,
    data: {
      ...(err.fields && { fields: err.fields }),
    },
  });
};

export default errorHandler;
