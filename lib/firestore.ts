import { FieldValue, Firestore } from "@google-cloud/firestore";

let firestore: Firestore | null = null;

function getFirestore() {
  firestore ??= new Firestore();
  return firestore;
}

type LookupHistoryInput = {
  inputAddress: string;
  landUse: Record<string, unknown>;
  aiSummary: string;
  raw: Record<string, unknown>;
};

export async function saveLandUseLookupHistory(payload: LookupHistoryInput) {
  const db = getFirestore();

  await db.collection("landUseLookups").add({
    inputAddress: payload.inputAddress,
    createdAt: FieldValue.serverTimestamp(),
    landUse: payload.landUse,
    aiSummary: payload.aiSummary,
    raw: payload.raw,
  });
}
