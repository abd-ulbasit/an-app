const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
app.use(cors());
app.use(express.json());

// The password has no default: a missing secret should stop the process
// instead of silently falling back to a well-known value.
if (!process.env.POSTGRES_PASSWORD) {
    console.error("POSTGRES_PASSWORD is not set; refusing to start.");
    process.exit(1);
}

const pool = new Pool({
    user: process.env.POSTGRES_USER || "postgres",
    host: process.env.POSTGRES_HOST || "db",
    database: process.env.POSTGRES_DB || "guestbook",
    password: process.env.POSTGRES_PASSWORD,
    port: 5432,
});

// An idle client can error out (e.g. RDS failover or a closed connection).
// Without a listener the pool re-emits it as an unhandled 'error' event and
// the process crashes.
pool.on("error", (err) => console.error("Idle DB client error:", err));

// Startup connectivity check. pool.query releases its client afterwards;
// pool.connect() without release() leaked one connection per start.
pool.query("SELECT 1")
    .then(() => console.log("Connected to PostgreSQL DB"))
    .catch((err) => console.error("DB connection error:", err));

// Liveness: the process is up and serving HTTP. It deliberately does not
// touch the DB, so a DB outage does not restart every backend pod.
app.get("/healthz", (req, res) => {
    res.sendStatus(200);
});

// Readiness: the DB answers. Kubernetes stops routing to the pod while not.
app.get("/readyz", async (req, res) => {
    try {
        await pool.query("SELECT 1");
        res.sendStatus(200);
    } catch (err) {
        console.error("Readiness check failed:", err.message);
        res.sendStatus(503);
    }
});

app.get("/api/entries", async (req, res) => {
    console.log("GET /api/entries request");
    try {
        const result = await pool.query(
            "SELECT name, message FROM entries ORDER BY id DESC"
        );
        console.log("GET /api/entries response:", result.rows);
        res.json(result.rows);
    } catch (err) {
        console.error("Error in GET /api/entries:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.post("/api/entries", async (req, res) => {
    console.log("POST /api/entries request:", req.body);
    const { name, message } = req.body;
    try {
        await pool.query(
            "INSERT INTO entries (name, message) VALUES ($1, $2)",
            [name, message]
        );
        console.log("POST /api/entries success");
        res.sendStatus(201);
    } catch (err) {
        console.error("Error in POST /api/entries:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.listen(4000, () => {
    console.log("Backend running on port 4000");
});
