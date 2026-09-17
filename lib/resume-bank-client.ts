"use client";

export type ResumeProfile = "manual-testing" | "software-developer" | "technical-support";

type StoredResume = {
  profile: ResumeProfile;
  name: string;
  type: string;
  lastModified: number;
  blob: Blob;
  updatedAt: number;
};

const DB_NAME = "vip-hunter-resume-bank";
const STORE = "resumes";
const VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "profile" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Unable to open the resume bank."));
  });
}

export async function saveResumeProfile(profile: ResumeProfile, file: File) {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put({
        profile,
        name: file.name,
        type: file.type || "application/octet-stream",
        lastModified: file.lastModified || Date.now(),
        blob: file.slice(0, file.size, file.type || "application/octet-stream"),
        updatedAt: Date.now(),
      } satisfies StoredResume);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error("Unable to save the resume."));
      tx.onabort = () => reject(tx.error || new Error("Unable to save the resume."));
    });
  } finally {
    db.close();
  }
}

export async function loadResumeProfile(profile: ResumeProfile): Promise<File | null> {
  const db = await openDb();
  try {
    const row = await new Promise<StoredResume | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const request = tx.objectStore(STORE).get(profile);
      request.onsuccess = () => resolve(request.result as StoredResume | undefined);
      request.onerror = () => reject(request.error || new Error("Unable to load the saved resume."));
    });

    if (!row) return null;
    return new File([row.blob], row.name, {
      type: row.type || "application/octet-stream",
      lastModified: row.lastModified || row.updatedAt || Date.now(),
    });
  } finally {
    db.close();
  }
}

export async function removeResumeProfile(profile: ResumeProfile) {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(profile);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error("Unable to remove the saved resume."));
      tx.onabort = () => reject(tx.error || new Error("Unable to remove the saved resume."));
    });
  } finally {
    db.close();
  }
}
