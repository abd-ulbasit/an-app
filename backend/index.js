const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
    user: process.env.POSTGRES_USER || "postgres",
    host: process.env.POSTGRES_HOST || "db",
    database: process.env.POSTGRES_DB || "guestbook",
    password: process.env.POSTGRES_PASSWORD || "postgres",
    port: 5432,
});

app.get("/api/entries", async (req, res) => {
    const result = await pool.query(
        "SELECT name, message FROM entries ORDER BY id DESC"
    );
    res.json(result.rows);
});

app.post("/api/entries", async (req, res) => {
    const { name, message } = req.body;
    await pool.query("INSERT INTO entries (name, message) VALUES ($1, $2)", [
        name,
        message,
    ]);
    res.sendStatus(201);
});

app.listen(4000, () => {
    console.log("Backend running on port 4000");
});
