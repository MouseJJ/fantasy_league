const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
const PORT = 5000;
const API_KEY = '169792c846364b6d9b526baea16c2a9c';  
const BASE_URL = 'https://api.football-data.org/v4';

app.use(cors());

async function fetchData(url) {
    try {
        const response = await fetch(url, {
            headers: { 'X-Auth-Token': API_KEY }
        });

        if (!response.ok) {
            console.error(`Error: ${response.status} ${response.statusText}`);
            return { error: `Failed to fetch data: ${response.status}` };
        }

        return await response.json();
    } catch (error) {
        console.error("Server error:", error);
        return { error: "Internal server error" };
    }
}

app.get('/standings', async (req, res) => {
    const data = await fetchData(`${BASE_URL}/competitions/PL/standings`);
    res.json(data);
});

app.get('/teams', async (req, res) => {
    const data = await fetchData(`${BASE_URL}/competitions/PL/teams`);
    res.json(data);
});

app.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));
