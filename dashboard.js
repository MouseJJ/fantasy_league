import { db, auth } from "./firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

document.addEventListener("DOMContentLoaded", () => {
    const authButtons = document.querySelector(".auth-buttons");
    const logoutBtn = document.getElementById("logout-btn");
    const pitch = document.querySelector(".pitch");

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            console.log("✅ User logged in:", user.uid);

            // Hide login/signup, show logout
            if (authButtons) authButtons.style.display = "none";
            if (logoutBtn) logoutBtn.style.display = "block";

            await loadTeam(user.uid);
        } else {
            console.log("❌ No user logged in.");

            // Show login/signup, hide logout
            if (authButtons) authButtons.style.display = "block";
            if (logoutBtn) logoutBtn.style.display = "none";
        }
    });

    // Logout functionality
    if (logoutBtn) {
        logoutBtn.addEventListener("click", async () => {
            try {
                await signOut(auth);
                console.log("👋 Logged out successfully!");
                window.location.href = "login.html"; // Redirect to login page
            } catch (error) {
                console.error("❌ Logout failed:", error);
            }
        });
    }
});
// ✅ Fetch and display the user's team from Firestore
async function loadTeam(userId) {
    const pitch = document.querySelector(".pitch");
    if (!pitch) return console.error("❌ Pitch container not found!");

    try {
        const teamRef = doc(db, "teams", userId);
        const teamSnap = await getDoc(teamRef);

        if (!teamSnap.exists()) {
            console.warn("⚠ No team found for this user.");
            pitch.innerHTML = "<p>No team data available.</p>";
            return;
        }

        const teamData = teamSnap.data();
        const players = teamData.players || [];

        // Clear existing players
        pitch.innerHTML = "";

        // Position mapping
        const positions = {
            "Goalkeeper": [],
            "Defender": [],
            "Midfielder": [],
            "Forward": []
        };

        // Sort players into positions
        players.forEach(player => {
            if (positions[player.position]) {
                positions[player.position].push(player);
            }
        });

        // Render players in respective positions
        pitch.innerHTML = `
            <div class="goalkeeper">${createPlayerHTML(positions.Goalkeeper)}</div>
            <div class="defenders">${createPlayerHTML(positions.Defender)}</div>
            <div class="midfielders">${createPlayerHTML(positions.Midfielder)}</div>
            <div class="forwards">${createPlayerHTML(positions.Forward)}</div>
        `;

        console.log("✅ Team loaded successfully!", players);
    } catch (error) {
        console.error("❌ Error fetching team data:", error);
        pitch.innerHTML = "<p>Error loading team.</p>";
    }
}

// 🎨 Helper function to generate player HTML
function createPlayerHTML(players) {
    return players.map(player => `
        <div class="player">
            <img src="${player.imageUrl || 'default-player.png'}" alt="${player.name}">
            <span>${player.name}</span>
            <span>${player.position}</span>
        </div>
    `).join("");
}
