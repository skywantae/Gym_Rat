/**
 * GymRat - LocalStorage 영구 저장소 & 데이터 무결성 보존 레이어
 * - 업데이트 시에도 기존 기록이 절대 삭제되거나 초기화되지 않도록 이중 백업 병합(Merge) 적용
 */

import { getLocalDateString } from "./calculator.js";

const STORAGE_KEYS = {
    PROFILE: "gymrat_user_profile_v1",
    PROFILE_BACKUP: "gymrat_user_profile_backup",
    CUSTOM_ROUTINES: "gymrat_custom_routines_v1",
    CUSTOM_ROUTINES_BACKUP: "gymrat_custom_routines_backup",
    WEIGHT_RECORDS: "gymrat_weight_records_v1",
    WEIGHT_RECORDS_BACKUP: "gymrat_weight_records_backup",
    DIET_RECORDS: "gymrat_diet_records_v1",
    WORKOUT_RECORDS: "gymrat_workout_records_v1",
    DAILY_CHECKLISTS: "gymrat_daily_checklists_v1"
};

export const DEFAULT_USER_PROFILE = {
    gender: "MALE",
    age: 32,
    heightCm: 184.0,
    startWeightKg: 104.40,
    currentWeightKg: 104.40,
    targetWeightKg: 90.0,
    startSkeletalMuscleKg: 42.80,
    minTargetSkeletalMuscleKg: 41.0,
    startBodyFatPercent: 28.6,
    targetBodyFatPercent: 19.5,
    occupationCode: "OFFICE_IT",
    workPostureCode: "MOSTLY_SITTING",
    dailyWorkHours: 8.0,
    weeklyWorkDays: 5,
    weeklyWorkoutTargetDays: 4,
    dailyTargetCalories: 2250,
    dailyTargetProteinG: 160,
    dailyTargetCarbsG: 210,
    dailyTargetFatG: 85,
    dailyTargetWaterMl: 2800
};

/**
 * 사용자의 식습관을 기반으로 아침·점심·고정음료 칼로리를 쉽게 어림 계산할 수 있는 프리셋 카탈로그
 */
