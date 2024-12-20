import cors from "cors";
import express from "express";
import mongoose from "mongoose";
import listEndpoints from "express-list-endpoints";
import { configDotenv } from "dotenv";

// Load environment variables
configDotenv();

const mongoUrl =
  process.env.MONGO_URL || "mongodb://localhost/happy-thoughts-api";
mongoose.connect(mongoUrl);
mongoose.Promise = Promise;

// Define Thoughts model
const Thought = mongoose.model("Thought", {
  message: {
    type: String,
    required: [true, "Message is required"],
    validate: [
      {
        validator: function (value) {
          return value.length >= 5;
        },
        message: (props) =>
          `Message must be at least 5 characters. Your message has ${props.value.length} characters.`,
      },
      {
        validator: function (value) {
          return value.length <= 140;
        },
        message: (props) =>
          `The maximum length of a message is 140 characters. Your message has ${props.value.length} characters.`,
      },
    ],
  },
  hearts: {
    type: Number,
    default: 0,
    min: [0, "Hearts cannot be negative"],
  },
  createdAt: {
    type: Date,
    default: () => new Date(),
  },
});

// Defines the port the app will run on.
const port = process.env.PORT || 8080;
const app = express();

// Add middlewares to enable cors and json body parsing
app.use(cors());
app.use(express.json());

// API documentation
app.get("/", (req, res) => {
  res.json(listEndpoints(app));
});

// Get the latest 20 thoughts
app.get("/thoughts", async (req, res) => {
  try {
    const latestThoughts = await Thought.find()
      .sort({ createdAt: -1 }) // Sort by `createdAt` descending (-1 for newest first)
      .limit(20) // Limit the results to 20
      .exec(); // Execute the query

    res.status(200).json(latestThoughts);
  } catch (err) {
    res
      .status(500)
      .json({ error: "Failed to fetch thoughts", details: err.message });
  }
});

// Post a thought
app.post("/thoughts", async (req, res) => {
  try {
    const thought = new Thought({ message: req.body.message });
    await thought.save();
    res.status(201).json(thought);
  } catch (err) {
    res
      .status(400)
      .json({ message: "Could not save thought", errors: err.errors });
  }
});

// Add or remove a like from a thought
app.put("/thoughts/:id/like", async (req, res) => {
  const { id } = req.params;
  const { action } = req.body; // Expecting "add" or "remove" in the request body

  if (!["add", "remove"].includes(action)) {
    return res
      .status(400)
      .json({ error: "Invalid action. Use 'add' or 'remove'." });
  }

  try {
    const update =
      action === "add" ? { $inc: { hearts: 1 } } : { $inc: { hearts: -1 } };

    const updatedThought = await Thought.findByIdAndUpdate(
      id, // Find the thought by its ID
      update, // Increment or decrement the `hearts` field
      { new: true, runValidators: true } // Return the updated document
    );

    if (!updatedThought) {
      return res.status(404).json({ error: "Thought not found" });
    }

    res.status(200).json(updatedThought);
  } catch (err) {
    res
      .status(500)
      .json({ error: "Failed to update like", details: err.message });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
