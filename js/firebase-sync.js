/**
 * GymRat - Firebase Cloud Firestore 하이브리드 동기화 모듈 (방법 C)
 * - 개인 고유 동기화 코드(닉네임 + PIN)를 SHA-256 해시 키로 변환하여 gymrat_sync_vault 컬렉션에 스냅샷 저장
 * - 기기 변경 시 코드 한 줄로 기존 기록을 100% 무손실 병합(Merge) 복원
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { GymRatStorage } from "./storage.js";

const firebaseConfig = {
    apiKey: "AIzaSyC8dwhj8BxXsueukxOIxJgruHANJitJJ2I",
    authDomain: "gymrat-sync-2026.firebaseapp.com",
    projectId: "gymrat-sync-2026",
    storageBucket: "gymrat-sync-2026.firebasestorage.app",
    messagingSenderId: "219618632405",
    appId: "1:219618632405:web:df160301de35519080b85c"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const COLLECTION_NAME = "gymrat_sync_vault";
const ACTIVE_SYNC_KEY = "gymrat_active_sync_key";
const ACTIVE_SYNC_NICKNAME = "gymrat_active_sync_nickname";
const LAST_SYNC_TIME_KEY = "gymrat_last_sync_timestamp";

export class FirebaseSyncService {
    /**
     * 닉네임과 PIN 번호를 조합하여 고유한 SHA-256 해시 키를 생성합니다.
     */
    static async generateSyncKey(nickname, pin) {
        const cleanNick = String(nickname || "").trim().toLowerCase();
        const cleanPin = String(pin || "").trim();
        if (!cleanNick || cleanPin.length < 4) {
            throw new Error("닉네임과 4자리 이상의 PIN 번호를 입력해주세요.");
        }
        const text = `gymrat_v1:${cleanNick}:${cleanPin}`;
        const encoder = new TextEncoder();
        const data = encoder.encode(text);
        const hashBuffer = await crypto.subtle.digest("SHA-256", data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
        return hashHex;
    }

    static getActiveSyncInfo() {
        return {
            syncKey: localStorage.getItem(ACTIVE_SYNC_KEY) || null,
            nickname: localStorage.getItem(ACTIVE_SYNC_NICKNAME) || null,
            lastSyncTimestamp: parseInt(localStorage.getItem(LAST_SYNC_TIME_KEY), 10) || null
        };
    }

    static setActiveSyncInfo(syncKey, nickname) {
        localStorage.setItem(ACTIVE_SYNC_KEY, syncKey);
        localStorage.setItem(ACTIVE_SYNC_NICKNAME, nickname);
        localStorage.setItem(LAST_SYNC_TIME_KEY, String(Date.now()));
    }

    static clearActiveSyncInfo() {
        localStorage.removeItem(ACTIVE_SYNC_KEY);
        localStorage.removeItem(ACTIVE_SYNC_NICKNAME);
        localStorage.removeItem(LAST_SYNC_TIME_KEY);
    }

    /**
     * 현재 로컬 기기의 전체 데이터(프로필, 체성분, 식단, 운동, 체크리스트)를 클라우드에 백업합니다.
     */
    static async backupToCloud(nickname, pin) {
        const syncKey = await this.generateSyncKey(nickname, pin);
        const docRef = doc(db, COLLECTION_NAME, syncKey);

        const localExport = GymRatStorage.exportUserDataJson();
        const payload = {
            ...localExport,
            syncKey,
            nickname: String(nickname).trim(),
            updatedAt: Date.now()
        };

        await setDoc(docRef, payload, { merge: true });
        this.setActiveSyncInfo(syncKey, nickname);
        return {
            success: true,
            syncKey,
            recordsCount: payload.weightRecords.length,
            updatedAt: payload.updatedAt
        };
    }

    /**
     * 클라우드에서 스냅샷을 조회하여 로컬 데이터와 무손실 병합합니다.
     */
    static async restoreFromCloud(nickname, pin) {
        const syncKey = await this.generateSyncKey(nickname, pin);
        const docRef = doc(db, COLLECTION_NAME, syncKey);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            throw new Error("해당 닉네임과 PIN으로 저장된 클라우드 백업이 없습니다. [클라우드에 백업]을 먼저 실행해주세요.");
        }

        const cloudData = docSnap.data();

        // 로컬 데이터와 클라우드 데이터 병합
        const mergedResult = GymRatStorage.importUserDataJson(cloudData);

        // 양방향 일치를 위해 병합된 최종 데이터를 클라우드에도 즉시 갱신
        const updatedPayload = {
            ...mergedResult,
            syncKey,
            nickname: String(nickname).trim(),
            updatedAt: Date.now()
        };
        await setDoc(docRef, updatedPayload, { merge: true });

        this.setActiveSyncInfo(syncKey, nickname);
        return {
            success: true,
            syncKey,
            recordsCount: updatedPayload.weightRecords.length,
            updatedAt: updatedPayload.updatedAt
        };
    }

    /**
     * 활성화된 동기화 키가 있을 경우 백그라운드에서 조용히 자동 백업을 수행합니다.
     */
    static async autoSyncIfActive() {
        const { syncKey, nickname } = this.getActiveSyncInfo();
        if (!syncKey || !nickname) return;
        try {
            const docRef = doc(db, COLLECTION_NAME, syncKey);
            const localExport = GymRatStorage.exportUserDataJson();
            const payload = {
                ...localExport,
                syncKey,
                nickname,
                updatedAt: Date.now()
            };
            await setDoc(docRef, payload, { merge: true });
            localStorage.setItem(LAST_SYNC_TIME_KEY, String(Date.now()));
        } catch {
            // 오프라인이거나 네트워크 오류 시 무시 (로컬 저장이 우선)
        }
    }
}