export const HabitMealCatalog = {
    BREAKFAST_PRESETS: [
        {
            code: "BF_EGG3_APPLE1_SHAKE",
            label: "계란 3개 + 사과 1개 + 단백질 쉐이크 1스쿱",
            detail: "훈제/삶은 계란 3알(210kcal) + 사과 1개(110kcal) + 단백질 쉐이크(160kcal)",
            caloriesKcal: 480,
            proteinG: 40,
            carbsG: 32,
            fatG: 18
        },
        {
            code: "BF_EGG3_APPLE1",
            label: "계란 3개 + 사과 1개 (쉐이크 제외)",
            detail: "훈제/삶은 계란 3알(210kcal) + 사과 1개(110kcal)",
            caloriesKcal: 320,
            proteinG: 19,
            carbsG: 30,
            fatG: 15
        },
        {
            code: "BF_EGG2_BANANA_SOY",
            label: "계란 2개 + 바나나 1개 + 무가당 두유",
            detail: "계란 2알(140kcal) + 바나나 1개(105kcal) + 두유 1팩(95kcal)",
            caloriesKcal: 340,
            proteinG: 21,
            carbsG: 34,
            fatG: 13
        },
        {
            code: "BF_GREEK_OAT",
            label: "그릭요거트 150g + 오트밀 40g + 견과류",
            detail: "고단백 그릭요거트 + 오트밀 간편 아침식",
            caloriesKcal: 360,
            proteinG: 22,
            carbsG: 38,
            fatG: 12
        },
        {
            code: "BF_SKIP",
            label: "아침 식사 생략 (간헐적 단식 / 공복 유지)",
            detail: "아침 물·블랙커피 외 칼로리 섭취 없음",
            caloriesKcal: 0,
            proteinG: 0,
            carbsG: 0,
            fatG: 0
        }
    ],
    LUNCH_MAIN_PRESETS: [
        {
            code: "LC_CAFETERIA_SEOLLEONGTANG",
            label: "구내식당 설렁탕·국밥류 기준 (밥 1공기 포함)",
            detail: "설렁탕/곰탕/국밥 등 구내식당 국물 메뉴 평균 (약 1,100 kcal)",
            caloriesKcal: 1100,
            proteinG: 32,
            carbsG: 135,
            fatG: 46
        },
        {
            code: "LC_CAFETERIA_STANDARD",
            label: "구내식당 일반 백반 정식 (밥 + 국 + 반찬 3~4종)",
            detail: "표준 구내식당 한식 백반 평균 (약 950 kcal)",
            caloriesKcal: 950,
            proteinG: 28,
            carbsG: 125,
            fatG: 36
        },
        {
            code: "LC_CAFETERIA_SPECIAL",
            label: "구내식당 돈까스·제육·튀김류 특식",
            detail: "튀김/볶음 위주 구내식당 고칼로리 메뉴 (약 1,200 kcal)",
            caloriesKcal: 1200,
            proteinG: 34,
            carbsG: 138,
            fatG: 56
        },
        {
            code: "LC_OUT_KOREAN",
            label: "일반 식당 외식 (김치찌개·된장찌개·비빔밥·덮밥)",
            detail: "직장인 점심 일반 한식당 외식 평균 (약 900 kcal)",
            caloriesKcal: 900,
            proteinG: 26,
            carbsG: 118,
            fatG: 34
        },
        {
            code: "LC_DIET_BOX_SALAD",
            label: "다이어트 도시락 / 포케 / 닭가슴살 샐러드",
            detail: "탄수화물 절제형 클린 점심 식단 (약 550 kcal)",
            caloriesKcal: 550,
            proteinG: 36,
            carbsG: 55,
            fatG: 18
        }
    ],
    FIXED_DRINK_PRESETS: [
        {
            code: "DR_GS25_BARISTA_174",
            label: "GS25 바리스타 커피 (250ml 컵커피)",
            detail: "편의점 바리스타 로슈거/에스프레소 라떼 기준 (174 kcal)",
            caloriesKcal: 174,
            proteinG: 5,
            carbsG: 24,
            fatG: 6
        },
        {
            code: "DR_CAFE_LATTE",
            label: "일반 카페라떼 (톨/레귤러 사이즈, 시럽 없음)",
            detail: "우유 + 에스프레소 카페라떼 1잔 (180 kcal)",
            caloriesKcal: 180,
            proteinG: 9,
            carbsG: 14,
            fatG: 9
        },
        {
            code: "DR_SWEET_LATTE",
            label: "바닐라라떼 / 연유라떼 / 카라멜마키아또",
            detail: "시럽·연유 포함 달콤한 커피 음료 1잔 (270 kcal)",
            caloriesKcal: 270,
            proteinG: 8,
            carbsG: 38,
            fatG: 9
        },
        {
            code: "DR_PROTEIN_RTD",
            label: "편의점 단백질 음료 1팩 (더단백·셀렉스 등)",
            detail: "RTD 단백질 드링크 250ml 1팩 (145 kcal / 단백질 20g)",
            caloriesKcal: 145,
            proteinG: 20,
            carbsG: 6,
            fatG: 3
        },
        {
            code: "DR_AMERICANO_ZERO",
            label: "아메리카노 / 제로 칼로리 음료 / 물",
            detail: "당류·지방 없는 무칼로리 음료 (5 kcal)",
            caloriesKcal: 5,
            proteinG: 0,
            carbsG: 1,
            fatG: 0
        }
    ]
};

export const FixedRoutineTemplates = {
    BREAKFAST_FIXED: {
        templateCode: "FIXED_BREAKFAST_EGG_APPLE_SHAKE",
        mealType: "BREAKFAST",
        mealLabel: "아침",
        title: "아침 고정 루틴 (계란 3 + 사과 1 + 쉐이크)",
        subtitle: "훈제/삶은 계란 3알 + 사과 1개 + 단백질 쉐이크 1스쿱",
        badgeText: "원클릭 고정 루틴 · 480 kcal / 단백질 40g",
        caloriesKcal: 480,
        carbsG: 32,
        proteinG: 40,
        fatG: 18
    },
    LUNCH_FIXED: {
        templateCode: "FIXED_LUNCH_CAFETERIA_LATTE",
        mealType: "LUNCH",
        mealLabel: "점심",
        title: "점심 고정 루틴 (구내식당 설렁탕 등 + GS25 바리스타 커피)",
        subtitle: "구내식당 식사(설렁탕 기준 약 1,100 kcal) + GS25 바리스타 커피(174 kcal)",
        badgeText: "고정 템플릿 · 1,274 kcal / 단백질 37g",
        caloriesKcal: 1274,
        carbsG: 159,
        proteinG: 37,
        fatG: 52
    },
    EXTRA_PROTEIN_BOOSTER: {
        templateCode: "BOOSTER_WHEY_ISOLATE_1SCOOP",
        mealType: "SNACK",
        mealLabel: "보충",
        title: "단백질 160g 방어용 WPI 쉐이크 1.5스쿱",
        subtitle: "아침·점심·저녁 외 부족 단백질(38g) 즉각 보충",
        badgeText: "근손실 방어 부스터 · 180 kcal / 단백질 38g",
        caloriesKcal: 180,
        carbsG: 3,
        proteinG: 38,
        fatG: 2
    },
    DINNER_RECOMMENDATIONS: [
        {
            templateCode: "DINNER_BEEF_BLADE_250",
            mealType: "DINNER",
            mealLabel: "저녁 가이드 A",
            title: "소고기 부채살 250g + 쌈채소 & 구운 버섯",
            subtitle: "초저탄수·고단백·풍부한 식이섬유 및 천연 크레아틴 보충",
            badgeText: "추천 가이드 A · 570 kcal / 단백질 54g / 탄수 8g",
            caloriesKcal: 570,
            carbsG: 8,
            proteinG: 54,
            fatG: 35
        },
        {
            templateCode: "DINNER_PORK_NECK_250",
            mealType: "DINNER",
            mealLabel: "저녁 가이드 B",
            title: "돼지 목살(살코기 위주) 250g + 쌈채소 & 구운 마늘",
            subtitle: "점심 탄수화물 초과분 상쇄용 무탄수 쌈채소 구성",
            badgeText: "추천 가이드 B · 590 kcal / 단백질 51g / 탄수 9g",
            caloriesKcal: 590,
            carbsG: 9,
            proteinG: 51,
            fatG: 38
        },
        {
            templateCode: "DINNER_CHICKEN_BREAST_250",
            mealType: "DINNER",
            mealLabel: "저녁 가이드 C",
            title: "닭가슴살 250g + 아보카도 1/2개 & 그린 샐러드",
            subtitle: "체지방 감량 가속 및 단백질 160g 돌파를 위한 클린 식단",
            badgeText: "추천 가이드 C · 550 kcal / 단백질 58g / 탄수 10g",
            caloriesKcal: 550,
            carbsG: 10,
            proteinG: 58,
            fatG: 21
        }
    ]
};

