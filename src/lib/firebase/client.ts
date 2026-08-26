import { getFirestore, type Firestore } from "firebase/firestore";
import { app } from "./config";

let db: Firestore;

if (typeof window !== "undefined") {
  db = getFirestore(app);
}

export function getDb(): Firestore {
  if (typeof window === "undefined") {
    throw new Error("Firestore can only be accessed on the client side.");
  }
  return db;
}
