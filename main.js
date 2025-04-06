import { db } from "./firebaseConfig.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";

// Function to Fetch Players from Firestore
async function fetchPlayers() {
  const playersRef = collection(db, "players");
  const querySnapshot = await getDocs(playersRef);
  const pitchContainer = document.querySelector(".pitch"); // Target the pitch div

  let playerHTML = "";
  querySnapshot.forEach((doc) => {
    const player = doc.data();
    playerHTML += `
      <div class="player">
        <img src="${player.imageUrl}" alt="${player.name}">
        <span>${player.name}</span>
      </div>
    `;
  });

  pitchContainer.innerHTML = playerHTML; // Insert players into the pitch
}

fetchPlayers(); // Load players when the page loads
