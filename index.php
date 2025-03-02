<?php
// config.php - Database configuration
$db_host = 'localhost';
$db_name = 'fantasy_premier_league';
$db_user = 'fpl_user';
$db_pass = 'root';

$conn = new mysqli($db_host, $db_user, $db_pass, $db_name);

if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}

// auth.php - User authentication functions
session_start();

function isLoggedIn() {
    return isset($_SESSION['user_id']);
}

function requireLogin() {
    if (!isLoggedIn()) {
        header('Location: login.php');
        exit;
    }
}

function loginUser($email, $password) {
    global $conn;
    
    $stmt = $conn->prepare("SELECT id, username, password_hash FROM users WHERE email = ?");
    $stmt->bind_param("s", $email);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows === 1) {
        $user = $result->fetch_assoc();
        if (password_verify($password, $user['password_hash'])) {
            $_SESSION['user_id'] = $user['id'];
            $_SESSION['username'] = $user['username'];
            return true;
        }
    }
    
    return false;
}

function logoutUser() {
    session_unset();
    session_destroy();
}

// get_player_data.php - API endpoint to get player data
header('Content-Type: application/json');
requireLogin();

$user_id = $_SESSION['user_id'];

// Get user's team
$stmt = $conn->prepare("SELECT * FROM user_teams WHERE user_id = ?");
$stmt->bind_param("i", $user_id);
$stmt->execute();
$team_result = $stmt->get_result();
$team = $team_result->fetch_assoc();

if (!$team) {
    echo json_encode(['error' => 'Team not found']);
    exit;
}

