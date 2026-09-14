const paginate = async (Model, filter = {}, options = {}) => {
  const page = parseInt(options.page) || 1;
  const perPage = parseInt(options.perPage) || 20;
  const skip = (page - 1) * perPage;
  const sort = options.sort || {};

  const [items, totalItems] = await Promise.all([
    Model.find(filter).sort(sort).skip(skip).limit(perPage),
    Model.countDocuments(filter),
  ]);

  return {
    items,
    pagination: {
      page,
      perPage,
      totalItems,
      totalPages: Math.ceil(totalItems / perPage),
    },
  };
};

export default paginate;