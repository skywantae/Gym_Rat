/**
 * GymRat - Firebase Cloud Firestore 하이브리드 동기화 모듈 (방법 C)
 * - 개인 고유 동기화 코드(아이디 + PIN)를 SHA-256 해시 키로 변환하여 gymrat_sync_vault 컬렉션에 스냅샷 저장
 * - WebChannel 오프라인 지연 오류(client is offline) 원천 차단을 위해 Firestore v1 Native REST 엔드포인트 직결 (응답 속도 0.1~0.2초)
 */

import { GymRatStorage } from "./storage.js";

export const firebaseConfig = {
    apiKey: "AIzaSyC8dwhj8BxXsueukxOIxJgruHANJitJJ2I",
    authDomain: "gymrat-sync-2026.firebaseapp.com",
    projectId: "gymrat-sync-2026",
    storageBucket: "gymrat-sync-2026.firebasestorage.app",
    messagingSenderId: "219618632405",
    appId: "1:219618632405:web:df160301de35519080b85c"
};

const COLLECTION_NAME = "gymrat_sync_vault";
const FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/${COLLECTION_NAME}`;

const ACTIVE_SYNC_KEY = "gymrat_active_sync_key";
const ACTIVE_SYNC_NICKNAME = "gymrat_active_sync_nickname";
const LAST_SYNC_TIME_KEY = "gymrat_last_sync_timestamp";

/**
 * JS 데이터를 Firestore Native Document Field 포맷으로 변환합니다.
 */
function toFirestoreValue(val) {
    if (val === null || val === undefined) return { nullValue: null };
    if (typeof val === "boolean") return { booleanValue: val };
    if (typeof val === "number") {
        if (!Number.isFinite(val)) return { doubleValue: 0 };
        return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
    }
    if (typeof val === "string") return { stringValue: val };
    if (Array.isArray(val)) {
        return { arrayValue: { values: val.map(toFirestoreValue) } };
    }
    if (typeof val === "object") {
        const fields = {};
        for (const [k, v] of Object.entries(val)) {
            if (v !== undefined) {
                fields[k] = toFirestoreValue(v);
            }
        }
        return { mapValue: { fields } };
    }
    return { stringValue: String(val) };
}

/**
 * Firestore Native Document Field 포맷을 일반 JS 객체로 복원합니다.
 */
function fromFirestoreValue(fv) {
    if (!fv || typeof fv !== "object") return null;
    if ("nullValue" in fv) return null;
    if ("booleanValue" in fv) return Boolean(fv.booleanValue);
    if ("integerValue" in fv) return Number(fv.integerValue);
    if ("doubleValue" in fv) return Number(fv.doubleValue);
    if ("stringValue" in fv) return String(fv.stringValue);
    if ("arrayValue" in fv) {
        return (fv.arrayValue.values || []).map(fromFirestoreValue);
    }
    if ("mapValue" in fv) {
        const out = {};
        const fields = fv.mapValue.fields || {};
        for (const [k, v] of Object.entries(fields)) {
            out[k] = fromFirestoreValue(v);
        }
        return out;
    }
    return null;
}

async function fetchFirestoreDoc(syncKey) {
    const url = `${FIRESTORE_BASE_URL}/${encodeURIComponent(syncKey)}?key=${encodeURIComponent(firebaseConfig.apiKey)}`;
    const res = await fetch(url, {
        method: "GET",
        headers: { "Accept": "application/json" },
        cache: "no-store"
    });
    if (res.status === 404) {
        return { exists: false, data: null };
    }
    if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error((errBody.error && errBody.error.message) || `서버 응답 오류 (${res.status})`);
    }
    const rawDoc = await res.json();
    const data = fromFirestoreValue({ mapValue: { fields: rawDoc.fields || {} } });
    return { exists: true, data };
}

async function saveFirestoreDoc(syncKey, payload) {
    const url = `${FIRESTORE_BASE_URL}/${encodeURIComponent(syncKey)}?key=${encodeURIComponent(firebaseConfig.apiKey)}`;
    const encoded = toFirestoreValue(payload);
    const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: encoded.mapValue.fields })
    });
    if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error((errBody.error && errBody.error.message) || `클라우드 저장 오류 (${res.status})`);
    }
    return true;
}

export class FirebaseSyncService {
    /**
     * 아이디와 PIN 번호를 조합하여 고유한 SHA-256 해시 키를 생성합니다.
     */
    static async generateSyncKey(nickname, pin) {
        const cleanNick = String(nickname || "").trim().toLowerCase();
        const cleanPin = String(pin || "").trim();
        if (!cleanNick || cleanPin.length < 4) {
            throw new Error("아이디와 4자리 이상의 PIN 번호를 입력해주세요.");
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
        const currentKey = localStorage.getItem(ACTIVE_SYNC_KEY);
        if (currentKey) {
            GymRatStorage.saveSlotSnapshot(currentKey);
        }
        GymRatStorage.resetToCleanUserWorkspace();
        localStorage.removeItem(ACTIVE_SYNC_KEY);
        localStorage.removeItem(ACTIVE_SYNC_NICKNAME);
        localStorage.removeItem(LAST_SYNC_TIME_KEY);
    }

    /**
     * 랜딩 페이지에서 아이디 + PIN 입력 시 실행되는 초고속 통합 로그인/자동 가입
     * - 이미 저장된 아이디+PIN이면 즉시 데이터를 불러와 로그인 (RESTORED)
     * - 처음 입력한 아이디+PIN이면 즉시 새 계정을 생성하여 시작 (CREATED)
     */
    static async authenticateWithCloud(nickname, pin) {
        const cleanNickDisplay = String(nickname || "").trim();
        const syncKey = await this.generateSyncKey(cleanNickDisplay, pin);
        const prevInfo = this.getActiveSyncInfo();
        const prevSyncKey = prevInfo.syncKey;

        // 다른 계정에서 전환하거나 로그아웃 후 재진입한 경우 이전 계정과 작업 공간을 완벽 분리
        if (prevSyncKey && prevSyncKey !== syncKey) {
            GymRatStorage.saveSlotSnapshot(prevSyncKey);
            GymRatStorage.resetToCleanUserWorkspace();
        }

        const targetSlot = GymRatStorage.getSlotSnapshot(syncKey);
        if (targetSlot) {
            GymRatStorage.replaceUserDataJson(targetSlot);
        }

        const docResult = await fetchFirestoreDoc(syncKey);

        if (docResult.exists && docResult.data) {
            const mergedResult = GymRatStorage.importUserDataJson(docResult.data);
            const updatedPayload = {
                ...mergedResult,
                syncKey,
                nickname: cleanNickDisplay,
                updatedAt: Date.now()
            };
            await saveFirestoreDoc(syncKey, updatedPayload);
            GymRatStorage.saveSlotSnapshot(syncKey);
            this.setActiveSyncInfo(syncKey, cleanNickDisplay);
            return {
                success: true,
                mode: "RESTORED",
                syncKey,
                nickname: cleanNickDisplay,
                recordsCount: updatedPayload.weightRecords.length,
                updatedAt: updatedPayload.updatedAt
            };
        } else {
            const localExport = GymRatStorage.exportUserDataJson();
            const now = Date.now();
            const payload = {
                ...localExport,
                syncKey,
                nickname: cleanNickDisplay,
                createdAt: now,
                updatedAt: now
            };
            await saveFirestoreDoc(syncKey, payload);
            GymRatStorage.saveSlotSnapshot(syncKey);
            this.setActiveSyncInfo(syncKey, cleanNickDisplay);
            return {
                success: true,
                mode: "CREATED",
                syncKey,
                nickname: cleanNickDisplay,
                recordsCount: payload.weightRecords.length,
                updatedAt: payload.updatedAt
            };
        }
    }

    /**
     * 현재 기기의 전체 데이터를 클라우드에 즉시 백업합니다.
     */
    static async backupToCloud(nickname, pin) {
        const cleanNickDisplay = String(nickname || "").trim();
        const syncKey = await this.generateSyncKey(cleanNickDisplay, pin);

        const localExport = GymRatStorage.exportUserDataJson();
        const payload = {
            ...localExport,
            syncKey,
            nickname: cleanNickDisplay,
            updatedAt: Date.now()
        };

        await saveFirestoreDoc(syncKey, payload);
        GymRatStorage.saveSlotSnapshot(syncKey);
        this.setActiveSyncInfo(syncKey, cleanNickDisplay);
        return {
            success: true,
            syncKey,
            recordsCount: payload.weightRecords.length,
            updatedAt: payload.updatedAt
        };
    }

    /**
     * 클라우드에서 데이터를 조회하여 로컬 데이터와 무손실 병합합니다.
     */
    static async restoreFromCloud(nickname, pin) {
        const cleanNickDisplay = String(nickname || "").trim();
        const syncKey = await this.generateSyncKey(cleanNickDisplay, pin);
        const prevInfo = this.getActiveSyncInfo();
        if (prevInfo.syncKey && prevInfo.syncKey !== syncKey) {
            GymRatStorage.saveSlotSnapshot(prevInfo.syncKey);
            GymRatStorage.resetToCleanUserWorkspace();
        }

        const docResult = await fetchFirestoreDoc(syncKey);
        if (!docResult.exists || !docResult.data) {
            throw new Error("해당 아이디와 PIN으로 저장된 데이터가 없습니다. [클라우드에 백업] 또는 랜딩 화면에서 시작하기를 눌러주세요.");
        }

        const mergedResult = GymRatStorage.importUserDataJson(docResult.data);
        const updatedPayload = {
            ...mergedResult,
            syncKey,
            nickname: cleanNickDisplay,
            updatedAt: Date.now()
        };
        await saveFirestoreDoc(syncKey, updatedPayload);

        GymRatStorage.saveSlotSnapshot(syncKey);
        this.setActiveSyncInfo(syncKey, cleanNickDisplay);
        return {
            success: true,
            syncKey,
            recordsCount: updatedPayload.weightRecords.length,
            updatedAt: updatedPayload.updatedAt
        };
    }

    /**
     * 로그인된 상태에서 기록 변경 시 백그라운드에서 즉시 클라우드에 자동 저장합니다.
     */
    static async autoSyncIfActive() {
        const { syncKey, nickname } = this.getActiveSyncInfo();
        if (!syncKey || !nickname) return;
        try {
            GymRatStorage.saveSlotSnapshot(syncKey);
            const localExport = GymRatStorage.exportUserDataJson();
            const payload = {
                ...localExport,
                syncKey,
                nickname,
                updatedAt: Date.now()
            };
            await saveFirestoreDoc(syncKey, payload);
            localStorage.setItem(LAST_SYNC_TIME_KEY, String(Date.now()));
        } catch {
            // 오프라인 상태일 경우 로컬 슬롯에 안전하게 보존됨
        }
    }
}
