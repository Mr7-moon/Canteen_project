import Order from "../models/Order.js";
import paginate from "../utils/paginate.js";

export const getSalesSummary = async (req, res, next) => {
  const { date } = req.query;
  const targetDate = date || new Date().toISOString().split("T")[0];

  const startOfDay = new Date(targetDate);
  const endOfDay = new Date(targetDate);
  endOfDay.setUTCHours(23, 59, 59, 999);

  const dayFilter = { placedAt: { $gte: startOfDay, $lte: endOfDay } };

  // Total revenue from completed orders
  const revenueResult = await Order.aggregate([
    { $match: { ...dayFilter, status: "Completed" } },
    { $group: { _id: null, totalRevenue: { $sum: "$totalAmount" } } },
  ]);
  const totalRevenue = revenueResult[0]?.totalRevenue || 0;

  // Total non-cancelled orders
  const totalOrders = await Order.countDocuments({
    ...dayFilter,
    status: { $ne: "Cancelled" },
  });

  // Completed orders count
  const completedOrders = await Order.countDocuments({
    ...dayFilter,
    status: "Completed",
  });

  // Average order value
  const avgOrderValue =
    completedOrders > 0
      ? Math.round((totalRevenue / completedOrders) * 100) / 100
      : 0;

  // Completion rate
  const totalWithCancelled = await Order.countDocuments(dayFilter);
  const completionRate =
    totalWithCancelled > 0
      ? Math.round((completedOrders / totalWithCancelled) * 10000) / 100
      : 0;

  // Orders by status
  const ordersByStatus = await Order.aggregate([
    { $match: dayFilter },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);
  const ordersByStatusMap = {};
  ordersByStatus.forEach((item) => {
    ordersByStatusMap[item._id] = item.count;
  });

  // Daily breakdown for current week (Mon-Sun)
  const today = new Date(targetDate);
  const dayOfWeek = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7));
  monday.setUTCHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setUTCHours(23, 59, 59, 999);

  const dailyBreakdown = await Order.aggregate([
    {
      $match: {
        placedAt: { $gte: monday, $lte: sunday },
        status: { $ne: "Cancelled" },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m-%d", date: "$placedAt" },
        },
        revenue: { $sum: "$totalAmount" },
        orderCount: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  // Top 5 items
  const topItems = await Order.aggregate([
    { $match: dayFilter },
    { $unwind: "$items" },
    {
      $group: {
        _id: "$items.name",
        quantitySold: { $sum: "$items.quantity" },
        revenue: {
          $sum: { $multiply: ["$items.price", "$items.quantity"] },
        },
      },
    },
    { $sort: { quantitySold: -1 } },
    { $limit: 5 },
  ]);

  res.status(200).json({
    success: true,
    message: "Sales summary fetched",
    data: {
      date: targetDate,
      totalRevenue,
      totalOrders,
      avgOrderValue,
      completionRate: `${completionRate}%`,
      ordersByStatus: ordersByStatusMap,
      dailyBreakdown: dailyBreakdown.map((d) => ({
        date: d._id,
        revenue: d.revenue,
        orderCount: d.orderCount,
      })),
      topItems: topItems.map((item) => ({
        name: item._id,
        quantitySold: item.quantitySold,
        revenue: item.revenue,
      })),
    },
  });
};

export const getOrderHistory = async (req, res, next) => {
  const { date, page: pageStr, perPage: perPageStr, sort: sortStr } =
    req.query;

  const filter = {};
  if (date) {
    const start = new Date(date);
    const end = new Date(date);
    end.setUTCHours(23, 59, 59, 999);
    filter.placedAt = { $gte: start, $lte: end };
  }

  // Parse sort param (e.g. "-placedAt" -> { placedAt: -1 })
  let sort = {};
  if (sortStr) {
    const isDesc = sortStr.startsWith("-");
    const field = isDesc ? sortStr.slice(1) : sortStr;
    sort[field] = isDesc ? -1 : 1;
  } else {
    sort = { placedAt: -1 };
  }

  const result = await paginate(Order, filter, {
    page: pageStr,
    perPage: perPageStr || "10",
    sort,
  });

  const populatedItems = await Order.populate(result.items, {
    path: "user pickupSlot",
    select: "name phone time label date",
  });

  res.status(200).json({
    success: true,
    message: "Order history fetched",
    data: {
      orders: populatedItems,
      pagination: result.pagination,
    },
  });
};
