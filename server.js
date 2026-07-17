import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";

// Load environment variables from .env
dotenv.config();

const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/nextfabric-ecommerce";

// Initialize Mongoose connection for application models
console.log("Connecting Mongoose to:", MONGODB_URI);
await mongoose.connect(MONGODB_URI, {
  serverSelectionTimeoutMS: 5000
});
console.log("Mongoose connected successfully");

// ----------------------------------------------------------------
// Mongoose Models
// ----------------------------------------------------------------

// Item schema (MERN stack product logic remains untouched)
const itemSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    shortDescription: { type: String, required: true },
    fullDescription: { type: String, required: true },
    price: { type: Number, required: true },
    imageUrl: { type: String, required: true },
    tags: { type: [String], default: [] },
  },
  {
    timestamps: true,
  }
);
const Item = mongoose.model("Item", itemSchema);

// ----------------------------------------------------------------
// Express Server Configuration & Routes
// ----------------------------------------------------------------
const app = express();

// Configure CORS
app.use(
  cors({
    origin: (origin, callback) => {
      callback(null, true);
    },
    credentials: true,
  })
);

// Body-parsing Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Custom Product Routes ---

// 1. GET Items (Public)
app.get("/api/items", async (req, res) => {
  const items = await Item.find().sort({ createdAt: -1 });
  return res.json(items);
});

// 2. POST Item (Public/Direct endpoint without Better Auth middleware block)
app.post("/api/items", async (req, res) => {
  const { title, shortDescription, fullDescription, price, imageUrl, tags } = req.body;

  if (!title || !shortDescription || !fullDescription || price === undefined || !imageUrl) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const newItem = new Item({
    title,
    shortDescription,
    fullDescription,
    price,
    imageUrl,
    tags: tags || [],
  });

  await newItem.save();
  return res.status(201).json(newItem);
});

// 3. DELETE Item (Public/Direct endpoint for the dashboard to successfully clean up data)
app.delete("/api/items/:id", async (req, res) => {
  const { id } = req.params;
  const deletedItem = await Item.findByIdAndDelete(id);

  if (!deletedItem) {
    return res.status(404).json({ error: "Item not found" });
  }

  return res.json({ message: "Item deleted successfully", item: deletedItem });
});

// 4. POST Demo Login (Public endpoint providing mock credentials for quick demo mode)
// app.post("/api/demo-login", (req, res) => {
//   return res.json({
//     success: true,
//     user: {
//       name: "Demo User",
//       email: "demo@example.com",
//     },
//     credentials: {
//       email: "demo@example.com",
//       password: "demoPassword123",
//     }
//   });
// });

app.get("/", (req, res) => {
  res.send("NextFabric Backend Server is Running Smoothly!");
});

// Start Express Server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});