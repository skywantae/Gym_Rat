/**
 * GymRat — 의학 및 스포츠 영양학(ACSM, ISSN, Helms et al. 2014, Alpert 2005) 기반
 * 주간 안전 감량 속도 및 골격근 방어 알고리즘 엔진
 */

export const MetricBadges = {
    EXCESS_HIGH: { label: "많이초과", dotClass: "dot-danger", textClass: "text-danger" },
    TOO_HIGH: { label: "너무 높음", dotClass: "dot-danger", textClass: "text-danger" },
    MODERATE_HIGH: { label: "다소높음", dotClass: "dot-warning", textClass: "text-warning" },
    MUSCLE_PLENTY: { label: "많음 (방어중)", dotClass: "dot-blue", textClass: "text-blue" },
    MUSCLE_RISK: { label: "근손실주의", dotClass: "dot-danger", textClass: "text-danger" },
    OPTIMAL: { label: "적정/목표도달", dotClass: "dot-lime", textClass: "text-lime" }
};

export class SafeWeightLossCalculator {
    static round1(val) {
        return Math.round(val * 10) / 10;
    }

    static round2(val) {
        return Math.round(val * 100) / 100;
    }

    /**
     * 이번 주 월요일 날짜(YYYY-MM-DD)를 반환합니다.
     */
    static getMondayDateString(dateStr) {
        const d = dateStr ? new Date(dateStr + "T00:00:00") : new Date();
        const day = d.getDay(); // 0(일) ~ 6(토)
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(d.setDate(diff));
        return monday.toISOString().slice(0, 10);
    }

