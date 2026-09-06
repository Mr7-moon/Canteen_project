import "dotenv/config";
import mongoose from "mongoose";
import Admin from "../src/models/Admin.js";

const seedAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected for seeding");

    const existingAdmin = await Admin.findOne({
      $or: [{ username: "admin" }, { email: "admin@thecanteen.com" }],
    });

    if (existingAdmin) {
      console.log("Admin account already exists. Skipping seed.");
    } else {
      await Admin.create({
        username: "admin",
        email: "admin@thecanteen.com",
        password: "admin12345",
      });
      console.log("Admin account created: username=admin, password=admin12345");
    }

    await mongoose.disconnect();
    console.log("Seeding complete.");
    process.exit(0);
  } catch (error) {
    console.error("Seeding failed:", error.message);
    process.exit(1);
  }
};

seedAdmin();