export const MachinePresets = [
    { name: "체스트 프레스 머신", muscle: "가슴" },
    { name: "랫 풀 다운", muscle: "등" },
    { name: "시티드 케이블 로우", muscle: "등" },
    { name: "레그 프레스 머신", muscle: "하체" },
    { name: "핵 스쿼트 머신", muscle: "하체" },
    { name: "숄더 프레스 머신", muscle: "어깨" }
];

const LEGACY_SAMPLE_MEMOS = new Set([
    "다이어트 시작 2주 전 측정",
    "지난주 월요일 기준점 측정",
    "1주차 시작 기준점 측정",
    "2주차 기준점 측정",
    "직전 측정 (104.60kg / 골격근 42.97kg / 체지방 28.6%)",
    "오늘 측정 (104.40kg / 지난번 대비 -0.20kg)",
    "1주차 시작일 기준 측정"
]);

function isUntouchedSampleRecord(r) {
    if (!r || typeof r !== "object") return true;
    if (r.userCreated === true) return false;

    // 과거 초기 화면/검증용으로 자동 생성되었던 고정 샘플 ID (1, 2, 3) 제거
    if (r.id === 1 || r.id === 2 || r.id === 3) return true;

    // 과거 샘플 수치 (105.40, 104.98, 104.60) + 샘플 메모 조합 제거
    const w = Number(r.weightKg);
    const m = Number(r.skeletalMuscleMassKg);
    const fm = Number(r.bodyFatMassKg);
    const fp = Number(r.bodyFatPercentage);

    if (
        (w === 105.4 && m === 42.9) ||
        (w === 104.98 && m === 42.95) ||
        (w === 104.6 && m === 42.97)
    ) {
        return true;
    }

    // 오늘 날짜로 자동 시드되었던 기본 샘플(104.40 / 42.80 / 29.86 / 28.6)이면서 사용자가 직접 저장하지 않은 경우 제거
    const isDefaultTodaySampleValues =
        w === 104.4 && m === 42.8 && fm === 29.86 && fp === 28.6;
    if (isDefaultTodaySampleValues && LEGACY_SAMPLE_MEMOS.has(r.memo || "")) {
        return true;
    }

    return false;
}

function sanitizeUserRecord(r) {
    const cleanedMemo = LEGACY_SAMPLE_MEMOS.has(r.memo || "") ? "" : (r.memo || "");
    return {
        ...r,
        memo: cleanedMemo,
        userCreated: true
    };
}

function safeParseArray(raw) {
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

function safeParseObject(raw) {
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
        return null;
    }
}

