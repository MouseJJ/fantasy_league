//const API_KEY = '169792c846364b6d9b526baea16c2a9c'; // Replace with your real API key



async function getLeagueStandings() {
    const response = await fetch('http://localhost:5000/standings');
    return response.json();
}

async function getLeagueTeams() {
    const response = await fetch('http://localhost:5000/teams');
    return response.json();
}
