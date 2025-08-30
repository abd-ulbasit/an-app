import React, { useState, useEffect } from "react";
import axios from "axios";

function App() {
    const [entries, setEntries] = useState([]);
    const [name, setName] = useState("");
    const [message, setMessage] = useState("");

    useEffect(() => {
        axios.get("/api/entries").then((res) => setEntries(res.data));
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        await axios.post("/api/entries", { name, message });
        setName("");
        setMessage("");
        const res = await axios.get("/api/entries");
        setEntries(res.data);
    };

    return (
        <div>
            <h1>Guestbook</h1>
            <form onSubmit={handleSubmit}>
                <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Name"
                    required
                />
                <input
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Message"
                    required
                />
                <button type="submit">Sign</button>
            </form>
            <ul>
                {entries.map((entry, idx) => (
                    <li key={idx}>
                        <b>{entry.name}</b>: {entry.message}
                    </li>
                ))}
            </ul>
        </div>
    );
}

export default App;
