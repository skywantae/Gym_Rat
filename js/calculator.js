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

        const bmrPerHour = bmrKcal / 24;
        const effectiveWorkMets = Math.max(1.2, occupation.workMets * posture.factor);

        // 근무일 1일 기준 근무 시간 동안 기초대사량 초과로 소모되는 순수 직업 활동 칼로리
        const workDayExtraKcal = Math.round(bmrPerHour * (effectiveWorkMets - 1.0) * safeWorkHours);
        // 주간 근무일수(예: 주 5일)를 반영한 일평균 근무 활동 칼로리
        const avgDailyWorkNeatKcal = Math.round(workDayExtraKcal * (safeWorkDays / 7));

        // 비근무 일상 활동 칼로리(출퇴근, 보행, 일상 생활 NEAT)
        const nonWorkNeatKcal = Math.round(occupation.baseNonWorkNeatKcal * (safeWeight / 80));

        // 운동 소모 칼로리(웨이트 50분 + 천국의 계단 인터벌 10분 1회당 체중 비례 소모량 -> 주간 평균 일일 환산)
        const singleWorkoutKcal = Math.round(safeWeight * 4.4);
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
        const {
            weeklySafeLossRatePercent,
            weeklyTargetLossKg,
            muscleSafetyBufferKg
        } = this.computeWeeklySafeLossKg(
            currentWeightKg,
            currentFatPercent,
            currentFatMassKg,
            currentMuscleKg,
            minTargetMuscleKg,
            muscleDeltaFromPrevKg
        );

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

        const targetWeightKg = Number(profile.targetWeightKg);
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

        // 이전 기록 리스트 (주차, 1주차 시작일 여부, 직전 대비 변화량 포함)
        const pastRecordsWithMeta = sorted.map((rec, idx) => {
            const prevRec = idx > 0 ? sorted[idx - 1] : null;
            const w = Number(rec.weightKg);
            const m = Number(rec.skeletalMuscleMassKg);
            const fp = Number(rec.bodyFatPercentage);
            const fm = rec.bodyFatMassKg != null ? Number(rec.bodyFatMassKg) : this.round2(w * (fp / 100));
            const deltaW = prevRec ? this.round2(w - Number(prevRec.weightKg)) : 0;
            const weekNum = this.calculateWeekNumber(startDateStr, rec.recordDate);
            return {
                ...rec,
                weightKg: w,
                skeletalMuscleMassKg: m,
                bodyFatMassKg: fm,
                bodyFatPercentage: fp,
                deltaWeightKg: deltaW,
                weekNumber: weekNum,
                isStartRecord: idx === 0
            };
        }).reverse();

        // 이후 주차별 예상 몸무게 시뮬레이션 로드맵 생성 (1주차 시작일 기준 7일 단위)
        const futureWeeklyRoadmap = [];
        let simWeight = currentWeightKg;
        let simFatMass = currentFatMassKg;
        let weekOffset = 1;

        // 먼저 현재 진행 중인 주차(예: 1주차)의 종료 목표 행 추가
        const thisWeekEndWeight = this.round2(Math.max(targetWeightKg, currentWeightKg - remainingToLoseThisWeekKg));
        const thisWeekEndFatMass = this.round2(Math.max(5, simFatMass - remainingToLoseThisWeekKg * 0.9));
        futureWeeklyRoadmap.push({
            weekNumber: currentWeekNumber,
            isCurrentWeek: true,
            dateRangeText: `${currentWeekRange.weekStartStr.slice(5)} ~ ${currentWeekRange.weekEndStr.slice(5)}`,
            weeklyLossKg: remainingToLoseThisWeekKg,
            expectedWeightKg: thisWeekEndWeight,
            expectedFatPercent: this.round1((thisWeekEndFatMass / thisWeekEndWeight) * 100)
        });

        simWeight = thisWeekEndWeight;
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
            const stepLoss = Math.min(
                stepCalc.weeklyTargetLossKg,
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
                expectedFatPercent: nextFatPct
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
