import PickupSlot from "../models/PickupSlot.js";

const generateDailySlots = async () => {
  const durationMinutes = parseInt(process.env.SLOT_DURATION_MINUTES) || 15;
  const capacity = parseInt(process.env.SLOT_CAPACITY) || 10;

  const now = new Date();
  const today = now.toISOString().split("T")[0];

  // Check if slots already exist for today
  const existingCount = await PickupSlot.countDocuments({ date: today });
  if (existingCount > 0) return;

  // Generate slots from 9:00 AM to 5:00 PM
  const startHour = 9;
  const endHour = 17;

  const slots = [];
  for (let hour = startHour; hour < endHour; hour++) {
    for (let min = 0; min < 60; min += durationMinutes) {
      const period = hour >= 12 ? "PM" : "AM";
      const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
      const displayMin = min.toString().padStart(2, "0");
      const time = `${displayHour}:${displayMin} ${period}`;

      slots.push({
        time,
        label: time,
        date: today,
        maxCapacity: capacity,
        orderCount: 0,
      });
    }
  }

  if (slots.length > 0) {
    await PickupSlot.insertMany(slots, { ordered: false });
  }
};

export { generateDailySlots };

export const listAvailableSlots = async (req, res, next) => {
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const currentTimeMinutes = now.getHours() * 60 + now.getMinutes();

  // Ensure slots exist for today
  await generateDailySlots();

  const allSlots = await PickupSlot.find({ date: today }).sort({ time: 1 });

  // Filter to only future time slots
  const availableSlots = allSlots.filter((slot) => {
    const [timeStr, period] = slot.time.split(" ");
    let [hours, minutes] = timeStr.split(":").map(Number);
    if (period === "PM" && hours !== 12) hours += 12;
    if (period === "AM" && hours === 12) hours = 0;
    const slotMinutes = hours * 60 + minutes;
    return slotMinutes > currentTimeMinutes;
  });

  res.status(200).json({
    success: true,
    message: "Slots fetched",
    data: { date: today, slots: availableSlots },
  });
};

export const listAllSlotsAdmin = async (req, res, next) => {
  const now = new Date();
  const today = now.toISOString().split("T")[0];

  await generateDailySlots();

  const slots = await PickupSlot.find({ date: today }).sort({ time: 1 });

  res.status(200).json({
    success: true,
    message: "Slots fetched",
    data: { date: today, slots },
  });
};
