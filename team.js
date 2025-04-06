// team.js
import { db } from "./firebase-config.js";
import { collection, getDocs, deleteDoc, doc, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Function to fetch and display team players
async function displayMyTeam() {
    const teamContainer = document.querySelector(".pitch");
    teamContainer.innerHTML = ""; // Clear previous players

    const teamRef = collection(db, "my_team");
    const querySnapshot = await getDocs(teamRef);

    querySnapshot.forEach((doc) => {
        const player = doc.data();
        const playerElement = document.createElement("div");
        playerElement.classList.add("player");
        playerElement.innerHTML = `
            <span>${player.name} (${player.position}) - ${player.team}</span>
            <button onclick="transferOut('${doc.id}', '${player.name}')">Transfer Out</button>
        `;
        teamContainer.appendChild(playerElement);
    });
}

// Function to transfer out a player
async function transferOut(playerId, playerName) {
    if (confirm(`Are you sure you want to transfer out ${playerName}?`)) {
        await deleteDoc(doc(db, "my_team", playerId));
        alert(`${playerName} has been transferred out.`);
        displayMyTeam(); // Refresh UI
    }
}

// Load team on page load
window.onload = displayMyTeam;
