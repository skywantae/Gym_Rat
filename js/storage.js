/**
 * GymRat - LocalStorage 영구 저장소 & 데이터 무결성 보존 레이어
 * - 업데이트 시에도 기존 기록이 절대 삭제되거나 초기화되지 않도록 이중 백업 병합(Merge) 적용
 */

import { getLocalDateString } from "./calculator.js";

const STORAGE_KEYS = {
    PROFILE: "gymrat_user_profile_v1",
    PROFILE_BACKUP: "gymrat_user_profile_backup",
    WEIGHT_RECORDS: "gymrat_weight_records_v1",
    WEIGHT_RECORDS_BACKUP: "gymrat_weight_records_backup",
    DIET_RECORDS: "gymrat_diet_records_v1",
    WORKOUT_RECORDS: "gymrat_workout_records_v1",
    DAILY_CHECKLISTS: "gymrat_daily_checklists_v1"
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
        title: "점심 고정 루틴 (구내식당 + 카페라떼)",
        subtitle: "구내식당 일반식(약 1,026 kcal) + 아이스/핫 카페라떼(174 kcal)",
        badgeText: "고정 템플릿 · 1,200 kcal / 단백질 28g",
        caloriesKcal: 1200,
        carbsG: 148,
        proteinG: 28,
        fatG: 44
    },
    EXTRA_PROTEIN_BOOSTER: {
        templateCode: "BOOSTER_WHEY_ISOLATE_1SCOOP",
        mealType: "SNACK",
        mealLabel: "보충",
        title: "단백질 160g 방어용 WPI 쉐이크 1.5스쿱",
        subtitle: "아침(40g)+점심(28g)+저녁(54g)=122g 외 부족 단백질(38g) 즉각 보충",
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

function offsetLocalDateStr(daysOffset) {
    const d = new Date();
    d.setDate(d.getDate() + daysOffset);
    return getLocalDateString(d);
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
     * 최초 실행 시에만 기본 프로필과 초기 샘플 기록을 세팅하며,
     * 이미 저장된 기록이나 백업 기록이 하나라도 존재하면 기존 데이터를 100% 보존합니다.
     */
    static ensureSeeded() {
        const primaryProfile = safeParseObject(localStorage.getItem(STORAGE_KEYS.PROFILE));
        const backupProfile = safeParseObject(localStorage.getItem(STORAGE_KEYS.PROFILE_BACKUP));

        if (!primaryProfile && !backupProfile) {
            const defaultProfile = {
                heightCm: 184.0,
                startWeightKg: 104.60,
                currentWeightKg: 104.40,
                targetWeightKg: 90.0,
                startSkeletalMuscleKg: 42.97,
                minTargetSkeletalMuscleKg: 41.0,
                startBodyFatPercent: 28.6,
                targetBodyFatPercent: 19.5,
                dailyTargetCalories: 2250,
                dailyTargetProteinG: 160,
                dailyTargetCarbsG: 210,
                dailyTargetFatG: 85,
                dailyTargetWaterMl: 2800
            };
            const serialized = JSON.stringify(defaultProfile);
            localStorage.setItem(STORAGE_KEYS.PROFILE, serialized);
            localStorage.setItem(STORAGE_KEYS.PROFILE_BACKUP, serialized);
        } else if (!primaryProfile && backupProfile) {
            localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(backupProfile));
        } else if (primaryProfile && !backupProfile) {
            localStorage.setItem(STORAGE_KEYS.PROFILE_BACKUP, JSON.stringify(primaryProfile));
        }

        const primaryWeights = safeParseArray(localStorage.getItem(STORAGE_KEYS.WEIGHT_RECORDS));
        const backupWeights = safeParseArray(localStorage.getItem(STORAGE_KEYS.WEIGHT_RECORDS_BACKUP));

        if ((!primaryWeights || primaryWeights.length === 0) && (!backupWeights || backupWeights.length === 0)) {
            const initialRecords = [
                {
                    id: 1,
                    recordDate: offsetLocalDateStr(-14),
                    weightKg: 105.40,
                    skeletalMuscleMassKg: 42.90,
                    bodyFatMassKg: 30.57,
                    bodyFatPercentage: 29.0,
                    memo: "1주차 시작 기준점 측정",
                    updatedAt: Date.now() - 300000
                },
                {
                    id: 2,
                    recordDate: offsetLocalDateStr(-7),
                    weightKg: 104.98,
                    skeletalMuscleMassKg: 42.95,
                    bodyFatMassKg: 30.23,
                    bodyFatPercentage: 28.8,
                    memo: "2주차 기준점 측정",
                    updatedAt: Date.now() - 200000
                },
                {
                    id: 3,
                    recordDate: offsetLocalDateStr(-1),
                    weightKg: 104.60,
                    skeletalMuscleMassKg: 42.97,
                    bodyFatMassKg: 29.92,
                    bodyFatPercentage: 28.6,
                    memo: "직전 측정 (104.60kg / 골격근 42.97kg / 체지방 28.6%)",
                    updatedAt: Date.now() - 100000
                },
                {
                    id: 4,
                    recordDate: offsetLocalDateStr(0),
                    weightKg: 104.40,
                    skeletalMuscleMassKg: 42.80,
                    bodyFatMassKg: 29.86,
                    bodyFatPercentage: 28.6,
                    memo: "오늘 측정 (104.40kg / 지난번 대비 -0.20kg)",
                    updatedAt: Date.now()
                }
            ];
            const serialized = JSON.stringify(initialRecords);
            localStorage.setItem(STORAGE_KEYS.WEIGHT_RECORDS, serialized);
            localStorage.setItem(STORAGE_KEYS.WEIGHT_RECORDS_BACKUP, serialized);
        } else {
            // 기존 기록과 백업 기록을 날짜 기준으로 무손실 병합
            const mergedMap = new Map();
            (backupWeights || []).forEach(r => {
                if (r && r.recordDate) mergedMap.set(r.recordDate, r);
            });
            (primaryWeights || []).forEach(r => {
                if (r && r.recordDate) {
                    const existing = mergedMap.get(r.recordDate);
                    if (!existing || (r.updatedAt || 0) >= (existing.updatedAt || 0)) {
                        mergedMap.set(r.recordDate, r);
                    }
                }
            });
            const mergedList = Array.from(mergedMap.values()).sort((a, b) =>
                a.recordDate.localeCompare(b.recordDate)
            );
            const serialized = JSON.stringify(mergedList);
            localStorage.setItem(STORAGE_KEYS.WEIGHT_RECORDS, serialized);
            localStorage.setItem(STORAGE_KEYS.WEIGHT_RECORDS_BACKUP, serialized);
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
        return safeParseObject(localStorage.getItem(STORAGE_KEYS.PROFILE)) ||
            safeParseObject(localStorage.getItem(STORAGE_KEYS.PROFILE_BACKUP));
    }

    static saveProfile(profile) {
        const serialized = JSON.stringify(profile);
        localStorage.setItem(STORAGE_KEYS.PROFILE, serialized);
        localStorage.setItem(STORAGE_KEYS.PROFILE_BACKUP, serialized);
    }

    static getWeightRecords() {
        this.ensureSeeded();
        const list = safeParseArray(localStorage.getItem(STORAGE_KEYS.WEIGHT_RECORDS)) ||
            safeParseArray(localStorage.getItem(STORAGE_KEYS.WEIGHT_RECORDS_BACKUP)) ||
            [];
        return [...list].sort((a, b) => a.recordDate.localeCompare(b.recordDate));
    }

    /**
     * 특정 날짜의 체성분 기록을 추가하거나 업데이트하며,
     * 다른 날짜의 기존 기록들은 절대 삭제하지 않고 그대로 유지합니다.
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
        if (current.length <= 1) {
            return false; // 최소 1개의 기준 기록은 보호
        }
        const list = current.filter(r => r.id !== id);
        const serialized = JSON.stringify(list);
        localStorage.setItem(STORAGE_KEYS.WEIGHT_RECORDS, serialized);
        localStorage.setItem(STORAGE_KEYS.WEIGHT_RECORDS_BACKUP, serialized);

        const profile = this.getProfile();
        const latest = list[list.length - 1];
        if (latest) {
            profile.currentWeightKg = Number(latest.weightKg);
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
}
