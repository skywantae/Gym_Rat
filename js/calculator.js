/**
 * GymRat - 의학 및 스포츠 영양학(ACSM, ISSN, Helms et al. 2014, Alpert 2005) 기반
 * 주간 안전 감량 속도, 주차 계산 및 이전/이후 몸무게 로드맵 엔진
 */

export const MetricBadges = {
    EXCESS_HIGH: { label: "많이초과", dotClass: "dot-danger", textClass: "text-danger" },
    TOO_HIGH: { label: "너무 높음", dotClass: "dot-danger", textClass: "text-danger" },
    MODERATE_HIGH: { label: "다소높음", dotClass: "dot-warning", textClass: "text-warning" },
    MUSCLE_PLENTY: { label: "많음 (방어중)", dotClass: "dot-blue", textClass: "text-blue" },
    MUSCLE_RISK: { label: "근손실주의", dotClass: "dot-danger", textClass: "text-danger" },
    OPTIMAL: { label: "적정/목표도달", dotClass: "dot-lime", textClass: "text-lime" }
};

/**
 * 직업군별 기본 대사당량(METs) 및 일상 비근무 활동대사량(Non-work NEAT) 기준표
 */
export const OccupationProfiles = {
    OFFICE_IT: {
        code: "OFFICE_IT",
        label: "사무직 / IT·개발 / 기획·행정 (모니터·문서 집중)",
        workMets: 1.35,
        baseNonWorkNeatKcal: 260
    },
    RESEARCH_EDU: {
        code: "RESEARCH_EDU",
        label: "연구·전문직 / 교사·강사 / 상담 (좌식 + 발표·이동 혼합)",
        workMets: 1.75,
        baseNonWorkNeatKcal: 300
    },
    SALES_SERVICE_MED: {
        code: "SALES_SERVICE_MED",
        label: "영업·매장관리 / 서비스직 / 의료·간호 (지속 응대·보행)",
        workMets: 2.25,
        baseNonWorkNeatKcal: 330
    },
    FIELD_TECH_CHEF: {
        code: "FIELD_TECH_CHEF",
        label: "현장 기술·엔지니어 / 제조·정비 / 조리 (지속적 입식·장비 작업)",
        workMets: 2.75,
        baseNonWorkNeatKcal: 350
    },
    HEAVY_LABOR_ATHLETE: {
        code: "HEAVY_LABOR_ATHLETE",
        label: "건설·물류·배송 / 트레이너 / 고강도 현장직 (중량물·고활동)",
        workMets: 3.50,
        baseNonWorkNeatKcal: 380
    }
};

/**
 * 근무 중 자세 및 이동 빈도에 따른 활동 보정 계수
 */
export const WorkPostureProfiles = {
    MOSTLY_SITTING: {
        code: "MOSTLY_SITTING",
        label: "주로 앉아서 근무 (좌식 80% 이상)",
        factor: 1.00
    },
    MIXED_SIT_STAND: {
        code: "MIXED_SIT_STAND",
        label: "앉기와 서서 근무·이동 병행 (약 50:50)",
        factor: 1.15
    },
    MOSTLY_STANDING: {
        code: "MOSTLY_STANDING",
        label: "주로 서서 근무 (입식 70% 이상)",
        factor: 1.30
    },
    ACTIVE_WALKING: {
        code: "ACTIVE_WALKING",
        label: "근무 시간 내내 지속 보행·이동·운반",
        factor: 1.48
    }
};

/**
 * 사용자의 주요 트레이닝 프로그램 목적 정의
 */
export const ProgramGoalProfiles = {
    DIET: {
        code: "DIET",
        label: "체지방 감량 (다이어트 프로그램)",
        desc: "근손실을 방어하면서 체지방과 체중을 안정적으로 감량",
        proteinPerKg: 2.1,
        rateMultiplier: 1.0
    },
    RECOMP: {
        code: "RECOMP",
        label: "바디 리컴포지션 (체지방 감량 + 근비대 동시)",
        desc: "완만한 에너지 적자를 유지하며 체지방 감소와 골격근 증가를 동시 달성",
        proteinPerKg: 2.2,
        rateMultiplier: 0.72
    },
    HYPERTROPHY: {
        code: "HYPERTROPHY",
        label: "근비대 프로그램 (골격근량 성장 최우선)",
        desc: "고볼륨 점진적 과부하를 통해 골격근량 극대화 및 체지방률 관리",
        proteinPerKg: 2.0,
        rateMultiplier: 0.62
    },
    STRENGTH: {
        code: "STRENGTH",
        label: "스트렝스 프로그램 (3대 중량 및 최대 근력 향상)",
        desc: "신경계 퍼포먼스와 1RM 중량 보존을 최우선으로 둔 완만 체급 조절",
        proteinPerKg: 2.0,
        rateMultiplier: 0.65
    }
};

/**
 * 1회 운동 세션 강도 및 볼륨 정의
 */
export const WorkoutIntensityProfiles = {
    LOW_LIGHT: {
        code: "LOW_LIGHT",
        label: "저강도 (가벼운 기구·유산소 30~40분 / RPE 5~6)",
        kcalPerKgSession: 3.2
    },
    MODERATE_HYPERTROPHY: {
        code: "MODERATE_HYPERTROPHY",
        label: "중강도 (표준 대근육 웨이트 50분 + 유산소 10분 / RPE 7~8)",
        kcalPerKgSession: 4.4
    },
    HIGH_INTENSITY: {
        code: "HIGH_INTENSITY",
        label: "고강도 (고중량 다관절 웨이트 60분+ 및 인터벌 / RPE 8.5~9.5)",
        kcalPerKgSession: 5.5
    }
};

/**
 * 웨이트 트레이닝 숙련도(경력) 정의
 */
export const TrainingExperienceProfiles = {
    BEGINNER: {
        code: "BEGINNER",
        label: "입문·초급 (1년 미만 — 신경계 적응 및 초기 근성장 잠재력 높음)",
        paceFactor: 1.05
    },
    INTERMEDIATE: {
        code: "INTERMEDIATE",
        label: "중급 (1~3년 — 체계적 주간 볼륨 및 단백질 방어 필수)",
        paceFactor: 1.00
    },
    ADVANCED: {
        code: "ADVANCED",
        label: "상급 (3년 이상 — 근손실 민감도가 높아 보수적 감량 속도 필수)",
        paceFactor: 0.88
    }
};

