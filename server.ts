import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = 3000;

// Path to persist state across server restarts on container
const DB_FILE = path.join(process.cwd(), "db.json");

// Middleware to parse large JSON payloads (specifically for spreadsheet copy-pastes)
app.use(express.json({ limit: "50mb" }));

// Helper to load current database state
function loadDB() {
  if (fs.existsSync(DB_FILE)) {
    try {
      const data = fs.readFileSync(DB_FILE, "utf-8");
      return JSON.parse(data);
    } catch (e) {
      console.error("Error loading db.json, returning null", e);
    }
  }
  return null;
}

// Helper to save database state
function saveDB(data: any) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {
    console.error("Error writing to db.json", e);
  }
}

// In-memory cache loaded once from file or client
let dbState = loadDB();

// API Endpoints
app.get("/api/data", (req, res) => {
  res.json({ data: dbState });
});

app.post("/api/data", (req, res) => {
  dbState = req.body;
  saveDB(dbState);
  res.json({ success: true, message: "A base de dados foi gravada com sucesso no servidor." });
});

// Reset endpoint
app.post("/api/reset", (req, res) => {
  if (fs.existsSync(DB_FILE)) {
    try {
      fs.unlinkSync(DB_FILE);
    } catch (e) {
      console.error("Error deleting db.json file:", e);
    }
  }
  
  if (req.body && Object.keys(req.body).length > 0) {
    dbState = req.body;
    saveDB(dbState);
  } else {
    dbState = null;
  }
  
  res.json({ success: true, message: "A base de dados foi redefinida para os padrões originais." });
});

// Setup Vite Development Middleware or Static Assets serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve production static assets compiled under dist/
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[ATACADÃO] Servidor Corporativo rodando na porta ${PORT}`);
  });
}

startServer();