export class GymRatStorage {
    /**
     * 초기 화면이나 기능 검증을 위한 자동 생성 샘플 데이터는 일절 생성하지 않으며,
     * 기존에 남아 있던 자동 생성 샘플 데이터는 모두 제거하고 사용자가 직접 입력한 기록만 영구 보존합니다.
     */
    static ensureSeeded() {
        const primaryProfile = safeParseObject(localStorage.getItem(STORAGE_KEYS.PROFILE));
        const backupProfile = safeParseObject(localStorage.getItem(STORAGE_KEYS.PROFILE_BACKUP));

        if (!primaryProfile && !backupProfile) {
            const serialized = JSON.stringify(DEFAULT_USER_PROFILE);
            localStorage.setItem(STORAGE_KEYS.PROFILE, serialized);
            localStorage.setItem(STORAGE_KEYS.PROFILE_BACKUP, serialized);
        } else {
            const baseProf = primaryProfile || backupProfile;
            const mergedProfile = { ...DEFAULT_USER_PROFILE, ...baseProf };
            const serialized = JSON.stringify(mergedProfile);
            localStorage.setItem(STORAGE_KEYS.PROFILE, serialized);
            localStorage.setItem(STORAGE_KEYS.PROFILE_BACKUP, serialized);
        }

        const primaryRoutines = safeParseObject(localStorage.getItem(STORAGE_KEYS.CUSTOM_ROUTINES));
        const backupRoutines = safeParseObject(localStorage.getItem(STORAGE_KEYS.CUSTOM_ROUTINES_BACKUP));
        if (!primaryRoutines && !backupRoutines) {
            const defaultCustomRoutines = {
                breakfastPresetCode: "BF_EGG3_APPLE1_SHAKE",
                lunchMainPresetCode: "LC_CAFETERIA_SEOLLEONGTANG",
                fixedDrinkPresetCode: "DR_GS25_BARISTA_174",
                BREAKFAST_FIXED: { ...FixedRoutineTemplates.BREAKFAST_FIXED },
                LUNCH_FIXED: { ...FixedRoutineTemplates.LUNCH_FIXED },
                EXTRA_PROTEIN_BOOSTER: { ...FixedRoutineTemplates.EXTRA_PROTEIN_BOOSTER }
            };
            const routineStr = JSON.stringify(defaultCustomRoutines);
            localStorage.setItem(STORAGE_KEYS.CUSTOM_ROUTINES, routineStr);
            localStorage.setItem(STORAGE_KEYS.CUSTOM_ROUTINES_BACKUP, routineStr);
        } else if (!primaryRoutines && backupRoutines) {
            localStorage.setItem(STORAGE_KEYS.CUSTOM_ROUTINES, JSON.stringify(backupRoutines));
        } else if (primaryRoutines && !backupRoutines) {
            localStorage.setItem(STORAGE_KEYS.CUSTOM_ROUTINES_BACKUP, JSON.stringify(primaryRoutines));
        }

        const primaryWeights = safeParseArray(localStorage.getItem(STORAGE_KEYS.WEIGHT_RECORDS)) || [];
        const backupWeights = safeParseArray(localStorage.getItem(STORAGE_KEYS.WEIGHT_RECORDS_BACKUP)) || [];

        // 사용자 기록 무손실 병합 후, 자동 생성된 샘플 데이터는 전량 제거
        const mergedMap = new Map();
        backupWeights.forEach(r => {
            if (r && r.recordDate && !isUntouchedSampleRecord(r)) {
                mergedMap.set(r.recordDate, sanitizeUserRecord(r));
            }
        });
        primaryWeights.forEach(r => {
            if (r && r.recordDate && !isUntouchedSampleRecord(r)) {
                const cleaned = sanitizeUserRecord(r);
                const existing = mergedMap.get(r.recordDate);
                if (!existing || (cleaned.updatedAt || 0) >= (existing.updatedAt || 0)) {
                    mergedMap.set(r.recordDate, cleaned);
                }
            }
        });

        const mergedList = Array.from(mergedMap.values()).sort((a, b) =>
            a.recordDate.localeCompare(b.recordDate)
        );

        const serialized = JSON.stringify(mergedList);
        localStorage.setItem(STORAGE_KEYS.WEIGHT_RECORDS, serialized);
        localStorage.setItem(STORAGE_KEYS.WEIGHT_RECORDS_BACKUP, serialized);

        if (mergedList.length > 0) {
            const currentProfile = safeParseObject(localStorage.getItem(STORAGE_KEYS.PROFILE)) ||
                safeParseObject(localStorage.getItem(STORAGE_KEYS.PROFILE_BACKUP));
            if (currentProfile) {
                const startRec = mergedList[0];
                const latestRec = mergedList[mergedList.length - 1];
                currentProfile.startWeightKg = Number(startRec.weightKg);
                currentProfile.startSkeletalMuscleKg = Number(startRec.skeletalMuscleMassKg);
                currentProfile.startBodyFatPercent = Number(startRec.bodyFatPercentage);
                currentProfile.currentWeightKg = Number(latestRec.weightKg);
                const profStr = JSON.stringify(currentProfile);
                localStorage.setItem(STORAGE_KEYS.PROFILE, profStr);
                localStorage.setItem(STORAGE_KEYS.PROFILE_BACKUP, profStr);
            }
        }

        if (!localStorage.getItem(STORAGE_KEYS.DIET_RECORDS)) {
            localStorage.setItem(STORAGE_KEYS.DIET_RECORDS, JSON.stringify([]));
        }

        if (!localStorage.getItem(STORAGE_KEYS.WORKOUT_RECORDS)) {
            localStorage.setItem(STORAGE_KEYS.WORKOUT_RECORDS, JSON.stringify([]));
        }

        if (!localStorage.getItem(STORAGE_KEYS.DAILY_CHECKLISTS)) {
            localStorage.setItem(STORAGE_KEYS.DAILY_CHECKLISTS, JSON.stringify({}));
        }
    }