export function getLocalDateString(dateObj = new Date()) {
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, "0");
    const day = String(dateObj.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

export function parseLocalDate(dateStr) {
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(y, m - 1, d);
}

export class SafeWeightLossCalculator {
    static round1(val) {
        return Math.round(val * 10) / 10;
    }

    static round2(val) {
        return Math.round(val * 100) / 100;
    }

    /**
     * 특정 날짜(YYYY-MM-DD)가 속한 주의 월요일 날짜(YYYY-MM-DD)를 반환합니다.
     */
    static getMondayDateString(dateStr) {
        const d = dateStr ? parseLocalDate(dateStr) : new Date();
        const day = d.getDay(); // 0(일) ~ 6(토)
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(d.getFullYear(), d.getMonth(), diff);
        return getLocalDateString(monday);
    }

    /**
     * 시작일(1주차 시작일)로부터 경과 일수를 계산하여 주차(1주차부터 시작, 7일 단위)를 반환합니다.
     */
    static calculateWeekNumber(startDateStr, targetDateStr) {
        const startDate = parseLocalDate(startDateStr);
        const targetDate = parseLocalDate(targetDateStr);
        const diffMs = targetDate.getTime() - startDate.getTime();
        const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
        return Math.max(1, Math.floor(diffDays / 7) + 1);
    }

    /**
     * 시작일(1주차 시작일)과 주차 번호(1, 2, 3...)를 받아 해당 주차의 시작일과 종료일(7일 구간)을 반환합니다.
     */
    static getWeekDateRange(startDateStr, weekNumber) {
        const startDate = parseLocalDate(startDateStr);
        const weekStart = new Date(startDate);
        weekStart.setDate(weekStart.getDate() + (weekNumber - 1) * 7);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        return {
            weekStartStr: getLocalDateString(weekStart),
            weekEndStr: getLocalDateString(weekEnd)
        };
    }

    /**
     * 체지방률과 골격근 여유분을 바탕으로 주간 안전 감량폭(kg)을 계산합니다.
     */
    static computeWeeklySafeLossKg(weightKg, fatPercent, fatMassKg, muscleKg, minTargetMuscleKg, recentMuscleDeltaKg = 0) {
        let baseWeeklyRatePercent = 0.65;
        if (fatPercent >= 27.0) {
            baseWeeklyRatePercent = 0.76;
        } else if (fatPercent >= 24.0) {
            baseWeeklyRatePercent = 0.70;
        } else if (fatPercent >= 21.0) {
            baseWeeklyRatePercent = 0.62;
        } else if (fatPercent >= 19.0) {
            baseWeeklyRatePercent = 0.54;
        } else {
            baseWeeklyRatePercent = 0.45;
        }

        const muscleSafetyBufferKg = this.round2(muscleKg - minTargetMuscleKg);
        let muscleDefenseFactor = 1.0;
        if (muscleSafetyBufferKg < 0.3 || recentMuscleDeltaKg <= -0.4) {
            muscleDefenseFactor = 0.68;
        } else if (muscleSafetyBufferKg < 1.0 || recentMuscleDeltaKg <= -0.2) {
            muscleDefenseFactor = 0.85;
        }

        const weeklySafeLossRatePercent = this.round2(baseWeeklyRatePercent * muscleDefenseFactor);
        const rawWeeklyLossKg = weightKg * (weeklySafeLossRatePercent / 100);
        const maxSafeFatLossPerWeekKg = ((fatMassKg * 69 * 7) / 7700) * 0.80;
        const clampedWeeklyLoss = Math.min(rawWeeklyLossKg, maxSafeFatLossPerWeekKg);
        const weeklyTargetLossKg = this.round2(Math.max(0.35, Math.min(1.10, clampedWeeklyLoss)));

        return {
            weeklySafeLossRatePercent,
            weeklyTargetLossKg,
            muscleSafetyBufferKg
        };
    }

    /**
     * 성별, 나이, 키, 체중, 체지방률, 직업군, 근무 형태(좌식/입식), 하루 근무 시간, 주간 근무 일수, 주간 운동 횟수를 바탕으로
     * 기초대사량(BMR)과 근무 중 활동대사량(Occupational NEAT), 총 일일 평균 소모 칼로리(TDEE)를 정밀 산출합니다.
     */
    static computeOccupationalTdee({
        gender = "MALE",
        age = 32,
        heightCm = 184,
        weightKg = 104.4,
        fatPercent = 28.6,
        occupationCode = "OFFICE_IT",
        workPostureCode = "MOSTLY_SITTING",
        dailyWorkHours = 8,
        weeklyWorkDays = 5,
        weeklyWorkoutSessions = 4,
        workoutIntensityCode = "MODERATE_HYPERTROPHY",
        recommendedDailyDeficitKcal = 850
    }) {
        const safeWeight = Math.max(35, Number(weightKg) || 104.4);
        const safeHeight = Math.max(120, Number(heightCm) || 184);
        const safeAge = Math.max(14, Math.min(90, Number(age) || 32));
        const safeFatPct = Math.max(5, Math.min(60, Number(fatPercent) || 28.6));
        const safeWorkHours = Math.max(0, Math.min(18, Number(dailyWorkHours) || 8));
        const safeWorkDays = Math.max(0, Math.min(7, Number(weeklyWorkDays) || 5));
        const safeWorkouts = Math.max(0, Math.min(7, Number(weeklyWorkoutSessions) || 4));

        const leanBodyMassKg = safeWeight * (1 - safeFatPct / 100);
        const katchBmr = 370 + 21.6 * leanBodyMassKg;
        const mifflinBmr =
            10 * safeWeight +
            6.25 * safeHeight -
            5 * safeAge +
            (gender === "FEMALE" ? -161 : 5);

        const bmrKcal = Math.round(katchBmr * 0.65 + mifflinBmr * 0.35);

        const occupation = OccupationProfiles[occupationCode] || OccupationProfiles.OFFICE_IT;
        const posture = WorkPostureProfiles[workPostureCode] || WorkPostureProfiles.MOSTLY_SITTING;
        const intensity = WorkoutIntensityProfiles[workoutIntensityCode] || WorkoutIntensityProfiles.MODERATE_HYPERTROPHY;

        const bmrPerHour = bmrKcal / 24;
        const effectiveWorkMets = Math.max(1.2, occupation.workMets * posture.factor);

        // 근무일 1일 기준 근무 시간 동안 기초대사량 초과로 소모되는 순수 직업 활동 칼로리
        const workDayExtraKcal = Math.round(bmrPerHour * (effectiveWorkMets - 1.0) * safeWorkHours);
        // 주간 근무일수(예: 주 5일)를 반영한 일평균 근무 활동 칼로리
        const avgDailyWorkNeatKcal = Math.round(workDayExtraKcal * (safeWorkDays / 7));

        // 비근무 일상 활동 칼로리(출퇴근, 보행, 일상 생활 NEAT)
        const nonWorkNeatKcal = Math.round(occupation.baseNonWorkNeatKcal * (safeWeight / 80));

        // 운동 소모 칼로리(선택한 운동 강도 × 체중 비례 소모량 -> 주간 평균 일일 환산)
        const singleWorkoutKcal = Math.round(safeWeight * intensity.kcalPerKgSession);
        const avgDailyExerciseKcal = Math.round((singleWorkoutKcal * safeWorkouts) / 7);

        // 음식 열효과(TEF, 약 8%)
        const subtotalKcal = bmrKcal + avgDailyWorkNeatKcal + nonWorkNeatKcal + avgDailyExerciseKcal;
        const tefKcal = Math.round(subtotalKcal * 0.08);

        const estimatedDailyTdeeKcal = subtotalKcal + tefKcal;
        const recommendedIntakeKcal = Math.max(
            gender === "FEMALE" ? 1200 : 1450,
            Math.round((estimatedDailyTdeeKcal - recommendedDailyDeficitKcal) / 10) * 10
        );

        return {
            bmrKcal,
            occupationLabel: occupation.label,
            postureLabel: posture.label,
            dailyWorkHours: safeWorkHours,
            weeklyWorkDays: safeWorkDays,
            workDayExtraKcal,
            avgDailyWorkNeatKcal,
            nonWorkNeatKcal,
            avgDailyExerciseKcal,
            tefKcal,
            estimatedDailyTdeeKcal,
            recommendedIntakeKcal
        };
    }

    /**
     * 인바디 측정치가 없는 신규 사용자를 위해 성별·나이·키·체중 기반으로
     * 추정 체지방률, 골격근량 및 프로그램 목적별 권장 목표치(체중·골격근·체지방률)를 산출합니다.
     */
    static estimateBodyComposition({
        gender = "MALE",
        age = 30,
        heightCm = 175,
        weightKg = 78,
        programGoalType = "DIET"
    }) {
        const w = Math.max(35, Number(weightKg) || 78);
        const h = Math.max(130, Number(heightCm) || 175);
        const a = Math.max(14, Math.min(90, Number(age) || 30));
        const hM = h / 100;
        const bmi = w / (hM * hM);
        const isMale = gender !== "FEMALE";

        // Deurenberg & Gallagher 한국인/아시아인 체형 보정 체지방률 추정식
        const rawFatPct = 1.20 * bmi + 0.23 * a - (isMale ? 10.8 : 0) - 5.4;
        const estimatedFatPercent = this.round1(
            Math.max(isMale ? 8.0 : 14.0, Math.min(isMale ? 45.0 : 50.0, rawFatPct))
        );
        const estimatedFatMassKg = this.round2(w * (estimatedFatPercent / 100));
        const leanMassKg = Math.max(25, w - estimatedFatMassKg);
        // 골격근량(SMM)은 제지방량(FFM)의 약 56~58% (남성 약 57.5%, 여성 약 54.0%)
        const estimatedMuscleKg = this.round2(leanMassKg * (isMale ? 0.575 : 0.54));

        return this.recommendTargetsFromCurrent({
            gender,
            weightKg: w,
            muscleKg: estimatedMuscleKg,
            fatPercent: estimatedFatPercent,
            programGoalType
        });
    }

    /**
     * 현재 신체 수치와 프로그램 목적(DIET / RECOMP / HYPERTROPHY / STRENGTH)을 바탕으로
     * 가장 이상적인 목표 체중, 목표 방어/도달 골격근량, 목표 체지방률을 추천합니다.
     */
    static recommendTargetsFromCurrent({
        gender = "MALE",
        weightKg,
        currentWeightKg,
        muscleKg,
        currentMuscleKg,
        fatPercent,
        currentFatPercent,
        programGoalType = "DIET"
    }) {
        const isMale = gender !== "FEMALE";
        const w = Math.max(35, Number(currentWeightKg ?? weightKg) || 80);
        const m = Math.max(15, Number(currentMuscleKg ?? muscleKg) || 34);
        const fp = Math.max(6, Math.min(55, Number(currentFatPercent ?? fatPercent) || 25));
        const currentFatMass = w * (fp / 100);
        const ffm = Math.max(25, w - currentFatMass);

        let targetFatPercent = fp;
        let minTargetMuscleKg = m;
        let targetWeightKg = w;

        if (programGoalType === "DIET") {
            targetFatPercent = isMale
                ? this.round1(Math.max(14.0, Math.min(20.0, fp - 7.5)))
                : this.round1(Math.max(20.0, Math.min(25.0, fp - 7.0)));
            minTargetMuscleKg = this.round1(Math.max(15, m - 0.8));
            const targetFfm = Math.max(25, ffm - 0.8);
            targetWeightKg = this.round1(targetFfm / (1 - targetFatPercent / 100));
            if (targetWeightKg >= w - 1.5) {
                targetWeightKg = this.round1(Math.max(40, w - 5.0));
            }
        } else if (programGoalType === "RECOMP") {
            targetFatPercent = isMale
                ? this.round1(Math.max(13.5, fp - 4.5))
                : this.round1(Math.max(19.5, fp - 4.5));
            minTargetMuscleKg = this.round1(m + 1.0);
            const targetFfm = ffm + 1.5;
            targetWeightKg = this.round1(Math.min(w - 2.0, targetFfm / (1 - targetFatPercent / 100)));
        } else if (programGoalType === "HYPERTROPHY") {
            const highFatThreshold = isMale ? 23.0 : 30.0;
            if (fp >= highFatThreshold) {
                targetFatPercent = this.round1(fp - 5.0);
                minTargetMuscleKg = this.round1(m + 1.2);
                const targetFfm = ffm + 1.8;
                targetWeightKg = this.round1(targetFfm / (1 - targetFatPercent / 100));
            } else {
                targetFatPercent = this.round1(Math.min(isMale ? 18.0 : 25.0, fp + 1.0));
                minTargetMuscleKg = this.round1(m + 2.0);
                targetWeightKg = this.round1(w + 3.0);
            }
        } else {
            // STRENGTH
            const highFatThreshold = isMale ? 24.0 : 31.0;
            if (fp >= highFatThreshold) {
                targetFatPercent = this.round1(fp - 5.5);
                minTargetMuscleKg = this.round1(m + 0.5);
                const targetFfm = ffm + 0.8;
                targetWeightKg = this.round1(targetFfm / (1 - targetFatPercent / 100));
            } else {
                targetFatPercent = this.round1(fp);
                minTargetMuscleKg = this.round1(m + 1.5);
                targetWeightKg = this.round1(w + 2.0);
            }
        }

        return {
            estimatedMuscleKg: m,
            skeletalMuscleMassKg: m,
            estimatedFatPercent: fp,
            bodyFatPercentage: fp,
            estimatedFatMassKg: this.round2(currentFatMass),
            recommendedTargetWeightKg: targetWeightKg,
            targetWeightKg,
            recommendedTargetMuscleKg: minTargetMuscleKg,
            minTargetSkeletalMuscleKg: minTargetMuscleKg,
            recommendedTargetFatPercent: targetFatPercent,
            targetBodyFatPercent: targetFatPercent
        };
    }

    /**
     * 사용자의 신체 스펙, 목표 수치, 프로그램 목적, 운동 빈도·강도·숙련도 및 선택 기간(일수)을 분석하여
     * 추천 일수, 주당 변화 속도, 일일 섭취 칼로리/단백질, 그리고 인용수 높은 국제 학술 논문 근거 장단점을 반환합니다.
     */
    static evaluateDurationPlan({
        gender = "MALE",
        age = 32,
        heightCm = 184,
        currentWeightKg = 104.4,
        currentMuscleKg = 42.8,
        currentFatPercent = 28.6,
        targetWeightKg = 90.0,
        minTargetMuscleKg,
        targetMuscleKg,
        targetFatPercent = 19.5,
        programGoalType = "DIET",
        weeklyWorkoutSessions = 4,
        workoutIntensityCode = "MODERATE_HYPERTROPHY",
        trainingExperienceCode = "INTERMEDIATE",
        occupationCode = "OFFICE_IT",
        workPostureCode = "MOSTLY_SITTING",
        dailyWorkHours = 8,
        weeklyWorkDays = 5,
        customDurationDays = null,
        selectedDurationDays = null
    }) {
        const w = Math.max(35, Number(currentWeightKg) || 80);
        const tw = Math.max(35, Number(targetWeightKg) || 75);
        const m = Math.max(15, Number(currentMuscleKg) || 34);
        const tm = Math.max(15, Number(minTargetMuscleKg ?? targetMuscleKg) || 33);
        const fp = Math.max(5, Math.min(55, Number(currentFatPercent) || 25));
        const fatMassKg = this.round2(w * (fp / 100));

        const program = ProgramGoalProfiles[programGoalType] || ProgramGoalProfiles.DIET;
        const expProfile = TrainingExperienceProfiles[trainingExperienceCode] || TrainingExperienceProfiles.INTERMEDIATE;

        const weightDiffKg = this.round2(w - tw); // 양수면 감량, 음수면 증량
        const isWeightLoss = weightDiffKg >= 0;
        const absWeightChangeKg = Math.max(0.5, Math.abs(weightDiffKg));

        // 1. 과학적 3대 속도 기준 산출
        // 1) 표준 지속가능 감량: NCBI StatPearls(Management of Weight Loss Plateau) 및 Helms et al. 2014 표준 (주당 0.5kg~1.0kg, 체중의 약 0.7%)
        // 2) 집중 가속 감량: Purcell et al. (2014, The Lancet) 및 유럽비만학회(ECO) 노르웨이 284명 RCT 임상 기준 (주당 체중의 약 1.0%, ~0.80~1.10kg/주)
        // 3) 완만 근육방어/리컴포지션: Garthe et al. (2011, IJSNEM) 기준 (주당 체중의 약 0.45%, ~0.35~0.50kg/주)
        let standardWeeklyRateKg = 0.55;
        let acceleratedWeeklyRateKg = 0.85;
        let gentleWeeklyRateKg = 0.38;

        if (!isWeightLoss) {
            standardWeeklyRateKg = this.round2(Math.max(0.18, Math.min(0.35, w * 0.003 * expProfile.paceFactor)));
            acceleratedWeeklyRateKg = this.round2(Math.max(0.30, Math.min(0.55, w * 0.005 * expProfile.paceFactor)));
            gentleWeeklyRateKg = this.round2(Math.max(0.12, Math.min(0.22, w * 0.0018 * expProfile.paceFactor)));
        } else {
            standardWeeklyRateKg = this.round2(Math.max(0.50, Math.min(0.85, w * 0.007)));
            acceleratedWeeklyRateKg = this.round2(Math.max(0.75, Math.min(1.15, w * 0.0105)));
            gentleWeeklyRateKg = this.round2(Math.max(0.30, Math.min(0.50, w * 0.0045)));
        }

        const optimalWeeklyChangeKg = standardWeeklyRateKg;

        // 2. 전략별 필요 일수 산출 (7일 단위 반올림, 단조 비례 정렬)
        const standardDays = Math.max(14, Math.min(364, Math.round((absWeightChangeKg / standardWeeklyRateKg) * 7 / 7) * 7 || 14));
        const acceleratedDays = Math.max(14, Math.min(364, Math.round((absWeightChangeKg / acceleratedWeeklyRateKg) * 7 / 7) * 7 || 14));
        const gentleDays = Math.max(14, Math.min(364, Math.round((absWeightChangeKg / gentleWeeklyRateKg) * 7 / 7) * 7 || 14));

        const recommendedDays = standardDays;
        const minAllowedDays = Math.max(14, Math.min(acceleratedDays, Math.round(acceleratedDays * 0.8)));
        const maxAllowedDays = Math.min(540, Math.max(gentleDays + 42, Math.round(gentleDays * 1.3)));

        const effectiveCustomDays = selectedDurationDays ?? customDurationDays;
        const selectedDays = effectiveCustomDays != null && Number(effectiveCustomDays) > 0
            ? Math.max(7, Math.min(730, Math.round(Number(effectiveCustomDays))))
            : recommendedDays;

        const selectedWeeks = this.round1(selectedDays / 7);
        const recommendedWeeks = this.round1(recommendedDays / 7);
        const daysDeltaFromRecommended = selectedDays - recommendedDays; // 음수: 앞당김(단축), 양수: 늘림(연장)

        // 선택된 일수 기준 주간 변화량 및 체중 대비 주간 변화율(%)
        const absWeeklyChangeKg = this.round2((absWeightChangeKg / selectedDays) * 7);
        const selectedWeeklyChangeKg = isWeightLoss ? -absWeeklyChangeKg : absWeeklyChangeKg;
        const selectedWeeklyRatePct = this.round2((absWeeklyChangeKg / w) * 100);

        // 일일 에너지 적자(감량) 또는 흑자(증량) kcal 계산 (체조직 1kg당 약 7,700 kcal 기준)
        const dailyEnergyDeltaKcal = Math.round((absWeightChangeKg * 7700) / selectedDays);
        // Alpert (2005) 인체 지방 세포 일일 최대 에너지 방출 한계 (체지방 1kg당 약 69 kcal/일)
        const alpertMaxDailyDeficitKcal = Math.round(fatMassKg * 69);

        // TDEE 산출
        const tdeeInfo = this.computeOccupationalTdee({
            gender,
            age,
            heightCm,
            weightKg: w,
            fatPercent: fp,
            occupationCode,
            workPostureCode,
            dailyWorkHours,
            weeklyWorkDays,
            weeklyWorkoutSessions,
            workoutIntensityCode,
            recommendedDailyDeficitKcal: isWeightLoss ? dailyEnergyDeltaKcal : -dailyEnergyDeltaKcal
        });

        // 권장 일일 섭취 칼로리 및 탄/단/지 계산
        const minSafeIntake = gender === "FEMALE" ? 1150 : 1400;
        const rawTargetCalories = isWeightLoss
            ? tdeeInfo.estimatedDailyTdeeKcal - dailyEnergyDeltaKcal
            : tdeeInfo.estimatedDailyTdeeKcal + dailyEnergyDeltaKcal;
        const recommendedDailyCalories = Math.max(minSafeIntake, Math.round(rawTargetCalories / 10) * 10);

        // 단축 감량일수록 근손실 방어를 위해 단백질 계수 상향 (Morton et al., 2018; Helms et al., 2014)
        let proteinFactor = program.proteinPerKg;
        if (isWeightLoss && selectedWeeklyRatePct > 0.85) {
            proteinFactor = Math.max(proteinFactor, 2.3);
        }
        const ffmKg = Math.max(30, w - fatMassKg);
        const recommendedProteinG = Math.round(Math.max(w * 1.6, Math.min(w * 2.5, ffmKg * (proteinFactor + 0.35))));
        const recommendedFatG = Math.round(Math.max(45, (recommendedDailyCalories * 0.27) / 9));
        const remainingCarbKcal = Math.max(200, recommendedDailyCalories - (recommendedProteinG * 4 + recommendedFatG * 9));
        const recommendedCarbsG = Math.round(remainingCarbKcal / 4);

        // 예상 목표 달성 날짜
        const targetDateObj = new Date();
        targetDateObj.setDate(targetDateObj.getDate() + selectedDays);
        const estimatedEndDateStr = getLocalDateString(targetDateObj);

        // 3. 기간 단축(앞당김) / 표준 / 연장(늘림) 여부에 따른 학술 논문 기반 장단점 분석 생성
        let paceStatusLabel = "";
        let paceBadgeClass = "";
        let paceSummaryText = "";
        const prosList = [];
        const consList = [];

        if (!isWeightLoss) {
            if (daysDeltaFromRecommended <= -10 || selectedWeeklyRatePct > 0.5) {
                paceStatusLabel = `기간 단축 공격적 증량 (${Math.abs(daysDeltaFromRecommended)}일 앞당김 · 주 +${absWeeklyChangeKg}kg)`;
                paceBadgeClass = "badge-warning";
                paceSummaryText = `권장 기간(${recommendedDays}일)보다 ${Math.abs(daysDeltaFromRecommended)}일 앞당겨 하루 +${dailyEnergyDeltaKcal.toLocaleString()}kcal 흑자를 내는 공격적 벌크업 설정입니다.`;
                prosList.push({
                    title: "단기 절대 스트렝스(1RM) 및 훈련 회복력 극대화",
                    detail: "높은 탄수화물·칼로리 잉여로 근글리코겐이 포화 상태를 유지하여 고중량 다관절 운동 수행능력이 빠르게 상승합니다.",
                    citation: "Slater et al. (2019), Frontiers in Nutrition (인용 220+회)"
                });
                consList.push(
                    {
                        title: "골격근 합성 상한 초과로 인한 체지방 약 5배 급증",
                        detail: "엘리트 훈련생 대상 무작위 대조 임상에서 과도한 칼로리 잉여로 기간을 앞당긴 고속 증량군은 완만 증량군과 골격근 증가량은 차이가 없었던 반면 체지방 증가량이 약 5배 더 높았습니다.",
                        citation: "Garthe et al. (2013), European Journal of Sport Science (RCT 임상)"
                    },
                    {
                        title: "근단백질 합성(MPS) 생리적 상한선 존재",
                        detail: "49개 임상(표본 N=1,863명) 메타분석 결과 골격근 합성 속도에는 상한선이 존재하므로 초과 칼로리의 상당 부분이 피하 및 내장 지방으로 축적됩니다.",
                        citation: "Morton et al. (2018), British Journal of Sports Medicine (N=1,863 메타분석, 인용 1,900+회)"
                    }
                );
            } else if (daysDeltaFromRecommended >= 10 || selectedWeeklyRatePct < 0.22) {
                paceStatusLabel = `기간 연장 클린 린매스업 (+${daysDeltaFromRecommended}일 늘림 · 주 +${absWeeklyChangeKg}kg)`;
                paceBadgeClass = "badge-blue";
                paceSummaryText = `권장 기간(${recommendedDays}일)보다 ${daysDeltaFromRecommended}일 여유 있게 늘려 하루 +${dailyEnergyDeltaKcal.toLocaleString()}kcal 수준의 정밀 흑자를 유지하는 린매스업 설정입니다.`;
                prosList.push({
                    title: "체지방 축적 억제 및 순수 골격근(FFM) 증가 비율 극대화",
                    detail: "일일 +200~300kcal 수준의 정밀 흑자 구간으로, 추후 별도의 커팅(다이어트) 기간을 최소화하면서 순수 근육량만 점진적으로 늘리기에 가장 이상적입니다.",
                    citation: "Garthe et al. (2013, EJSS) & Slater et al. (2019, Frontiers in Nutrition)"
                });
                consList.push({
                    title: "목표 체중 도달 기간 연장 및 일일 활동량 오차 민감도",
                    detail: "하루 흑자 폭이 작기 때문에 유산소나 현장 근무 활동량이 급증한 날에는 유지 칼로리와 비슷해져 체중 증가 속도가 더딜 수 있습니다.",
                    citation: "Helms et al. (2019), Muscle & Strength Pyramid Nutrition"
                });
            } else {
                paceStatusLabel = `스포츠 영양학 표준 근비대·증량 속도 (권장 ${recommendedDays}일 기준)`;
                paceBadgeClass = "badge-lime";
                paceSummaryText = `골격근 합성에 필요한 최적 에너지 흑자(+${dailyEnergyDeltaKcal.toLocaleString()}kcal/일)와 체지방 제어 균형이 가장 뛰어난 표준 기간입니다.`;
                prosList.push({
                    title: "근단백질 합성 극대화 및 체지방 상승 최소화 균형",
                    detail: "최적 단백질(체중 kg당 1.6~2.2g)과 소폭의 에너지 흑자가 결합되어 체지방 축적 없이 근비대 효율을 극대화합니다.",
                    citation: "Morton et al. (2018), British Journal of Sports Medicine (49개 임상·N=1,863 메타분석)"
                });
                consList.push({
                    title: "점진적 과부하(중량·볼륨) 모니터링 필수",
                    detail: "단기 급속 벌크업에 비해 체중계 수치 변화가 완만하므로 매주 훈련 중량과 반복수 증가를 함께 추적해야 합니다.",
                    citation: "Schoenfeld et al. (2017), Journal of Strength and Conditioning Research (메타분석)"
                });
            }
        } else {
            const isAccelerated =
                selectedWeeklyRatePct >= 0.85 ||
                selectedDays <= acceleratedDays + 4;
            const isGentle =
                selectedWeeklyRatePct <= 0.50 ||
                selectedDays >= gentleDays - 4;

            if (isAccelerated) {
                paceStatusLabel = `집중 가속 감량 모드 (Purcell et al. 2014 & 노르웨이 ECO 284명 임상 기준)`;
                paceBadgeClass = "badge-orange";
                paceSummaryText = `권장 표준보다 기간을 앞당겨 주당 -${absWeeklyChangeKg}kg(체중의 ${selectedWeeklyRatePct}%), 하루 -${dailyEnergyDeltaKcal.toLocaleString()}kcal 적자로 진행하는 단기 집중 감량 설정입니다. 란셋(The Lancet, Purcell et al., 2014) 및 유럽비만학회(ECO, 노르웨이 284명 RCT) 연구에서 입증된 높은 순응도 및 신속 대사 개선 전략입니다.`;

                prosList.push(
                    {
                        title: "단기 15% 감량 목표 달성률 81% (vs 완만 감량군 50%) 및 다이어트 피로 극복",
                        detail: "204명 대상 무작위 대조 임상(RCT)에서 12주 단기 집중 감량군은 다이어트 장기화로 인한 심리적 피로(Diet Fatigue)와 중도 탈락을 방지하여 81%가 목표 체중에 도달한 반면, 36주 완만 감량군은 50%에 그쳤습니다.",
                        citation: "Purcell et al. (2014), The Lancet Diabetes & Endocrinology (표본 N=204 RCT, 인용 450+회)"
                    },
                    {
                        title: "1년 후 건강 지표(BMI ≤ 27, 허리둘레) 달성 및 대사 질환 위험 감소 우위",
                        detail: "비만 성인 284명을 대상으로 한 1년 추적 RCT(Treat-to-target 분석) 결과, 의학적 관리 하의 16주 급속 감량군이 완만 감량군 대비 목표 BMI 및 허리둘레 도달률이 유의미하게 높았으며 1년 후 심혈관·당뇨 위험 지표가 더 우수하게 유지되었습니다.",
                        citation: "Line Kristin Johnson et al. (2024/2026), 유럽비만학회(ECO) 발표 · 노르웨이 베스트폴 병원 (비만 성인 N=284 RCT)"
                    },
                    {
                        title: "감량 속도와 요요 현상(체중 재증가율)의 무관성 입증 (핵심은 감량 후 유지기)",
                        detail: "144주(약 2.7년) 장기 추적 결과 감량 속도(단기 급속 vs 완만 감량)에 따른 장기 체중 재증가율(71% vs 76%)에는 통계적 차이가 없었습니다. 체중 감량 성공의 결정적 요인은 감량 속도가 아닌 '감량 종료 후 유지기(Maintenance Phase) 습관 지속'에 있습니다.",
                        citation: "Purcell et al. (2014), The Lancet & NCBI StatPearls (Management of Weight Loss Plateau)"
                    }
                );
                consList.push(
                    {
                        title: `고단백(${recommendedProteinG}g/일, 체중 kg당 1.6~2.2g) 및 주 3~4회 근력 운동 필수`,
                        detail: "에너지 결핍 폭이 크므로 골격근량(제지방)을 방어하기 위해 체중 kg당 1.6~2.2g 이상의 고단백 식단과 대근육 위주 저항성 운동이 반드시 병행되어야 합니다.",
                        citation: "NCBI StatPearls (Management of Weight Loss Plateau) & Morton et al. (2018, BJSM, N=1,863)"
                    },
                    {
                        title: "감량 종료 후 계획된 유지기(Maintenance Architecture) 및 리버스 다이어트 필수",
                        detail: "감량 완료 직후 일반식으로 급격히 회귀할 경우 적응 열발생(Adaptive Thermogenesis)과 식욕 호르몬 반등으로 요요가 올 수 있으므로, 칼로리를 단계적으로 복구하는 유지기 계획이 필수입니다.",
                        citation: "NCBI StatPearls (Weight Loss Plateau) & Hall et al. (2011, The Lancet)"
                    },
                    {
                        title: "선수급 1RM 최대 근력 유지 목적 시 주의",
                        detail: "체지방률이 이미 낮은 상태(남성 14% 이하, 여성 22% 이하)에서의 가속 감량은 지방 산화 한계(Alpert, 2005)에 의해 최대 근력(1RM) 저하가 발생할 수 있습니다.",
                        citation: "Garthe et al. (2011, IJSNEM) & Helms et al. (2014, JISSN)"
                    }
                );
            } else if (isGentle) {
                paceStatusLabel = `완만 근육방어·리컴포지션 모드 (Garthe et al. 2011 & Helms 2014)`;
                paceBadgeClass = "badge-blue";
                paceSummaryText = `권장 기간보다 여유 있게 늘려 주당 -${absWeeklyChangeKg}kg(체중의 ${selectedWeeklyRatePct}%), 하루 -${dailyEnergyDeltaKcal.toLocaleString()}kcal의 소폭 적자로 진행하는 골격근 극대화 설정입니다.`;

                prosList.push(
                    {
                        title: "체지방 감량과 동시에 순수 골격근 증가(+2.1%) 및 1RM 근력 향상 입증",
                        detail: "엘리트 선수 대상 RCT에서 완만 감량군(주당 0.7% 이하)은 체지방을 31% 감량하면서 동시에 제지방량(골격근)이 +2.1% 증가하고 1RM 중량이 +11.3% 향상되었습니다.",
                        citation: "Garthe et al. (2011), Int J Sport Nutr Exerc Metab (인용 650+회)"
                    },
                    {
                        title: "운동 수행 능력 및 근비대 신호 온전 보존",
                        detail: "일일 결핍이 -300~-500 kcal 이내로 작아 근단백질 합성(MPS) 신호가 억제되지 않으며 고중량 트레이닝 볼륨을 100% 소화할 수 있습니다.",
                        citation: "Murphy & Koehler (2022, Scand J Med Sci Sports, N=1,548 메타분석)"
                    },
                    {
                        title: "기초대사량(RMR) 보존(+70.5 kcal/일 우위) 및 식단 피로 최소화",
                        detail: "18개 임상(표본 N=1,141명) 메타분석 결과 완만 감량군은 급속 감량군 대비 기초대사량 하락이 현저히 적어 일상 식단을 편안하게 유지할 수 있습니다.",
                        citation: "Ashtary-Larky et al. (2020), British Journal of Nutrition (18개 임상·N=1,141 메타분석)"
                    }
                );
                consList.push(
                    {
                        title: `최종 목표 체중(${tw}kg) 도달까지 총 소요 일수 연장 (${selectedDays}일)`,
                        detail: "하루 적자 폭이 완만하므로 단기간에 급격한 체중계 수치 하락을 기대할 경우 초반 체중 변화가 느리게 느껴질 수 있습니다.",
                        citation: "Helms et al. (2014), JISSN"
                    },
                    {
                        title: `작은 칼로리 적자(-${dailyEnergyDeltaKcal.toLocaleString()} kcal/일)로 인한 식단 오차 민감도 증가`,
                        detail: "주말 외식이나 음료 한두 잔의 칼로리 오차만으로도 일주일치 감량 적자가 상쇄되어 실제 목표 도달이 지연될 수 있습니다.",
                        citation: "Hall et al. (2011), The Lancet"
                    }
                );
            } else {
                paceStatusLabel = `표준 지속가능 권장 모드 (NCBI StatPearls & Helms 2014 의학 표준)`;
                paceBadgeClass = "badge-lime";
                paceSummaryText = `주당 -${absWeeklyChangeKg}kg(체중의 ${selectedWeeklyRatePct}%), 하루 -${dailyEnergyDeltaKcal.toLocaleString()}kcal 적자로 진행하는 의학적 표준 권장 설정입니다. NCBI StatPearls(Management of Weight Loss Plateau)에서 제시하는 주당 0.5~1.0kg(체중의 약 0.7%) 감량 속도에 정확히 부합합니다.`;

                prosList.push(
                    {
                        title: "정체기(Weight Loss Plateau) 및 대사 저하 억제 (NCBI StatPearls 권고)",
                        detail: "의학적으로 권고되는 주당 0.5kg~1.0kg(체중의 약 0.7%) 감량 속도로, 기초대사량(RMR) 급락과 적응 열발생을 방어하여 6~12주 차 정체기 발생 위험을 최소화합니다.",
                        citation: "NCBI StatPearls (Management of Weight Loss Plateau, 2023/2024)"
                    },
                    {
                        title: "골격근 보존과 일상 지속 가능성의 황금 균형",
                        detail: "극단적인 결핍 없이 일상 식단을 유지할 수 있어 공복 호르몬(그렐린)의 급증을 억제하고 장기적인 건강 습관 형성에 가장 안정적입니다.",
                        citation: "Helms et al. (2014, JISSN, 인용 900+회) & Ashtary-Larky et al. (2020, BJN, N=1,141)"
                    },
                    {
                        title: "체지방 선별 산화 및 단백질 절약 효과",
                        detail: "체내 지방 저장소에서 에너지를 안정적으로 동원하여 골격근 아미노산 분해를 방어하며 3대 운동 퍼포먼스를 유지합니다.",
                        citation: "Alpert S.S. (2005, JTB) & Morton et al. (2018, BJSM)"
                    }
                );
                consList.push({
                    title: "주간 단위의 일관된 루틴 준수 필요",
                    detail: `점진적으로 체중이 감량되므로 목표 달성까지 ${selectedWeeks}주 동안 매주 꾸준한 기록과 규칙적인 식단 준수가 요구됩니다.`,
                    citation: "Hall & Kahan (2018), Medical Clinics of North America"
                });
            }
        }

        const formulaText = `목표 변화량 ${absWeightChangeKg.toFixed(1)}kg ÷ 선택 주간 속도 ${absWeeklyChangeKg.toFixed(2)}kg/주 = 약 ${selectedWeeks}주 (${selectedDays}일)`;
        const scientificEvidenceText = isWeightLoss
            ? `NCBI StatPearls(Management of Weight Loss Plateau)에 따르면 주당 0.5kg~1.0kg(체중의 약 0.7%, 현재 기준 주당 ${standardWeeklyRateKg.toFixed(2)}kg) 감량이 의학적 권장 표준입니다. 최근 란셋(Purcell et al., 2014) 및 유럽비만학회(ECO, 노르웨이 284명 RCT) 연구는 장기 체중 유지의 핵심이 감량 속도가 아닌 '감량 후 유지기(Maintenance Architecture)와 고단백·근력 운동 습관'임을 입증했습니다. 이에 따라 표준 코스(NCBI), 가속 코스(Purcell/ECO), 완만 코스(Garthe)를 자유롭게 선택할 수 있습니다.`
            : `골격근 중심의 린매스업을 위한 스포츠 영양학 권장 증량 속도는 주당 약 ${optimalWeeklyChangeKg.toFixed(2)}kg(체지방 축적 방지선)입니다 (Aragon et al., 2017).`;

        return {
            isWeightLoss,
            absWeightChangeKg,
            optimalWeeklyChangeKg,
            standardWeeklyRateKg,
            acceleratedWeeklyRateKg,
            gentleWeeklyRateKg,
            standardDays,
            acceleratedDays,
            gentleDays,
            formulaText,
            scientificEvidenceText,
            recommendedDays,
            recommendedWeeks,
            minAllowedDays,
            maxAllowedDays,
            selectedDays,
            selectedWeeks,
            daysDeltaFromRecommended,
            selectedWeeklyChangeKg,
            selectedWeeklyRatePct,
            dailyEnergyDeltaKcal,
            alpertMaxDailyDeficitKcal,
            estimatedDailyTdeeKcal: tdeeInfo.estimatedDailyTdeeKcal,
            bmrKcal: tdeeInfo.bmrKcal,
            recommendedDailyCalories,
            recommendedProteinG,
            recommendedCarbsG,
            recommendedFatG,
            estimatedEndDateStr,
            paceStatusLabel,
            paceBadgeClass,
            paceSummaryText,
            prosList,
            consList
        };
    }

    /**
     * 사용자의 프로필 및 체성분 기록 배열을 분석하여
     * 현재 상태, 직전 대비 증감, 현재 주차, 이전 기록, 이후 주차별 예상 몸무게 로드맵을 계산합니다.
     */
    static calculate(profile, records) {
        const sorted = [...records].sort((a, b) => a.recordDate.localeCompare(b.recordDate));
        const firstRecord = sorted.length > 0 ? sorted[0] : null;
        const latest = sorted.length > 0 ? sorted[sorted.length - 1] : null;
        const previous = sorted.length >= 2 ? sorted[sorted.length - 2] : null;

        const todayStr = getLocalDateString();
        const currentWeightKg = latest ? Number(latest.weightKg) : Number(profile.currentWeightKg);
        const currentMuscleKg = latest ? Number(latest.skeletalMuscleMassKg) : Number(profile.startSkeletalMuscleKg);
        const currentFatPercent = latest ? Number(latest.bodyFatPercentage) : Number(profile.startBodyFatPercent);
        const currentFatMassKg = latest && latest.bodyFatMassKg != null
            ? Number(latest.bodyFatMassKg)
            : this.round2(currentWeightKg * (currentFatPercent / 100));
        const latestDate = latest ? latest.recordDate : todayStr;

        const startDateStr = firstRecord ? firstRecord.recordDate : latestDate;
        const currentWeekNumber = this.calculateWeekNumber(startDateStr, latestDate);

        const heightM = Math.max(1.2, Number(profile.heightCm) / 100);
        const currentBmi = this.round1(currentWeightKg / (heightM * heightM));
        const fatFreeMassKg = Math.max(40, currentWeightKg - currentFatMassKg);
        const currentFfmi = this.round1(fatFreeMassKg / (heightM * heightM));

        const prevWeightKg = previous ? Number(previous.weightKg) : currentWeightKg;
        const prevMuscleKg = previous ? Number(previous.skeletalMuscleMassKg) : currentMuscleKg;
        const prevFatPercent = previous ? Number(previous.bodyFatPercentage) : currentFatPercent;
        const prevFatMassKg = previous && previous.bodyFatMassKg != null
            ? Number(previous.bodyFatMassKg)
            : this.round2(prevWeightKg * (prevFatPercent / 100));
        const prevBmi = this.round1(prevWeightKg / (heightM * heightM));

        const weightDeltaFromPrevKg = this.round2(currentWeightKg - prevWeightKg);
        const muscleDeltaFromPrevKg = this.round2(currentMuscleKg - prevMuscleKg);
        const fatMassDeltaFromPrevKg = this.round2(currentFatMassKg - prevFatMassKg);
        const fatPercentDeltaFromPrev = this.round1(currentFatPercent - prevFatPercent);
        const bmiDeltaFromPrev = this.round1(currentBmi - prevBmi);

        const minTargetMuscleKg = Number(profile.minTargetSkeletalMuscleKg);
        const targetWeightKg = Number(profile.targetWeightKg);
        const baseCalc = this.computeWeeklySafeLossKg(
            currentWeightKg,
            currentFatPercent,
            currentFatMassKg,
            currentMuscleKg,
            minTargetMuscleKg,
            muscleDeltaFromPrevKg
        );

        let weeklyTargetLossKg = baseCalc.weeklyTargetLossKg;
        let weeklySafeLossRatePercent = baseCalc.weeklySafeLossRatePercent;
        const muscleSafetyBufferKg = baseCalc.muscleSafetyBufferKg;

        // 사용자가 온보딩/목표 설정에서 커스텀 도달 일수(customTargetDurationDays)를 지정한 경우 반영
        const totalDiffFromStart = Math.abs(Number(profile.startWeightKg || currentWeightKg) - targetWeightKg);
        if (profile.customTargetDurationDays && Number(profile.customTargetDurationDays) >= 7 && totalDiffFromStart > 0.1) {
            const customDays = Number(profile.customTargetDurationDays);
            weeklyTargetLossKg = this.round2(Math.max(0.20, Math.min(2.20, (totalDiffFromStart / customDays) * 7)));
            weeklySafeLossRatePercent = this.round2((weeklyTargetLossKg / Math.max(35, currentWeightKg)) * 100);
        }

        // 현재 주차(시작일 기준 7일 단위)의 시작 체중 및 이번 주 남은 감량치 계산
        const currentWeekRange = this.getWeekDateRange(startDateStr, currentWeekNumber);
        const recordsBeforeThisWeek = sorted.filter(r => r.recordDate < currentWeekRange.weekStartStr);
        const recordsInThisWeek = sorted.filter(r => r.recordDate >= currentWeekRange.weekStartStr);

        let thisWeekStartWeightKg = currentWeightKg;
        if (recordsBeforeThisWeek.length > 0) {
            thisWeekStartWeightKg = Number(recordsBeforeThisWeek[recordsBeforeThisWeek.length - 1].weightKg);
        } else if (recordsInThisWeek.length > 0) {
            thisWeekStartWeightKg = Number(recordsInThisWeek[0].weightKg);
        }

        const thisWeekTargetWeightKg = this.round2(
            Math.max(targetWeightKg, thisWeekStartWeightKg - weeklyTargetLossKg)
        );
        const alreadyLostThisWeekKg = this.round2(Math.max(0, thisWeekStartWeightKg - currentWeightKg));
        const remainingToLoseThisWeekKg = this.round2(
            Math.max(0, weeklyTargetLossKg - alreadyLostThisWeekKg)
        );
        const weeklyProgressRatio = weeklyTargetLossKg > 0
            ? Math.min(1, Math.max(0, alreadyLostThisWeekKg / weeklyTargetLossKg))
            : 1;

        const initialStartWeightKg = firstRecord
            ? Number(firstRecord.weightKg)
            : Number(profile.startWeightKg || currentWeightKg);
        const profileStartWeightKg = Number(profile.startWeightKg || initialStartWeightKg);
        const isBulkMode = targetWeightKg > initialStartWeightKg + 0.1;

        // 이전 기록 리스트 (주차, 1주차 시작일 여부, 직전 대비 변화량, 해당 주차 목표 몸무게 및 목표 달성 성공 여부 포함)
        const pastRecordsWithMeta = sorted.map((rec, idx) => {
            const prevRec = idx > 0 ? sorted[idx - 1] : null;
            const w = Number(rec.weightKg);
            const m = Number(rec.skeletalMuscleMassKg);
            const fp = Number(rec.bodyFatPercentage);
            const fm = rec.bodyFatMassKg != null ? Number(rec.bodyFatMassKg) : this.round2(w * (fp / 100));
            const deltaW = prevRec ? this.round2(w - Number(prevRec.weightKg)) : 0;
            const weekNum = this.calculateWeekNumber(startDateStr, rec.recordDate);
            const weekRange = this.getWeekDateRange(startDateStr, weekNum);
            const recordsBeforeWeek = sorted.filter(r => r.recordDate < weekRange.weekStartStr);
            const recordsInThisWeekSoFar = sorted.filter(
                (r, rIdx) => rIdx <= idx && r.recordDate >= weekRange.weekStartStr && r.recordDate <= weekRange.weekEndStr
            );

            let weekStartWeightKg = initialStartWeightKg;
            if (recordsBeforeWeek.length > 0) {
                weekStartWeightKg = Number(recordsBeforeWeek[recordsBeforeWeek.length - 1].weightKg);
            } else if (recordsInThisWeekSoFar.length > 0) {
                weekStartWeightKg = Number(recordsInThisWeekSoFar[0].weightKg);
            }

            let weekTargetWeightKg = targetWeightKg;
            let isGoalSuccess = false;

            if (isBulkMode) {
                const targetFromWeekStart = this.round2(Math.min(targetWeightKg, weekStartWeightKg + weeklyTargetLossKg));
                const targetFromCumulative = this.round2(Math.min(targetWeightKg, initialStartWeightKg + weeklyTargetLossKg * weekNum));
                weekTargetWeightKg = Math.min(targetFromWeekStart, targetFromCumulative);
                if (idx === 0) {
                    const gainedFromProfileStart = this.round2(w - profileStartWeightKg);
                    isGoalSuccess = w >= targetWeightKg - 0.01 || gainedFromProfileStart >= weeklyTargetLossKg - 0.01;
                } else {
                    const gainedFromWeekStart = this.round2(w - weekStartWeightKg);
                    const gainedFromPrev = prevRec ? this.round2(w - Number(prevRec.weightKg)) : 0;
                    isGoalSuccess =
                        w >= weekTargetWeightKg - 0.01 ||
                        gainedFromWeekStart >= weeklyTargetLossKg - 0.01 ||
                        gainedFromPrev >= weeklyTargetLossKg - 0.01 ||
                        w >= targetWeightKg - 0.01;
                }
            } else {
                const targetFromWeekStart = this.round2(Math.max(targetWeightKg, weekStartWeightKg - weeklyTargetLossKg));
                const targetFromCumulative = this.round2(Math.max(targetWeightKg, initialStartWeightKg - weeklyTargetLossKg * weekNum));
                weekTargetWeightKg = Math.max(targetFromWeekStart, targetFromCumulative);
                if (idx === 0) {
                    const lostFromProfileStart = this.round2(profileStartWeightKg - w);
                    isGoalSuccess = w <= targetWeightKg + 0.01 || lostFromProfileStart >= weeklyTargetLossKg - 0.01;
                } else {
                    const lostFromWeekStart = this.round2(weekStartWeightKg - w);
                    const lostFromPrev = prevRec ? this.round2(Number(prevRec.weightKg) - w) : 0;
                    isGoalSuccess =
                        w <= weekTargetWeightKg + 0.01 ||
                        lostFromWeekStart >= weeklyTargetLossKg - 0.01 ||
                        lostFromPrev >= weeklyTargetLossKg - 0.01 ||
                        w <= targetWeightKg + 0.01;
                }
            }

            const isGoalFailed = !isGoalSuccess && idx > 0;
            const excessKg = isGoalFailed ? this.round2(Math.max(0, w - weekTargetWeightKg)) : 0;

            return {
                ...rec,
                weightKg: w,
                skeletalMuscleMassKg: m,
                bodyFatMassKg: fm,
                bodyFatPercentage: fp,
                deltaWeightKg: deltaW,
                weekNumber: weekNum,
                isStartRecord: idx === 0,
                weekStartWeightKg,
                weekTargetWeightKg,
                isGoalSuccess,
                isGoalFailed,
                excessKg
            };
        }).reverse();

        // 현재 주차의 종료일 도달 여부 및 목표 달성/실패 판별 (오늘 날짜 및 최근 기록 날짜 기준)
        const activeDateStr = latestDate > todayStr ? latestDate : todayStr;
        const diffDays = Math.floor((parseLocalDate(activeDateStr).getTime() - parseLocalDate(startDateStr).getTime()) / (1000 * 60 * 60 * 24));
        const daysIntoCurrentWeek = diffDays - (currentWeekNumber - 1) * 7;
        const isCurrentWeekFinished = activeDateStr >= currentWeekRange.weekEndStr || daysIntoCurrentWeek >= 6 || sorted.length >= 7;

        const isThisWeekGoalSuccess =
            sorted.length > 0 &&
            (pastRecordsWithMeta.some(r => r.weekNumber === currentWeekNumber && r.isGoalSuccess) ||
                (sorted.length > 1 && remainingToLoseThisWeekKg <= 0.01));

        let isThisWeekGoalFailed = false;
        let excessWeightKg = 0;
        if (!isThisWeekGoalSuccess && isCurrentWeekFinished && currentWeightKg > thisWeekTargetWeightKg + 0.01) {
            isThisWeekGoalFailed = true;
            excessWeightKg = this.round2(currentWeightKg - thisWeekTargetWeightKg);
        }

        // 초과 몸무게 만회 코스 (1WEEK: 1주일 집중 감량 / 1MONTH: 1달 4주 분할 감량)
        const catchupMode = profile.missedGoalCatchupMode || "1MONTH";
        const excessPerWeekMonth = this.round2(excessWeightKg / 4);
        const catchupKcal1Week = Math.round((excessWeightKg * 7700) / 7);
        const catchupKcal1Month = Math.round((excessWeightKg * 7700) / 28);

        // 이후 주차별 예상 몸무게 시뮬레이션 로드맵 생성 (1주차 시작일 기준 7일 단위)
        const futureWeeklyRoadmap = [];
        let simWeight = currentWeightKg;
        let simFatMass = currentFatMassKg;
        let weekOffset = 1;

        // 먼저 현재 진행 중인 주차의 종료 행 추가
        const thisWeekEndWeight = this.round2(Math.max(targetWeightKg, currentWeightKg - remainingToLoseThisWeekKg));
        const thisWeekEndFatMass = this.round2(Math.max(5, simFatMass - remainingToLoseThisWeekKg * 0.9));
        futureWeeklyRoadmap.push({
            weekNumber: currentWeekNumber,
            isCurrentWeek: true,
            dateRangeText: `${currentWeekRange.weekStartStr.slice(5)} ~ ${currentWeekRange.weekEndStr.slice(5)}`,
            weeklyLossKg: remainingToLoseThisWeekKg,
            expectedWeightKg: isThisWeekGoalFailed ? currentWeightKg : thisWeekEndWeight,
            expectedFatPercent: this.round1((thisWeekEndFatMass / (isThisWeekGoalFailed ? currentWeightKg : thisWeekEndWeight)) * 100),
            isFailed: isThisWeekGoalFailed,
            excessWeightKg
        });

        simWeight = isThisWeekGoalFailed ? currentWeightKg : thisWeekEndWeight;
        simFatMass = thisWeekEndFatMass;

        while (simWeight > targetWeightKg + 0.05 && weekOffset <= 52) {
            const simFatPct = this.round1((simFatMass / simWeight) * 100);
            const stepCalc = this.computeWeeklySafeLossKg(
                simWeight,
                simFatPct,
                simFatMass,
                currentMuscleKg,
                minTargetMuscleKg,
                0
            );

            // 만회 코스 반영: 1WEEK면 다음 1주에 초과분 전액 반영, 1MONTH면 향후 4주간 분할 반영
            let additionalLoss = 0;
            if (isThisWeekGoalFailed && excessWeightKg > 0) {
                if (catchupMode === "1WEEK" && weekOffset === 1) {
                    additionalLoss = excessWeightKg;
                } else if (catchupMode === "1MONTH" && weekOffset <= 4) {
                    additionalLoss = excessPerWeekMonth;
                }
            }

            const stepLoss = Math.min(
                this.round2(stepCalc.weeklyTargetLossKg + additionalLoss),
                this.round2(simWeight - targetWeightKg)
            );
            simWeight = this.round2(simWeight - stepLoss);
            simFatMass = this.round2(Math.max(5, simFatMass - stepLoss * 0.9));
            const nextFatPct = this.round1((simFatMass / simWeight) * 100);

            const nextWeekNum = currentWeekNumber + weekOffset;
            const nextRange = this.getWeekDateRange(startDateStr, nextWeekNum);

            futureWeeklyRoadmap.push({
                weekNumber: nextWeekNum,
                isCurrentWeek: false,
                dateRangeText: `${nextRange.weekStartStr.slice(5)} ~ ${nextRange.weekEndStr.slice(5)}`,
                weeklyLossKg: stepLoss,
                expectedWeightKg: simWeight,
                expectedFatPercent: nextFatPct,
                additionalLoss
            });

            weekOffset++;
        }

        const totalRemainingWeightKg = this.round2(Math.max(0, currentWeightKg - targetWeightKg));
        const estimatedWeeksToFinalGoal = Math.max(1, futureWeeklyRoadmap.length);
        const lastWeekRange = this.getWeekDateRange(
            startDateStr,
            currentWeekNumber + Math.max(0, futureWeeklyRoadmap.length - 1)
        );
        const estimatedTargetDate = lastWeekRange.weekEndStr;

        const recommendedDailyDeficitKcal = Math.round((weeklyTargetLossKg * 7700) / 7);
        const targetFatPercent = Number(profile.targetBodyFatPercent);
        const targetFatMassKg = this.round2(targetWeightKg * (targetFatPercent / 100));

        const tdeeAnalysis = this.computeOccupationalTdee({
            gender: profile.gender || "MALE",
            age: profile.age || 32,
            heightCm: profile.heightCm || 184,
            weightKg: currentWeightKg,
            fatPercent: currentFatPercent,
            occupationCode: profile.occupationCode || "OFFICE_IT",
            workPostureCode: profile.workPostureCode || "MOSTLY_SITTING",
            dailyWorkHours: profile.dailyWorkHours != null ? profile.dailyWorkHours : 8,
            weeklyWorkDays: profile.weeklyWorkDays != null ? profile.weeklyWorkDays : 5,
            weeklyWorkoutSessions: profile.weeklyWorkoutTargetDays != null ? profile.weeklyWorkoutTargetDays : 4,
            recommendedDailyDeficitKcal
        });

        const weightBadge = totalRemainingWeightKg > 8.0
            ? MetricBadges.EXCESS_HIGH
            : (totalRemainingWeightKg > 1.5 ? MetricBadges.MODERATE_HIGH : MetricBadges.OPTIMAL);

        const muscleBadge = currentMuscleKg >= minTargetMuscleKg + 0.5
            ? MetricBadges.MUSCLE_PLENTY
            : (currentMuscleKg >= minTargetMuscleKg ? MetricBadges.OPTIMAL : MetricBadges.MUSCLE_RISK);

        const bodyFatBadge = currentFatPercent >= 25.0
            ? MetricBadges.TOO_HIGH
            : (currentFatPercent > targetFatPercent + 1.0 ? MetricBadges.MODERATE_HIGH : MetricBadges.OPTIMAL);

        const scienceCoachingTitle = `[${currentWeekNumber}주차] 이번 주 권장 감량 목표: -${weeklyTargetLossKg.toFixed(2)}kg (체중의 ${weeklySafeLossRatePercent.toFixed(2)}%)`;
        const scienceCoachingDetail =
            `현재 체지방률(${currentFatPercent.toFixed(1)}%)과 골격근량(${currentMuscleKg.toFixed(2)}kg) 분석 결과, ` +
            `최종 목표까지 남은 ${totalRemainingWeightKg.toFixed(2)}kg을 한 번에 빼려 하지 말고 ` +
            `매주 ${weeklyTargetLossKg.toFixed(2)}kg씩 감량하는 것이 골격근 ${minTargetMuscleKg.toFixed(1)}kg 이상 방어에 가장 이상적입니다. ` +
            `(일평균 소모 ${tdeeAnalysis.estimatedDailyTdeeKcal.toLocaleString()}kcal 기준, 일일 권장 적자 약 -${recommendedDailyDeficitKcal}kcal · 약 ${estimatedWeeksToFinalGoal}주 코스)`;

        return {
            startDateStr,
            currentWeekNumber,
            latestDate,
            currentWeightKg,
            currentMuscleKg,
            currentFatMassKg,
            currentFatPercent,
            currentBmi,
            currentFfmi,
            prevRecordDate: previous ? previous.recordDate : null,
            weightDeltaFromPrevKg,
            muscleDeltaFromPrevKg,
            fatMassDeltaFromPrevKg,
            fatPercentDeltaFromPrev,
            bmiDeltaFromPrev,
            weeklySafeLossRatePercent,
            weeklyTargetLossKg,
            thisWeekStartWeightKg,
            thisWeekTargetWeightKg,
            alreadyLostThisWeekKg,
            remainingToLoseThisWeekKg,
            weeklyProgressRatio,
            isThisWeekGoalSuccess,
            isThisWeekGoalFailed,
            excessWeightKg,
            catchupMode,
            catchupKcal1Week,
            catchupKcal1Month,
            excessPerWeekMonth,
            targetWeightKg,
            minTargetMuscleKg,
            targetFatPercent,
            targetFatMassKg,
            totalRemainingWeightKg,
            muscleSafetyBufferKg,
            estimatedWeeksToFinalGoal,
            estimatedTargetDate,
            recommendedDailyDeficitKcal,
            tdeeAnalysis,
            weightBadge,
            muscleBadge,
            bodyFatBadge,
            scienceCoachingTitle,
            scienceCoachingDetail,
            pastRecordsWithMeta,
            futureWeeklyRoadmap
        };
    }
}
