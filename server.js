require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const path = require("path");

const app = express();

// Security and performance middleware
app.use(helmet());
app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? ["https://your-app-name.herokuapp.com"]
        : "*",
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files with cache control
app.use(
  express.static(path.join(__dirname, ""), {
    maxAge: process.env.NODE_ENV === "production" ? "1d" : "0",
  })
);

// Initialize Google Generative AI
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel(
  {
    model: "models/gemini-1.5-flash-8b",
  },
  {
    apiVersion: "v1beta",
  }
);

// Cache and debounce setup (same as before)
const cache = new Map();
const CACHE_DURATION = 5 * 60 * 1000;
const pendingRequests = new Map();
const DEBOUNCE_DELAY = 3000;

// ... [rest of your existing code for moderation functions] ...

// Health check endpoint for Heroku
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
  });
});

// Serve frontend
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "pagina_principal_Coemntarios_Beta.js"));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Server error:", err);
  res.status(500).json({
    clasificacion: "rechazado",
    explicacion: "Error interno del servidor",
  });
});

// Handle 404
app.use((req, res) => {
  res.status(404).send("Not Found");
});

// Dynamic port binding for Heroku
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(
    `Server running in ${process.env.NODE_ENV || "development"} mode`
  );
  console.log(`Listening on port ${PORT}`);
});

// Cleanup on shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received. Shutting down gracefully...");
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});
