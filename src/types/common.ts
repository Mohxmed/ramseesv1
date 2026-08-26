export type Timestamp = {
  createdAt: Date;
  updatedAt: Date;
};

export type FirestoreDocument<T> = T & {
  id: string;
} & Timestamp;

export type Currency = "BTC";

export type AppState = "idle" | "loading" | "error" | "success";
