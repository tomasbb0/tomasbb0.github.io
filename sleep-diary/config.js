// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyB2S_kUQmNBcSDX19nC3LN2G7trPnBqNGw",
    authDomain: "sleep-diary-5b72f.firebaseapp.com",
    projectId: "sleep-diary-5b72f",
    storageBucket: "sleep-diary-5b72f.firebasestorage.app",
    messagingSenderId: "358310065752",
    appId: "1:358310065752:web:0f3a5d5870dfe91a34fc2d"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Enable offline persistence
db.enablePersistence().catch((err) => {
    console.log('Offline persistence not available:', err.code);
});
