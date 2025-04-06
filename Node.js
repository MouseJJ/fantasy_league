const express = require('express');
const session = require('express-session');
const mysql = require('mysql2/promise');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

// Database configuration
const dbConfig = {
    host: 'localhost',
    user: 'fpl_user',
    password: 'root',
    database: 'fantasy_premier_league'
};

// Session setup
app.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: true
}));

// Middleware for authentication
function isLoggedIn(req) {
    return req.session.user_id;
}

function requireLogin(req, res, next) {
    if (!isLoggedIn(req)) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
}

// Login
app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const conn = await mysql.createConnection(dbConfig);

    const [rows] = await conn.execute(
        'SELECT id, username, password_hash FROM users WHERE email = ?',
        [email]
    );

    if (rows.length === 1) {
        const user = rows[0];
        const isMatch = await require('bcrypt').compare(password, user.password_hash);
        if (isMatch) {
            req.session.user_id = user.id;
            req.session.username = user.username;
            return res.json({ success: true });
        }
    }
    res.json({ success: false });
});

// Logout
app.post('/logout', (req, res) => {
    req.session.destroy(() => {
        res.json({ success: true });
    });
});

// Get player data
app.get('/get_player_data', requireLogin, async (req, res) => {
    const conn = await mysql.createConnection(dbConfig);
    const [teamRows] = await conn.execute(
        'SELECT * FROM user_teams WHERE user_id = ?',
        [req.session.user_id]
    );

    const team = teamRows[0];
    if (!team) return res.json({ error: 'Team not found' });

    const [playerRows] = await conn.execute(`
        SELECT p.*, up.position_in_team
        FROM user_players up
        JOIN players p ON up.player_id = p.id
        WHERE up.user_team_id = ?
    `, [team.id]);

    res.json({ team, players: playerRows });
});

// Make transfer
app.post('/make_transfer', requireLogin, async (req, res) => {
    const { playerOut, playerIn } = req.body;
    if (!playerOut || !playerIn) return res.json({ success: false, message: 'Missing required parameters' });

    const conn = await mysql.createConnection(dbConfig);
    await conn.beginTransaction();

    try {
        const [[team]] = await conn.execute('SELECT * FROM user_teams WHERE user_id = ?', [req.session.user_id]);
        if (!team) throw new Error('Team not found');

        const [existingPlayer] = await conn.execute(
            'SELECT * FROM user_players WHERE user_team_id = ? AND player_id = ?',
            [team.id, playerOut]
        );
        if (existingPlayer.length === 0) throw new Error('Player not in team');

        if (team.free_transfers < 1 && team.wildcard_active === 0) {
            throw new Error('No free transfers available');
        }

        const [[newPlayer]] = await conn.execute('SELECT * FROM players WHERE id = ?', [playerIn]);
        if (!newPlayer) throw new Error('New player not found');

        const [[currentPlayer]] = await conn.execute('SELECT * FROM players WHERE id = ?', [playerOut]);

        const priceDiff = newPlayer.price - currentPlayer.price;
        if (priceDiff > team.bank) throw new Error('Not enough funds for this transfer');

        const [[{ position_in_team }]] = await conn.execute(
            'SELECT position_in_team FROM user_players WHERE user_team_id = ? AND player_id = ?',
            [team.id, playerOut]
        );

        await conn.execute(
            'DELETE FROM user_players WHERE user_team_id = ? AND player_id = ?',
            [team.id, playerOut]
        );

        await conn.execute(
            'INSERT INTO user_players (user_team_id, player_id, position_in_team) VALUES (?, ?, ?)',
            [team.id, playerIn, position_in_team]
        );

        const newBank = team.bank - priceDiff;
        const newTransfers = team.wildcard_active ? team.free_transfers : team.free_transfers - 1;

        await conn.execute(
            'UPDATE user_teams SET bank = ?, free_transfers = ? WHERE id = ?',
            [newBank, newTransfers, team.id]
        );

        await conn.execute(
            'INSERT INTO transfer_history (user_id, gameweek, player_out, player_in, cost) VALUES (?, ?, ?, ?, ?)',
            [req.session.user_id, team.current_gameweek, playerOut, playerIn, priceDiff]
        );

        await conn.commit();
        res.json({ success: true, message: 'Transfer completed successfully' });

    } catch (err) {
        await conn.rollback();
        res.json({ success: false, message: 'Error making transfer: ' + err.message });
    }
});

// Get league standings
app.get('/get_league_standings', requireLogin, async (req, res) => {
    const league_id = req.query.league_id;
    if (!league_id) return res.json({ error: 'League ID is required' });

    const conn = await mysql.createConnection(dbConfig);
    const [[league]] = await conn.execute('SELECT * FROM leagues WHERE id = ?', [league_id]);
    if (!league) return res.json({ error: 'League not found' });

    const [standings] = await conn.execute(`
        SELECT u.username, ut.team_name, ul.points, ul.rank
        FROM user_leagues ul
        JOIN users u ON ul.user_id = u.id
        JOIN user_teams ut ON u.id = ut.user_id
        WHERE ul.league_id = ?
        ORDER BY ul.rank ASC
    `, [league_id]);

    res.json({ league, standings });
});

// Get fixtures
app.get('/get_fixtures', async (req, res) => {
    let gameweek = req.query.gameweek;
    const conn = await mysql.createConnection(dbConfig);

    if (!gameweek) {
        const [[settings]] = await conn.execute('SELECT current_gameweek FROM game_settings LIMIT 1');
        gameweek = settings.current_gameweek;
    }

    const [fixtures] = await conn.execute(`
        SELECT f.*, h.name as home_team, a.name as away_team
        FROM fixtures f
        JOIN teams h ON f.home_team_id = h.id
        JOIN teams a ON f.away_team_id = a.id
        WHERE f.gameweek = ?
        ORDER BY f.kickoff_time
    `, [gameweek]);

    res.json({ gameweek, fixtures });
});

// Start server
app.listen(3000, () => {
    console.log('Server is running on port 3000');
});