    static getProfile() {
        this.ensureSeeded();
        const saved = safeParseObject(localStorage.getItem(STORAGE_KEYS.PROFILE)) ||
            safeParseObject(localStorage.getItem(STORAGE_KEYS.PROFILE_BACKUP)) ||
            {};
        return { ...DEFAULT_USER_PROFILE, ...saved };
    }

    static saveProfile(profile) {
        const merged = { ...DEFAULT_USER_PROFILE, ...profile };
        const serialized = JSON.stringify(merged);
        localStorage.setItem(STORAGE_KEYS.PROFILE, serialized);
        localStorage.setItem(STORAGE_KEYS.PROFILE_BACKUP, serialized);
    }

    static getCustomRoutines() {
        this.ensureSeeded();
        const saved = safeParseObject(localStorage.getItem(STORAGE_KEYS.CUSTOM_ROUTINES)) ||
            safeParseObject(localStorage.getItem(STORAGE_KEYS.CUSTOM_ROUTINES_BACKUP));
        if (!saved) {
            return {
                breakfastPresetCode: "BF_EGG3_APPLE1_SHAKE",
                lunchMainPresetCode: "LC_CAFETERIA_SEOLLEONGTANG",
                fixedDrinkPresetCode: "DR_GS25_BARISTA_174",
                BREAKFAST_FIXED: { ...FixedRoutineTemplates.BREAKFAST_FIXED },
                LUNCH_FIXED: { ...FixedRoutineTemplates.LUNCH_FIXED },
                EXTRA_PROTEIN_BOOSTER: { ...FixedRoutineTemplates.EXTRA_PROTEIN_BOOSTER }
            };
        }
        return {
            breakfastPresetCode: saved.breakfastPresetCode || "BF_EGG3_APPLE1_SHAKE",
            lunchMainPresetCode: saved.lunchMainPresetCode || "LC_CAFETERIA_SEOLLEONGTANG",
            fixedDrinkPresetCode: saved.fixedDrinkPresetCode || "DR_GS25_BARISTA_174",
            BREAKFAST_FIXED: { ...FixedRoutineTemplates.BREAKFAST_FIXED, ...(saved.BREAKFAST_FIXED || {}) },
            LUNCH_FIXED: { ...FixedRoutineTemplates.LUNCH_FIXED, ...(saved.LUNCH_FIXED || {}) },
            EXTRA_PROTEIN_BOOSTER: { ...FixedRoutineTemplates.EXTRA_PROTEIN_BOOSTER, ...(saved.EXTRA_PROTEIN_BOOSTER || {}) }
        };
    }

    static saveCustomRoutines(customRoutines, dateStrToSync = null) {
        const current = this.getCustomRoutines();
        const merged = {
            ...current,
            ...customRoutines
        };
        const serialized = JSON.stringify(merged);
        localStorage.setItem(STORAGE_KEYS.CUSTOM_ROUTINES, serialized);
        localStorage.setItem(STORAGE_KEYS.CUSTOM_ROUTINES_BACKUP, serialized);

        // 오늘 이미 등록된 고정 식단 루틴이 있다면 수정된 칼로리/영양소 수치로 즉시 동기화
        if (dateStrToSync) {
            const allDiets = safeParseArray(localStorage.getItem(STORAGE_KEYS.DIET_RECORDS)) || [];
            let updated = false;
            const templatesByCode = new Map([
                [merged.BREAKFAST_FIXED.templateCode, merged.BREAKFAST_FIXED],
                [merged.LUNCH_FIXED.templateCode, merged.LUNCH_FIXED],
                [merged.EXTRA_PROTEIN_BOOSTER.templateCode, merged.EXTRA_PROTEIN_BOOSTER]
            ]);
            const nextDiets = allDiets.map(d => {
                if (d.recordDate === dateStrToSync && templatesByCode.has(d.templateCode)) {
                    const tpl = templatesByCode.get(d.templateCode);
                    updated = true;
                    return {
                        ...d,
                        title: tpl.title,
                        subtitle: tpl.subtitle,
                        caloriesKcal: Number(tpl.caloriesKcal),
                        carbsG: Number(tpl.carbsG),
                        proteinG: Number(tpl.proteinG),
                        fatG: Number(tpl.fatG)
                    };
                }
                return d;
            });
            if (updated) {
                localStorage.setItem(STORAGE_KEYS.DIET_RECORDS, JSON.stringify(nextDiets));
            }
        }
        return merged;
    }

