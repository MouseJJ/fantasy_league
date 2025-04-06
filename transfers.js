import { db } from "./firebase-config.js";
import { 
    collection, doc, getDoc, getDocs, 
    updateDoc, setDoc, deleteDoc,arrayRemove, arrayUnion
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const userId = "gljFEwTMb6bksVuBdeNeLv1x2Hz1"; // Replace with actual user ID

const teamPlayersList = document.getElementById("teamPlayersList");
const availablePlayersList = document.getElementById("availablePlayersList");
const budgetInfo = document.getElementById("budgetInfo");
const transferButton = document.getElementById("transferButton");

let budget = 100.5; // Default, will be fetched from Firebase
let teamPlayers = [];
let availablePlayers = [];

let selectedOutPlayer = null;
let selectedInPlayer = null;

// 🔄 Fetch and Display Available Transfer Players
async function setupTransferMarket() {
    availablePlayersList.innerHTML = "";

    try {
        const querySnapshot = await getDocs(collection(db, "transfers"));
        availablePlayers = [];
        
        querySnapshot.forEach((doc) => {
            let player = { id: doc.id, ...doc.data() };
            availablePlayers.push(player);
        });

        renderPlayers(availablePlayersList, availablePlayers, false);
        console.log("✅ Available players loaded successfully!");
    } catch (error) {
        console.error("❌ Error fetching transfers:", error);
    }
}



// 🔄 Fetch and Display User's Team from Players Collection
async function getMyTeam() {
    console.log("Fetching team players from 'teams' collection...");

    try {
        const teamRef = doc(db, "teams", userId);
        const teamSnap = await getDoc(teamRef);

        if (!teamSnap.exists()) {
            console.error("❌ Error: Team data not found for this user.");
            return;
        }

        const teamData = teamSnap.data();
        teamPlayers = teamData.players || []; // Ensure players array exists

        console.log("✅ Team players loaded successfully!", teamPlayers);
        renderPlayers(teamPlayersList, teamPlayers, true); // Render team players
    } catch (error) {
        console.error("❌ Error fetching team players:", error);
    }
}

// 🔄 Fetch All Players & Show Those Not in Team
async function getAvailablePlayers() {
    const playersSnap = await getDocs(collection(db, "players"));
    
    let allPlayers = [];
    playersSnap.forEach(doc => {
        let playerData = { id: doc.id, ...doc.data() };
        allPlayers.push(playerData);
    });

    // Show only players NOT in the team
    availablePlayers = allPlayers.filter(player => 
        !teamPlayers.some(teamPlayer => teamPlayer.id === player.id)
    );

    renderPlayers(availablePlayersList, availablePlayers, false);
}

// 🎨 Render Players List
function renderPlayers(container, players, isTeam) {
    container.innerHTML = "";
    players.forEach(player => {
        let playerCard = document.createElement("div");
        playerCard.classList.add("player-card");
        playerCard.dataset.playerId = player.id;
        playerCard.innerHTML = `
            <h3>${player.name}</h3>
            <p>${player.position}</p>
            <p>${player.club}</p>
            <p class='player-value'>£${player.value}m</p>
        `;
        container.appendChild(playerCard);

        // Add click event for selecting players
        playerCard.addEventListener("click", () => {
            document.querySelectorAll(".player-card").forEach(card => card.classList.remove("selected"));
            playerCard.classList.add("selected");

            if (isTeam) {
                selectedOutPlayer = player;
            } else {
                selectedInPlayer = player;
            }
            checkTransferValidity();
        });
    });
}

// ✅ Validate Transfer
function checkTransferValidity() {
    if (selectedOutPlayer && selectedInPlayer && (budget + selectedOutPlayer.value >= selectedInPlayer.value)) {
        transferButton.disabled = false;
    } else {
        transferButton.disabled = true;
    }
}

// 🔄 Handle Transfer Action
transferButton.addEventListener("click", async () => {
    if (selectedOutPlayer && selectedInPlayer) {
        try {
            console.log("🔄 Processing Transfer...");
            console.log("Outgoing Player ID:", selectedOutPlayer.id);
            console.log("Incoming Player ID:", selectedInPlayer.id);

            // Ensure incoming player ID is a string
            selectedInPlayer.id = String(selectedInPlayer.id);

            // Reference to the user's team document
            const teamRef = doc(db, "teams", userId);
            const teamSnap = await getDoc(teamRef);

            if (!teamSnap.exists()) {
                console.error("❌ Error: User team not found in 'teams' collection.");
                return;
            }

            let teamData = teamSnap.data();
            let teamPlayers = teamData.players || [];
            let budget = teamData.budget || 100; // Default if missing

            // ✅ Step 1: Ensure Outgoing Player Exists in Team
            let playerIndex = teamPlayers.findIndex(player => player.id === selectedOutPlayer.id);
            if (playerIndex === -1) {
                console.error("❌ Error: Outgoing player not found in user's team.");
                return;
            }

            // ✅ Step 2: Ensure Budget is Sufficient
            let newBudget = budget + selectedOutPlayer.value - selectedInPlayer.value;
            if (newBudget < 0) {
                console.error("❌ Error: Insufficient budget.");
                alert("❌ Not enough budget for this transfer.");
                return;
            }

            // ✅ Step 3: Remove Outgoing Player from Team
            await updateDoc(teamRef, {
                players: arrayRemove(selectedOutPlayer)
            });

            // ✅ Step 4: Add Incoming Player to Team
            await updateDoc(teamRef, {
                players: arrayUnion(selectedInPlayer),
                budget: newBudget
            });

            console.log("✅ Transfer completed successfully!");

            // ✅ Update UI Budget
            budgetInfo.innerHTML = `Budget Remaining: <strong>£${newBudget.toFixed(1)}m</strong>`;

            // ✅ Refresh Data
            await getMyTeam(); // Reload team players
            await getAvailablePlayers(); // Reload available players

            alert("🎉 Transfer successful!");
        } catch (error) {
            console.error("❌ Error processing transfer:", error);
        }
    }
});


// 🔄 Load Data on Page Load
getMyTeam();
getAvailablePlayers();
setupTransferMarket();
