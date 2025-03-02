
// Import Firebase libraries
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, createUserWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
  // ✅ Firebase Configuration
  const firebaseConfig = {
    apiKey: "AIzaSyB96ev-OgmcaFQqi8KPWOCPzIQevCx7KRY",
    authDomain: "fantasy-league-31c45.firebaseapp.com",
    projectId: "fantasy-league-31c45",
    storageBucket: "fantasy-league-31c45.appspot.com", // 🔹 Fixed the storageBucket URL
    messagingSenderId: "490090007262",
    appId: "1:490090007262:web:bb8076d6c8f32b364f504f",
    measurementId: "G-QP1EJ07V7M"
  };

// ✅ Initialize Firebase
const app = initializeApp(firebaseConfig);
// ✅ Initialize Authentication
const auth = getAuth(app);
function signup() {
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;

    createUserWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
            let user = userCredential.user;
            alert('Signup successful! Welcome ' + user.email);
        })
        .catch(error => {
            alert(error.message); 
        });
}