    static getWeightRecords() {
        this.ensureSeeded();
        const list = safeParseArray(localStorage.getItem(STORAGE_KEYS.WEIGHT_RECORDS)) ||
            safeParseArray(localStorage.getItem(STORAGE_KEYS.WEIGHT_RECORDS_BACKUP)) ||
            [];
        return [...list].sort((a, b) => a.recordDate.localeCompare(b.recordDate));
    }

    /**
     * 사용자가 입력한 특정 날짜의 체성분 기록을 추가하거나 업데이트하며,
     * 다른 날짜의 기존 사용자 기록들은 절대 삭제하지 않고 그대로 유지합니다.
     */
    static upsertWeightRecord(record) {
        const list = this.getWeightRecords();
        const existingIndex = list.findIndex(r => r.recordDate === record.recordDate);
        const normalized = {
            id: existingIndex >= 0 ? list[existingIndex].id : Date.now(),
            recordDate: record.recordDate,
            weightKg: Number(record.weightKg),
            skeletalMuscleMassKg: Number(record.skeletalMuscleMassKg),
            bodyFatMassKg: Number(record.bodyFatMassKg),
            bodyFatPercentage: Number(record.bodyFatPercentage),
            memo: record.memo || "",
            userCreated: true,
            updatedAt: Date.now()
        };

        if (existingIndex >= 0) {
            list[existingIndex] = normalized;
        } else {
            list.push(normalized);
        }
        list.sort((a, b) => a.recordDate.localeCompare(b.recordDate));

        const serialized = JSON.stringify(list);
        localStorage.setItem(STORAGE_KEYS.WEIGHT_RECORDS, serialized);
        localStorage.setItem(STORAGE_KEYS.WEIGHT_RECORDS_BACKUP, serialized);

        const profile = this.getProfile();
        const latestRecord = list[list.length - 1];
        if (latestRecord) {
            profile.currentWeightKg = Number(latestRecord.weightKg);
        }
        if (list.length > 0) {
            profile.startWeightKg = Number(list[0].weightKg);
            profile.startSkeletalMuscleKg = Number(list[0].skeletalMuscleMassKg);
            profile.startBodyFatPercent = Number(list[0].bodyFatPercentage);
        }
        this.saveProfile(profile);
        return list;
    }

    static deleteWeightRecord(id) {
        const current = this.getWeightRecords();
        const list = current.filter(r => r.id !== id);
        const serialized = JSON.stringify(list);
        localStorage.setItem(STORAGE_KEYS.WEIGHT_RECORDS, serialized);
        localStorage.setItem(STORAGE_KEYS.WEIGHT_RECORDS_BACKUP, serialized);

        const profile = this.getProfile();
        const latest = list[list.length - 1];
        if (latest) {
            profile.currentWeightKg = Number(latest.weightKg);
            profile.startWeightKg = Number(list[0].weightKg);
            profile.startSkeletalMuscleKg = Number(list[0].skeletalMuscleMassKg);
            profile.startBodyFatPercent = Number(list[0].bodyFatPercentage);
            this.saveProfile(profile);
        }
        return true;
    }

    static getDietRecordsByDate(dateStr) {
        this.ensureSeeded();
        const all = safeParseArray(localStorage.getItem(STORAGE_KEYS.DIET_RECORDS)) || [];
        return all.filter(d => d.recordDate === dateStr);
    }

    static toggleTemplateDiet(dateStr, template) {
        const all = safeParseArray(localStorage.getItem(STORAGE_KEYS.DIET_RECORDS)) || [];
        const idx = all.findIndex(d => d.recordDate === dateStr && d.templateCode === template.templateCode);
        if (idx >= 0) {
            all.splice(idx, 1);
            localStorage.setItem(STORAGE_KEYS.DIET_RECORDS, JSON.stringify(all));
            return false;
        } else {
            all.push({
                id: Date.now() + Math.random(),
                recordDate: dateStr,
                mealType: template.mealType,
                title: template.title,
                subtitle: template.subtitle,
                caloriesKcal: template.caloriesKcal,
                carbsG: template.carbsG,
                proteinG: template.proteinG,
                fatG: template.fatG,
                templateCode: template.templateCode
            });
            localStorage.setItem(STORAGE_KEYS.DIET_RECORDS, JSON.stringify(all));
            return true;
        }
    }

