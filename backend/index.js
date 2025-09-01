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

pool.connect()
    .then(() => console.log('Connected to PostgreSQL DB'))
    .catch((err) => console.error('DB connection error:', err));


app.get("/api/entries", async (req, res) => {
    console.log('GET /api/entries request');
    try {
        const result = await pool.query(
            "SELECT name, message FROM entries ORDER BY id DESC"
        );
        console.log('GET /api/entries response:', result.rows);
        res.json(result.rows);
    } catch (err) {
        console.error('Error in GET /api/entries:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});


app.post("/api/entries", async (req, res) => {
    console.log('POST /api/entries request:', req.body);
    const { name, message } = req.body;
    try {
        await pool.query("INSERT INTO entries (name, message) VALUES ($1, $2)", [
            name,
            message,
        ]);
        console.log('POST /api/entries success');
        res.sendStatus(201);
    } catch (err) {
        console.error('Error in POST /api/entries:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});


app.listen(4000, () => {
    console.log("Backend running on port 4000");
});