    /**
     * 사용자의 프로필 및 체성분 기록 배열을 분석하여
     * 1) 직전 기록 대비 변화량 (몸무게, 골격근량, 체지방량, 체지방률, BMI)
     * 2) 체지방률 & 골격근량 기반 1주일 안전 감량 목표(kg) 및 이번 주 남은 감량치
     * 3) 최종 목표(90.0kg / 골격근 41kg 방어 / 체지방 19~20%) 예상 소요 주수 및 코칭 리포트를 반환합니다.
     */
    static calculate(profile, records) {
        const sorted = [...records].sort((a, b) => a.recordDate.localeCompare(b.recordDate));
        const latest = sorted.length > 0 ? sorted[sorted.length - 1] : null;
        const previous = sorted.length >= 2 ? sorted[sorted.length - 2] : null;

        const currentWeightKg = latest ? Number(latest.weightKg) : Number(profile.currentWeightKg);
        const currentMuscleKg = latest ? Number(latest.skeletalMuscleMassKg) : Number(profile.startSkeletalMuscleKg);
        const currentFatPercent = latest ? Number(latest.bodyFatPercentage) : Number(profile.startBodyFatPercent);
        const currentFatMassKg = latest && latest.bodyFatMassKg != null
            ? Number(latest.bodyFatMassKg)
            : this.round2(currentWeightKg * (currentFatPercent / 100));
        const latestDate = latest ? latest.recordDate : new Date().toISOString().slice(0, 10);

        const heightM = Math.max(1.2, Number(profile.heightCm) / 100);
        const currentBmi = this.round1(currentWeightKg / (heightM * heightM));
        const fatFreeMassKg = Math.max(40, currentWeightKg - currentFatMassKg);
        const currentFfmi = this.round1(fatFreeMassKg / (heightM * heightM));

        // 직전 측정 대비 증감 (앳플리 '지난 번 대비' 섹션용)
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

        // -------------------------------------------------------------------------
        // [의학 & 스포츠 영양학 안전 감량 속도 알고리즘]
        // 1) 체지방률(BF%) 구간별 기초 주간 감량 비율 (ISSN & Helms et al., 2014)
        //    체지방률이 높을수록 지방 세포에서 동원 가능한 에너지가 커서 주당 체중의 0.75~0.76% 감량이 안전하며,
        //    체지방률이 20% 이하로 낮아질수록 근손실 방어를 위해 0.54% 이하로 감속합니다.
        // -------------------------------------------------------------------------
        let baseWeeklyRatePercent = 0.65;
        if (currentFatPercent >= 27.0) {
            baseWeeklyRatePercent = 0.76;
        } else if (currentFatPercent >= 24.0) {
            baseWeeklyRatePercent = 0.70;
        } else if (currentFatPercent >= 21.0) {
            baseWeeklyRatePercent = 0.62;
        } else if (currentFatPercent >= 19.0) {
            baseWeeklyRatePercent = 0.54;
        } else {
            baseWeeklyRatePercent = 0.45;
        }

        // 2) 골격근량 방어 보정 계수 (Muscle Preservation Factor)
        //    목표 최소 골격근량(예: 41.0kg) 대비 현재 여유분(buffer)과 최근 골격근 변화 추이를 반영합니다.
        const minTargetMuscleKg = Number(profile.minTargetSkeletalMuscleKg);
        const muscleSafetyBufferKg = this.round2(currentMuscleKg - minTargetMuscleKg);

        let muscleDefenseFactor = 1.0;
        if (muscleSafetyBufferKg < 0.3 || muscleDeltaFromPrevKg <= -0.4) {
            muscleDefenseFactor = 0.68; // 근손실 경계: 감량 속도 즉시 완화
        } else if (muscleSafetyBufferKg < 1.0 || muscleDeltaFromPrevKg <= -0.2) {
            muscleDefenseFactor = 0.85; // 주의 구간: 보수적 감량
        } else {
            muscleDefenseFactor = 1.0;  // 골격근 방어 우수: 최적 속도 유지
        }

        const weeklySafeLossRatePercent = this.round2(baseWeeklyRatePercent * muscleDefenseFactor);
        const rawWeeklyLossKg = currentWeightKg * (weeklySafeLossRatePercent / 100);

        // 3) Alpert (2005) 체지방 조직 최대 에너지 동원 상한 검증 (69 kcal / kg fat / day)
        //    생리학적 한계의 80% 이내로 클램핑하여 근단백질 이화작용(Catabolism) 원천 차단
        const maxSafeFatLossPerWeekKg = ((currentFatMassKg * 69 * 7) / 7700) * 0.80;
        const clampedWeeklyLoss = Math.min(rawWeeklyLossKg, maxSafeFatLossPerWeekKg);
        const weeklyTargetLossKg = this.round2(Math.max(0.35, Math.min(1.10, clampedWeeklyLoss)));

        // 4) 이번 주(월요일~현재) 시작 체중 및 이번 주 남은 감량 목표 계산
        const todayStr = new Date().toISOString().slice(0, 10);
        const mondayStr = this.getMondayDateString(todayStr);
        const recordsBeforeThisWeek = sorted.filter(r => r.recordDate < mondayStr);
        const recordsInThisWeek = sorted.filter(r => r.recordDate >= mondayStr);

        let thisWeekStartWeightKg = currentWeightKg;
        if (recordsInThisWeek.length >= 2) {
            thisWeekStartWeightKg = Number(recordsInThisWeek[0].weightKg);
        } else if (recordsBeforeThisWeek.length > 0) {
            thisWeekStartWeightKg = Number(recordsBeforeThisWeek[recordsBeforeThisWeek.length - 1].weightKg);
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

        // 5) 최종 목표(90.0kg)까지 총 잔여 체중 및 예상 소요 주수
        const totalRemainingWeightKg = this.round2(Math.max(0, currentWeightKg - targetWeightKg));
        const estimatedWeeksToFinalGoal = totalRemainingWeightKg <= 0
            ? 0
            : Math.ceil(totalRemainingWeightKg / weeklyTargetLossKg);

        const targetDateObj = new Date();
        targetDateObj.setDate(targetDateObj.getDate() + estimatedWeeksToFinalGoal * 7);
        const estimatedTargetDate = targetDateObj.toISOString().slice(0, 10);

        const recommendedDailyDeficitKcal = Math.round((weeklyTargetLossKg * 7700) / 7);
        const targetFatPercent = Number(profile.targetBodyFatPercent);
        const targetFatMassKg = this.round2(targetWeightKg * (targetFatPercent / 100));

        // 6) 앳플리 스타일 건강/방어 상태 배지
        const weightBadge = totalRemainingWeightKg > 8.0
            ? MetricBadges.EXCESS_HIGH
            : (totalRemainingWeightKg > 1.5 ? MetricBadges.MODERATE_HIGH : MetricBadges.OPTIMAL);

        const muscleBadge = currentMuscleKg >= minTargetMuscleKg + 0.5
            ? MetricBadges.MUSCLE_PLENTY
            : (currentMuscleKg >= minTargetMuscleKg ? MetricBadges.OPTIMAL : MetricBadges.MUSCLE_RISK);

        const bodyFatBadge = currentFatPercent >= 25.0
            ? MetricBadges.TOO_HIGH
            : (currentFatPercent > targetFatPercent + 1.0 ? MetricBadges.MODERATE_HIGH : MetricBadges.OPTIMAL);

        const scienceCoachingTitle = `이번 주 권장 감량 목표: -${weeklyTargetLossKg.toFixed(2)}kg (체중의 ${weeklySafeLossRatePercent.toFixed(2)}%)`;
        const scienceCoachingDetail =
            `현재 체지방률(${currentFatPercent.toFixed(1)}%)과 골격근량(${currentMuscleKg.toFixed(2)}kg) 분석 결과, ` +
            `최종 목표까지 남은 ${totalRemainingWeightKg.toFixed(2)}kg을 한 번에 빼려 하지 말고 ` +
            `매주 ${weeklyTargetLossKg.toFixed(2)}kg씩 감량하는 것이 골격근 ${minTargetMuscleKg.toFixed(1)}kg 이상 방어에 가장 이상적입니다. ` +
            `(일일 권장 에너지 적자 약 -${recommendedDailyDeficitKcal}kcal · 약 ${estimatedWeeksToFinalGoal}주 완주 코스)`;

        return {
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
            scienceCoachingDetail
        };
    }
}