    static selectDinnerRecommendation(dateStr, dinnerTemplate) {
        let all = safeParseArray(localStorage.getItem(STORAGE_KEYS.DIET_RECORDS)) || [];
        const dinnerCodes = FixedRoutineTemplates.DINNER_RECOMMENDATIONS.map(d => d.templateCode);
        const alreadySelected = all.some(
            d => d.recordDate === dateStr && d.templateCode === dinnerTemplate.templateCode
        );

        all = all.filter(d => !(d.recordDate === dateStr && dinnerCodes.includes(d.templateCode)));

        if (!alreadySelected) {
            all.push({
                id: Date.now() + Math.random(),
                recordDate: dateStr,
                mealType: dinnerTemplate.mealType,
                title: dinnerTemplate.title,
                subtitle: dinnerTemplate.subtitle,
                caloriesKcal: dinnerTemplate.caloriesKcal,
                carbsG: dinnerTemplate.carbsG,
                proteinG: dinnerTemplate.proteinG,
                fatG: dinnerTemplate.fatG,
                templateCode: dinnerTemplate.templateCode
            });
        }
        localStorage.setItem(STORAGE_KEYS.DIET_RECORDS, JSON.stringify(all));
        return !alreadySelected;
    }

    static getChecklist(dateStr) {
        this.ensureSeeded();
        const map = safeParseObject(localStorage.getItem(STORAGE_KEYS.DAILY_CHECKLISTS)) || {};
        return map[dateStr] || {
            recordDate: dateStr,
            creatine5gTaken: false,
            probioticsTaken: false,
            waterIntakeMl: 0,
            weightSession50mDone: false,
            stairMasterIntervalDone: false,
            stairMasterMinutes: 10
        };
    }

    static saveChecklist(dateStr, checklist) {
        const map = safeParseObject(localStorage.getItem(STORAGE_KEYS.DAILY_CHECKLISTS)) || {};
        map[dateStr] = checklist;
        localStorage.setItem(STORAGE_KEYS.DAILY_CHECKLISTS, JSON.stringify(map));
    }

    static getWorkoutRecordsByDate(dateStr) {
        this.ensureSeeded();
        const all = safeParseArray(localStorage.getItem(STORAGE_KEYS.WORKOUT_RECORDS)) || [];
        return all.filter(w => w.recordDate === dateStr);
    }

    static getWeeklyWorkoutDaysCount(dateStr) {
        this.ensureSeeded();
        const all = safeParseArray(localStorage.getItem(STORAGE_KEYS.WORKOUT_RECORDS)) || [];
        const checklistMap = safeParseObject(localStorage.getItem(STORAGE_KEYS.DAILY_CHECKLISTS)) || {};

        const [y, m, dayNum] = dateStr.split("-").map(Number);
        const d = new Date(y, m - 1, dayNum);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(d.getFullYear(), d.getMonth(), diff);
        const mondayStr = getLocalDateString(monday);

        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        const sundayStr = getLocalDateString(sunday);

        const activeDates = new Set();
        all.forEach(w => {
            if (w.recordDate >= mondayStr && w.recordDate <= sundayStr) {
                activeDates.add(w.recordDate);
            }
        });
        Object.values(checklistMap).forEach(c => {
            if (
                c.recordDate >= mondayStr &&
                c.recordDate <= sundayStr &&
                (c.weightSession50mDone || c.stairMasterIntervalDone)
            ) {
                activeDates.add(c.recordDate);
            }
        });
        return activeDates.size;
    }

    static addWorkoutSet(record) {
        const all = safeParseArray(localStorage.getItem(STORAGE_KEYS.WORKOUT_RECORDS)) || [];
        all.push({
            id: Date.now() + Math.floor(Math.random() * 1000),
            ...record
        });
        localStorage.setItem(STORAGE_KEYS.WORKOUT_RECORDS, JSON.stringify(all));
    }

    static deleteWorkoutSet(id) {
        const all = (safeParseArray(localStorage.getItem(STORAGE_KEYS.WORKOUT_RECORDS)) || [])
            .filter(w => w.id !== id);
        localStorage.setItem(STORAGE_KEYS.WORKOUT_RECORDS, JSON.stringify(all));
    }

    /**
     * 클라우드 백업이나 로컬 파일 저장을 위해 현재 기기의 모든 사용자 데이터를 JSON 객체로 내보냅니다.
     */
    static exportUserDataJson() {
        this.ensureSeeded();
        return {
            exportedAt: Date.now(),
            version: "1.2.0",
            profile: this.getProfile(),
            customRoutines: this.getCustomRoutines(),
            weightRecords: this.getWeightRecords(),
            dietRecords: safeParseArray(localStorage.getItem(STORAGE_KEYS.DIET_RECORDS)) || [],
            dailyChecklists: safeParseObject(localStorage.getItem(STORAGE_KEYS.DAILY_CHECKLISTS)) || {},
            workoutRecords: safeParseArray(localStorage.getItem(STORAGE_KEYS.WORKOUT_RECORDS)) || []
        };
    }

