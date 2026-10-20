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
     * 시작일과 기준일 사이의 주차(1주차부터 시작)를 계산합니다.
     */
    static calculateWeekNumber(startDateStr, targetDateStr) {
        const startMonday = parseLocalDate(this.getMondayDateString(startDateStr));
        const targetMonday = parseLocalDate(this.getMondayDateString(targetDateStr));
        const diffMs = targetMonday.getTime() - startMonday.getTime();
        const diffWeeks = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
        return Math.max(1, diffWeeks + 1);
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

        // 이번 주(월요일~일요일) 시작 체중 및 이번 주 남은 감량치 계산
        const mondayStr = this.getMondayDateString(latestDate);
        const recordsBeforeThisWeek = sorted.filter(r => r.recordDate < mondayStr);
        const recordsInThisWeek = sorted.filter(r => r.recordDate >= mondayStr);

        let thisWeekStartWeightKg = currentWeightKg;
        if (recordsBeforeThisWeek.length > 0) {
            thisWeekStartWeightKg = Number(recordsBeforeThisWeek[recordsBeforeThisWeek.length - 1].weightKg);
        } else if (recordsInThisWeek.length >= 2) {
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

        // 이전 기록 리스트 (주차 및 직전 대비 변화량 포함)
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
                weekNumber: weekNum
            };
        }).reverse();

        // 이후 주차별 예상 몸무게 시뮬레이션 로드맵 생성
        const futureWeeklyRoadmap = [];
        let simWeight = currentWeightKg;
        let simFatMass = currentFatMassKg;
        const baseMondayDate = parseLocalDate(mondayStr);
        let weekOffset = 1;

        // 먼저 이번 주(현재 주차) 목표 행 추가
        const thisWeekSunday = new Date(baseMondayDate);
        thisWeekSunday.setDate(thisWeekSunday.getDate() + 6);
        futureWeeklyRoadmap.push({
            weekNumber: currentWeekNumber,
            isCurrentWeek: true,
            dateRangeText: `${mondayStr.slice(5)} ~ ${getLocalDateString(thisWeekSunday).slice(5)}`,
            weeklyLossKg: remainingToLoseThisWeekKg,
            expectedWeightKg: this.round2(Math.max(targetWeightKg, currentWeightKg - remainingToLoseThisWeekKg)),
            expectedFatPercent: this.round1(
                ((Math.max(5, simFatMass - remainingToLoseThisWeekKg)) /
                    Math.max(targetWeightKg, currentWeightKg - remainingToLoseThisWeekKg)) * 100
            )
        });

        simWeight = this.round2(Math.max(targetWeightKg, currentWeightKg - remainingToLoseThisWeekKg));
        simFatMass = this.round2(Math.max(5, simFatMass - remainingToLoseThisWeekKg * 0.9));

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

            const wkMon = new Date(baseMondayDate);
            wkMon.setDate(wkMon.getDate() + weekOffset * 7);
            const wkSun = new Date(wkMon);
            wkSun.setDate(wkSun.getDate() + 6);

            futureWeeklyRoadmap.push({
                weekNumber: currentWeekNumber + weekOffset,
                isCurrentWeek: false,
                dateRangeText: `${getLocalDateString(wkMon).slice(5)} ~ ${getLocalDateString(wkSun).slice(5)}`,
                weeklyLossKg: stepLoss,
                expectedWeightKg: simWeight,
                expectedFatPercent: nextFatPct
            });

            weekOffset++;
        }

        const totalRemainingWeightKg = this.round2(Math.max(0, currentWeightKg - targetWeightKg));
        const estimatedWeeksToFinalGoal = Math.max(0, futureWeeklyRoadmap.length - 1);
        const targetDateObj = new Date(baseMondayDate);
        targetDateObj.setDate(targetDateObj.getDate() + estimatedWeeksToFinalGoal * 7 + 6);
        const estimatedTargetDate = getLocalDateString(targetDateObj);

        const recommendedDailyDeficitKcal = Math.round((weeklyTargetLossKg * 7700) / 7);
        const targetFatPercent = Number(profile.targetBodyFatPercent);
        const targetFatMassKg = this.round2(targetWeightKg * (targetFatPercent / 100));

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
            `(일일 권장 에너지 적자 약 -${recommendedDailyDeficitKcal}kcal, 약 ${estimatedWeeksToFinalGoal}주 완주 코스)`;

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