// Get players in user's team
$stmt = $conn->prepare("
    SELECT p.*, up.position_in_team 
    FROM user_players up
    JOIN players p ON up.player_id = p.id
    WHERE up.user_team_id = ?
");
$stmt->bind_param("i", $team['id']);
$stmt->execute();
$players_result = $stmt->get_result();

$players = [];
while ($player = $players_result->fetch_assoc()) {
    $players[] = $player;
}

echo json_encode([
    'team' => $team,
    'players' => $players
]);

// make_transfer.php - API endpoint to make transfers
header('Content-Type: application/json');
requireLogin();

// Get POST data
$data = json_decode(file_get_contents('php://input'), true);

if (!isset($data['playerOut']) || !isset($data['playerIn'])) {
    echo json_encode(['success' => false, 'message' => 'Missing required parameters']);
    exit;
}

$player_out_id = $data['playerOut'];
$player_in_id = $data['playerIn'];
$user_id = $_SESSION['user_id'];

// Get user's team
$stmt = $conn->prepare("SELECT * FROM user_teams WHERE user_id = ?");
$stmt->bind_param("i", $user_id);
$stmt->execute();
$team_result = $stmt->get_result();
$team = $team_result->fetch_assoc();

if (!$team) {
    echo json_encode(['success' => false, 'message' => 'Team not found']);
    exit;
}

// Check if player is in user's team
$stmt = $conn->prepare("
    SELECT * FROM user_players 
    WHERE user_team_id = ? AND player_id = ?
");
$stmt->bind_param("ii", $team['id'], $player_out_id);
$stmt->execute();
$player_result = $stmt->get_result();

if ($player_result->num_rows === 0) {
    echo json_encode(['success' => false, 'message' => 'Player not in team']);
    exit;
}

// Check if user has enough transfers
if ($team['free_transfers'] < 1 && $team['wildcard_active'] == 0) {
    echo json_encode(['success' => false, 'message' => 'No free transfers available']);
    exit;
}

// Get new player details
$stmt = $conn->prepare("SELECT * FROM players WHERE id = ?");
$stmt->bind_param("i", $player_in_id);
$stmt->execute();
$new_player_result = $stmt->get_result();
$new_player = $new_player_result->fetch_assoc();

if (!$new_player) {
    echo json_encode(['success' => false, 'message' => 'New player not found']);
    exit;
}

// Get current player details
$stmt = $conn->prepare("SELECT * FROM players WHERE id = ?");
$stmt->bind_param("i", $player_out_id);
$stmt->execute();
$current_player_result = $stmt->get_result();
$current_player = $current_player_result->fetch_assoc();

// Check team budget
$price_difference = $new_player['price'] - $current_player['price'];
if ($price_difference > $team['bank']) {
    echo json_encode(['success' => false, 'message' => 'Not enough funds for this transfer']);
    exit;
}

// Begin transaction
$conn->begin_transaction();

try {
    // Remove old player
    $stmt = $conn->prepare("
        DELETE FROM user_players 
        WHERE user_team_id = ? AND player_id = ?
    ");
    $stmt->bind_param("ii", $team['id'], $player_out_id);
    $stmt->execute();
    
    // Add new player
    $position = $player_result->fetch_assoc()['position_in_team'];
    $stmt = $conn->prepare("
        INSERT INTO user_players (user_team_id, player_id, position_in_team)
        VALUES (?, ?, ?)
    ");
    $stmt->bind_param("iii", $team['id'], $player_in_id, $position);
    $stmt->execute();
    
    // Update team budget and transfers
    $new_bank = $team['bank'] - $price_difference;
    $free_transfers = $team['wildcard_active'] ? $team['free_transfers'] : $team['free_transfers'] - 1;
    
    $stmt = $conn->prepare("
        UPDATE user_teams 
        SET bank = ?, free_transfers = ? 
        WHERE id = ?
    ");
    $stmt->bind_param("dii", $new_bank, $free_transfers, $team['id']);
    $stmt->execute();
    
    // Log transfer
    $stmt = $conn->prepare("
        INSERT INTO transfer_history (user_id, gameweek, player_out, player_in, cost)
        VALUES (?, ?, ?, ?, ?)
    ");
    $current_gameweek = $team['current_gameweek'];
    $stmt->bind_param("iiiid", $user_id, $current_gameweek, $player_out_id, $player_in_id, $price_difference);
    $stmt->execute();
    
    $conn->commit();
    echo json_encode(['success' => true, 'message' => 'Transfer completed successfully']);
    
} catch (Exception $e) {
    $conn->rollback();
    echo json_encode(['success' => false, 'message' => 'Error making transfer: ' . $e->getMessage()]);
}

// get_league_standings.php - Get league standings
header('Content-Type: application/json');
requireLogin();

$user_id = $_SESSION['user_id'];
$league_id = $_GET['league_id'] ?? null;

if (!$league_id) {
    echo json_encode(['error' => 'League ID is required']);
    exit;
}

// Get league details
$stmt = $conn->prepare("
    SELECT * FROM leagues WHERE id = ?
");
$stmt->bind_param("i", $league_id);
$stmt->execute();
$league_result = $stmt->get_result();
$league = $league_result->fetch_assoc();

if (!$league) {
    echo json_encode(['error' => 'League not found']);
    exit;
}

// Get standings
$stmt = $conn->prepare("
    SELECT u.username, ut.team_name, ul.points, ul.rank
    FROM user_leagues ul
    JOIN users u ON ul.user_id = u.id
    JOIN user_teams ut ON u.id = ut.user_id
    WHERE ul.league_id = ?
    ORDER BY ul.rank ASC
");
$stmt->bind_param("i", $league_id);
$stmt->execute();
$standings_result = $stmt->get_result();

$standings = [];
while ($row = $standings_result->fetch_assoc()) {
    $standings[] = $row;
}

echo json_encode([
    'league' => $league,
    'standings' => $standings
]);

// get_fixtures.php - Get upcoming fixtures
header('Content-Type: application/json');

$gameweek = $_GET['gameweek'] ?? null;

if (!$gameweek) {
    // Get current gameweek
    $stmt = $conn->prepare("
        SELECT current_gameweek FROM game_settings LIMIT 1
    ");
    $stmt->execute();
    $result = $stmt->get_result();
    $settings = $result->fetch_assoc();
    $gameweek = $settings['current_gameweek'];
}

// Get fixtures for the gameweek
$stmt = $conn->prepare("
    SELECT f.*, h.name as home_team, a.name as away_team
    FROM fixtures f
    JOIN teams h ON f.home_team_id = h.id
    JOIN teams a ON f.away_team_id = a.id
    WHERE f.gameweek = ?
    ORDER BY f.kickoff_time
");
$stmt->bind_param("i", $gameweek);
$stmt->execute();
$fixtures_result = $stmt->get_result();

$fixtures = [];
while ($fixture = $fixtures_result->fetch_assoc()) {
    $fixtures[] = $fixture;
}

echo json_encode([
    'gameweek' => $gameweek,
    'fixtures' => $fixtures
]);

