import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getDatabase } from "firebase/database";
// import { getDatabase, ref, get, child } from "firebase/database";

const config = {
	apiKey: "AIzaSyDKmiM3zd3ErJy6ew4cND5CDN8EhndmBfk",
	authDomain: "bodycam1001.firebaseapp.com",
	databaseURL:
		"https://bodycam1001-default-rtdb.europe-west1.firebasedatabase.app",
	projectId: "bodycam1001",
	storageBucket: "bodycam1001.appspot.com",
	messagingSenderId: "776518623285",
	appId: "1:776518623285:web:6d65e60b879d637e18917c",
	measurementId: "G-3SVN0PQZ4W",
};

export const app = initializeApp(config);
export const auth = getAuth(app);
export const db = getDatabase(app);
await signInWithEmailAndPassword(auth, "fdcdev2024@gmail.com", "A1234567890");
