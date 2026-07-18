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

// (১) Item Schema & Model (প্রোডাক্ট ক্যাটালগ)
const itemSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    shortDescription: { type: String, required: true },
    fullDescription: { type: String, required: true },
    price: { type: Number, required: true },
    imageUrl: { type: String, required: true },
    tags: { type: [String], default: [] },
  },
  { timestamps: true }
);
const Item = mongoose.model("Item", itemSchema);

// (৫) Dynamic User Purchased/Cart Collection Schema (অর্ডার ও পার্সোনাল কালেকশন)
const userCollectionSchema = new mongoose.Schema(
  {
    userEmail: { type: String, required: true },
    itemId: { type: String, required: true },
    title: { type: String, required: true },
    shortDescription: { type: String, required: true },
    price: { type: Number, required: true },
    imageUrl: { type: String, required: true },
    status: { type: String, default: 'Pending' }, // অ্যাডমিন কন্ট্রোলের জন্য 'Pending' বা 'Confirmed'
    purchasedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);
const UserCollection = mongoose.model("UserCollection", userCollectionSchema, "usercollections");


// ----------------------------------------------------------------
// Express Server Configuration & Middlewares
// ----------------------------------------------------------------
const app = express();

app.use(
  cors({
    origin: (origin, callback) => {
      callback(null, true);
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// ----------------------------------------------------------------
// --- Custom Product Routes (Catalog Management) ---
// ----------------------------------------------------------------

// (৩) GET Items (Public) - শপ পেজের জন্য সব আইটেম রিড করা
app.get("/api/items", async (req, res) => {
  try {
    const items = await Item.find().sort({ createdAt: -1 });
    return res.json(items);
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch catalog items" });
  }
});

// (২) POST Item - ড্যাশবোর্ড থেকে নতুন প্রোডাক্ট আপলোড করা
app.post("/api/items", async (req, res) => {
  const { title, shortDescription, fullDescription, price, imageUrl, tags } = req.body;

  if (!title || !shortDescription || !fullDescription || price === undefined || !imageUrl) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
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
  } catch (error) {
    return res.status(500).json({ error: "Failed to save item to database" });
  }
});

// (৪) DELETE Item 
app.delete("/api/items/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const deletedItem = await Item.findByIdAndDelete(id);
    if (!deletedItem) {
      return res.status(404).json({ error: "Item not found" });
    }
    return res.json({ message: "Item deleted successfully", item: deletedItem });
  } catch (error) {
    return res.status(500).json({ error: "Failed to delete item" });
  }
});


// ----------------------------------------------------------------
// --- User Orders & Personal Collection Routes ---
// ----------------------------------------------------------------

// (৫.১) POST User Purchase - ইউজার প্রোডাক্ট বাই করলে কালেকশনে সেভ হবে
app.post("/api/user-collection", async (req, res) => {
  const { userEmail, itemId, title, shortDescription, price, imageUrl } = req.body;

  if (!userEmail || !itemId || !title || !price || !imageUrl) {
    return res.status(400).json({ error: "Missing required fields or user session context" });
  }

  try {
    const savedItem = new UserCollection({
      userEmail,
      itemId,
      title,
      shortDescription: shortDescription || "",
      price,
      imageUrl
    });

    await savedItem.save();
    return res.status(201).json(savedItem);
  } catch (error) {
    return res.status(500).json({ error: "Database insertion failed for user collection" });
  }
});

// (৫.২) GET User Private Collection - নির্দিষ্ট লগইন করা ইউজারের কালেকশন ফিল্টার করা
app.get("/api/user-collection", async (req, res) => {
  const { email } = req.query;

  if (!email) {
    return res.status(400).json({ error: "User email query parameter is required" });
  }

  try {
    const collections = await UserCollection.find({ userEmail: email }).sort({ createdAt: -1 });
    return res.json(collections);
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch personalized user collection" });
  }
});


// ----------------------------------------------------------------
// --- Admin Order Management Routes ---
// ----------------------------------------------------------------

// (৬.১) GET All Orders - অ্যাডমিন ড্যাশবোর্ডে সব ইউজারের অর্ডার ফেচ করা
app.get("/api/admin/orders", async (req, res) => {
  try {
    const orders = await UserCollection.find().sort({ createdAt: -1 });
    return res.json(orders);
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch orders for admin" });
  }
});

// (৬.২) PATCH Confirm Order - অ্যাডমিন অর্ডার পেন্ডিং থেকে কনফার্ম করা
app.patch("/api/admin/orders/:id/confirm", async (req, res) => {
  const { id } = req.params;
  try {
    const updatedOrder = await UserCollection.findByIdAndUpdate(
      id,
      { status: 'Confirmed' },
      { new: true }
    );
    if (!updatedOrder) {
      return res.status(404).json({ error: "Order not found" });
    }
    return res.json({ message: "Order confirmed successfully", order: updatedOrder });
  } catch (error) {
    return res.status(500).json({ error: "Failed to confirm order" });
  }
});

// (৬.৩) DELETE Order - অ্যাডমিন অর্ডার বাতিল/ডিলিট করা
app.delete("/api/admin/orders/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const deletedOrder = await UserCollection.findByIdAndDelete(id);
    if (!deletedOrder) {
      return res.status(404).json({ error: "Order not found" });
    }
    return res.json({ message: "Order deleted successfully", order: deletedOrder });
  } catch (error) {
    return res.status(500).json({ error: "Failed to delete order" });
  }
});


// --- Server Base & Port Activation ---
app.get("/", (req, res) => {
  res.send("NextFabric Backend Server is Running Smoothly!");
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});