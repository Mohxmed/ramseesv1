import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  type DocumentData,
  type QueryConstraint,
} from "firebase/firestore";
import { getDb } from "./client";

export const COLLECTIONS = {
  users: "users",
  goldenTargets: "goldenTargets",
  bitcoin: "bitcoin",
} as const;

export type CollectionPath = keyof typeof COLLECTIONS;

export async function getDocument<T extends DocumentData>(
  collectionPath: CollectionPath,
  documentId: string
): Promise<T | null> {
  const db = getDb();
  const docRef = doc(db, collectionPath, documentId);
  const snapshot = await getDoc(docRef);

  if (!snapshot.exists()) {
    return null;
  }

  return { id: snapshot.id, ...snapshot.data() } as unknown as T;
}

export async function getCollection<T extends DocumentData>(
  collectionPath: CollectionPath,
  constraints: QueryConstraint[] = []
): Promise<T[]> {
  const db = getDb();
  const collectionRef = collection(db, collectionPath);
  const q = query(collectionRef, ...constraints);
  const snapshot = await getDocs(q);

  return snapshot.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() }) as unknown as T
  );
}

export async function setDocument<T extends DocumentData>(
  collectionPath: CollectionPath,
  documentId: string,
  data: T
): Promise<void> {
  const db = getDb();
  const docRef = doc(db, collectionPath, documentId);
  await setDoc(docRef, data);
}

export async function updateDocument<T extends DocumentData>(
  collectionPath: CollectionPath,
  documentId: string,
  data: Partial<T>
): Promise<void> {
  const db = getDb();
  const docRef = doc(db, collectionPath, documentId);
  await updateDoc(docRef, data as DocumentData);
}

export async function deleteDocument(
  collectionPath: CollectionPath,
  documentId: string
): Promise<void> {
  const db = getDb();
  const docRef = doc(db, collectionPath, documentId);
  await deleteDoc(docRef);
}