    /**
     * 클라우드 스냅샷(또는 백업 파일)을 로컬 데이터와 무손실 병합합니다.
     * 날짜별 체성분 기록이 중복될 경우 더 최신 타임스탬프를 보존하며, 기존 기록을 절대 유실하지 않습니다.
     */
    static importUserDataJson(incomingData) {
        if (!incomingData || typeof incomingData !== "object") {
            throw new Error("올바른 백업 데이터 형식이 아닙니다.");
        }

        // 1. 체성분 기록 병합
        const localWeights = this.getWeightRecords();
        const incomingWeights = Array.isArray(incomingData.weightRecords) ? incomingData.weightRecords : [];

        const weightMap = new Map();
        localWeights.forEach(r => {
            if (r && r.recordDate) weightMap.set(r.recordDate, r);
        });
        incomingWeights.forEach(r => {
            if (r && r.recordDate && !isUntouchedSampleRecord(r)) {
                const cleaned = sanitizeUserRecord(r);
                const existing = weightMap.get(r.recordDate);
                if (!existing || (cleaned.updatedAt || 0) >= (existing.updatedAt || 0)) {
                    weightMap.set(r.recordDate, cleaned);
                }
            }
        });
        const mergedWeights = Array.from(weightMap.values()).sort((a, b) =>
            a.recordDate.localeCompare(b.recordDate)
        );
        localStorage.setItem(STORAGE_KEYS.WEIGHT_RECORDS, JSON.stringify(mergedWeights));
        localStorage.setItem(STORAGE_KEYS.WEIGHT_RECORDS_BACKUP, JSON.stringify(mergedWeights));

        // 2. 프로필 병합
        const currentProfile = this.getProfile();
        const incomingProfile = incomingData.profile && typeof incomingData.profile === "object" ? incomingData.profile : {};
        const mergedProfile = { ...DEFAULT_USER_PROFILE, ...currentProfile, ...incomingProfile };
        if (mergedWeights.length > 0) {
            mergedProfile.startWeightKg = Number(mergedWeights[0].weightKg);
            mergedProfile.startSkeletalMuscleKg = Number(mergedWeights[0].skeletalMuscleMassKg);
            mergedProfile.startBodyFatPercent = Number(mergedWeights[0].bodyFatPercentage);
            mergedProfile.currentWeightKg = Number(mergedWeights[mergedWeights.length - 1].weightKg);
        }
        this.saveProfile(mergedProfile);

        // 3. 고정 식단 루틴 병합
        if (incomingData.customRoutines && typeof incomingData.customRoutines === "object") {
            this.saveCustomRoutines(incomingData.customRoutines);
        }

        // 4. 식단 기록 병합
        const localDiets = safeParseArray(localStorage.getItem(STORAGE_KEYS.DIET_RECORDS)) || [];
        const incomingDiets = Array.isArray(incomingData.dietRecords) ? incomingData.dietRecords : [];
        const dietMap = new Map();
        localDiets.forEach(d => {
            if (d && d.id) dietMap.set(String(d.id), d);
        });
        incomingDiets.forEach(d => {
            if (d && d.id) dietMap.set(String(d.id), d);
        });
        const mergedDiets = Array.from(dietMap.values());
        localStorage.setItem(STORAGE_KEYS.DIET_RECORDS, JSON.stringify(mergedDiets));

        // 5. 체크리스트 병합
        const localChecklists = safeParseObject(localStorage.getItem(STORAGE_KEYS.DAILY_CHECKLISTS)) || {};
        const incomingChecklists = incomingData.dailyChecklists && typeof incomingData.dailyChecklists === "object"
            ? incomingData.dailyChecklists
            : {};
        const mergedChecklists = { ...localChecklists, ...incomingChecklists };
        localStorage.setItem(STORAGE_KEYS.DAILY_CHECKLISTS, JSON.stringify(mergedChecklists));

        // 6. 운동 기록 병합
        const localWorkouts = safeParseArray(localStorage.getItem(STORAGE_KEYS.WORKOUT_RECORDS)) || [];
        const incomingWorkouts = Array.isArray(incomingData.workoutRecords) ? incomingData.workoutRecords : [];
        const workoutMap = new Map();
        localWorkouts.forEach(w => {
            if (w && w.id) workoutMap.set(String(w.id), w);
        });
        incomingWorkouts.forEach(w => {
            if (w && w.id) workoutMap.set(String(w.id), w);
        });
        const mergedWorkouts = Array.from(workoutMap.values());
        localStorage.setItem(STORAGE_KEYS.WORKOUT_RECORDS, JSON.stringify(mergedWorkouts));

        return {
            profile: mergedProfile,
            customRoutines: this.getCustomRoutines(),
            weightRecords: mergedWeights,
            dietRecords: mergedDiets,
            dailyChecklists: mergedChecklists,
            workoutRecords: mergedWorkouts
        };
    }
}
