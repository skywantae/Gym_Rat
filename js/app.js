/**
 * GymRat — 메인 웹 애플리케이션 컨트롤러
 * - 앳플리(Atflee) 스타일 몸무게 & 스포츠 영양학 주간 목표 카드 렌더링
 * - 매일 체중·골격근량·체지방량(kg) & 체지방률(%) 상호 자동 계산 입력 모달
 * - 맞춤형 목표 설정 (90.0kg / 골격근 41kg 방어 / 체지방률 19~20%) 모달
 * - 아침/점심 고정 루틴 원클릭 등록 & 저녁 초저탄수 고단백 가이드
 * - 크레아틴 5g / 프로바이오틱스 / 수분 2.5~3.0L / 주 4회 웨이트 & 천국의 계단 로깅
 * - 반응형 체중·골격근량 오버레이 차트
 */

import { SafeWeightLossCalculator } from "./calculator.js";
import { GymRatStorage, FixedRoutineTemplates, MachinePresets } from "./storage.js";
import { GymRatCharts } from "./chart.js";

class GymRatApp {
    constructor() {
        this.todayStr = new Date().toISOString().slice(0, 10);
        this.activeBottomNav = "dashboard"; // "dashboard" | "graph"
        this.atfleeSubTab = "summary";      // "summary" | "science"
        this.chartPeriodDays = 30;          // 7 | 30 | 90 | 180 | null
        this.chartMetricTab = "OVERLAY";    // "OVERLAY" | "WEIGHT_ONLY" | "MUSCLE_ONLY" | "BODY_FAT_ONLY"
        this.selectedChartPointIndex = null;
        this.selectedMachinePreset = MachinePresets[0];
    }

    init() {
        GymRatStorage.ensureSeeded();
        this.bindStaticEvents();
        this.renderAll();
        window.addEventListener("resize", () => {
            if (this.activeBottomNav === "graph") {
                this.renderGraphScreen();
            }
        });
    }

    showToast(message) {
        const toast = document.getElementById("toast-banner");
        if (!toast) return;
        toast.textContent = message;
        toast.classList.add("visible");
        clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(() => {
            toast.classList.remove("visible");
        }, 3200);
    }

    bindStaticEvents() {
        // 하단 네비게이션 전환
        document.getElementById("nav-btn-dashboard").addEventListener("click", () => {
            this.switchMainView("dashboard");
        });
        document.getElementById("nav-btn-graph").addEventListener("click", () => {
            this.switchMainView("graph");
        });

        // 앳플리 카드 내 [요약 | 보고서] 탭 전환
        document.getElementById("tab-btn-atflee-summary").addEventListener("click", () => {
            this.atfleeSubTab = "summary";
            this.renderDashboardScreen();
        });
        document.getElementById("tab-btn-atflee-science").addEventListener("click", () => {
            this.atfleeSubTab = "science";
            this.renderDashboardScreen();
        });

        // 체성분 입력 모달 열기 버튼들
        document.querySelectorAll(".js-open-body-modal").forEach(btn => {
            btn.addEventListener("click", () => this.openBodyRecordModal());
        });

        // 목표 설정 모달 열기 버튼들
        document.querySelectorAll(".js-open-goal-modal").forEach(btn => {
            btn.addEventListener("click", () => this.openGoalSettingModal());
        });

        // 웨이트 세트 모달 열기
        document.getElementById("btn-open-workout-modal").addEventListener("click", () => {
            this.openWorkoutModal();
        });

        // 모달 닫기 버튼들
        document.querySelectorAll(".js-close-modal").forEach(btn => {
            btn.addEventListener("click", () => this.closeAllModals());
        });

        // 체성분 모달: 체중 / 체지방량(kg) / 체지방률(%) 실시간 자동 상호 계산
        const weightInput = document.getElementById("input-body-weight");
        const fatMassInput = document.getElementById("input-body-fat-mass");
        const fatPctInput = document.getElementById("input-body-fat-pct");

        weightInput.addEventListener("input", () => {
            const w = parseFloat(weightInput.value);
            const fm = parseFloat(fatMassInput.value);
            if (w > 0 && !isNaN(fm)) {
                fatPctInput.value = ((fm / w) * 100).toFixed(1);
            }
        });

        fatMassInput.addEventListener("input", () => {
            const fm = parseFloat(fatMassInput.value);
            const w = parseFloat(weightInput.value);
            if (w > 0 && !isNaN(fm)) {
                fatPctInput.value = ((fm / w) * 100).toFixed(1);
            }
        });

        fatPctInput.addEventListener("input", () => {
            const pct = parseFloat(fatPctInput.value);
            const w = parseFloat(weightInput.value);
            if (w > 0 && !isNaN(pct)) {
                fatMassInput.value = (w * (pct / 100)).toFixed(2);
            }
        });

        // 체성분 저장 폼 제출
        document.getElementById("form-body-record").addEventListener("submit", e => {
            e.preventDefault();
            this.handleSaveBodyRecord();
        });

        // 목표 설정 저장 폼 제출
        document.getElementById("form-goal-setting").addEventListener("submit", e => {
            e.preventDefault();
            this.handleSaveGoals();
        });

        // 웨이트 세트 저장 폼 제출
        document.getElementById("form-workout-set").addEventListener("submit", e => {
            e.preventDefault();
            this.handleSaveWorkoutSet();
        });

        // 정체기 목표 칼로리 +/- 50 kcal 조절
        document.getElementById("btn-kcal-minus").addEventListener("click", () => {
            this.adjustTargetCalories(-50);
        });
        document.getElementById("btn-kcal-plus").addEventListener("click", () => {
            this.adjustTargetCalories(50);
        });

        // 고정 식단 루틴 원클릭 토글
        document.getElementById("btn-toggle-breakfast").addEventListener("click", () => {
            const added = GymRatStorage.toggleTemplateDiet(this.todayStr, FixedRoutineTemplates.BREAKFAST_FIXED);
            this.renderDashboardScreen();
            this.showToast(added ? "아침 고정 루틴 등록 완료 (+480 kcal / 단백질 +40g)" : "아침 고정 루틴이 해제되었습니다.");
        });

        document.getElementById("btn-toggle-lunch").addEventListener("click", () => {
            const added = GymRatStorage.toggleTemplateDiet(this.todayStr, FixedRoutineTemplates.LUNCH_FIXED);
            this.renderDashboardScreen();
            this.showToast(
                added
                    ? "점심 고정 루틴(구내식당+라떼) 등록 완료! 저녁 초저탄수 가이드를 확인하세요."
                    : "점심 고정 루틴이 해제되었습니다."
            );
        });

        document.getElementById("btn-toggle-booster").addEventListener("click", () => {
            const added = GymRatStorage.toggleTemplateDiet(this.todayStr, FixedRoutineTemplates.EXTRA_PROTEIN_BOOSTER);
            this.renderDashboardScreen();
            this.showToast(added ? "단백질 160g 방어 부스터 추가 완료 (+38g 단백질)" : "단백질 부스터가 해제되었습니다.");
        });

        // 영양제 & 수분 & 운동 완료 체크박스
        document.getElementById("switch-creatine").addEventListener("change", e => {
            const checklist = GymRatStorage.getChecklist(this.todayStr);
            checklist.creatine5gTaken = e.target.checked;
            GymRatStorage.saveChecklist(this.todayStr, checklist);
            if (e.target.checked) {
                this.showToast("크레아틴 5g 복용 완료! 근세포 수분 보유 및 스트렝스 방어에 도움됩니다.");
            }
        });

        document.getElementById("switch-probiotics").addEventListener("change", e => {
            const checklist = GymRatStorage.getChecklist(this.todayStr);
            checklist.probioticsTaken = e.target.checked;
            GymRatStorage.saveChecklist(this.todayStr, checklist);
        });

        document.getElementById("btn-water-250").addEventListener("click", () => this.addWater(250));
        document.getElementById("btn-water-500").addEventListener("click", () => this.addWater(500));
        document.getElementById("btn-water-reset").addEventListener("click", () => this.addWater(-99999));

        document.getElementById("check-weight-50m").addEventListener("change", e => {
            const checklist = GymRatStorage.getChecklist(this.todayStr);
            checklist.weightSession50mDone = e.target.checked;
            GymRatStorage.saveChecklist(this.todayStr, checklist);
            this.renderDashboardScreen();
        });

        document.getElementById("check-stairmaster").addEventListener("change", e => {
            const checklist = GymRatStorage.getChecklist(this.todayStr);
            checklist.stairMasterIntervalDone = e.target.checked;
            GymRatStorage.saveChecklist(this.todayStr, checklist);
            this.renderDashboardScreen();
            if (e.target.checked) {
                this.showToast("천국의 계단 10분 고강도 인터벌 유산소 완료!");
            }
        });

        // 차트 탭 & 기간 필터 이벤트
        document.querySelectorAll("[data-chart-tab]").forEach(btn => {
            btn.addEventListener("click", () => {
                this.chartMetricTab = btn.getAttribute("data-chart-tab");
                this.renderGraphScreen();
            });
        });

        document.querySelectorAll("[data-chart-period]").forEach(btn => {
            btn.addEventListener("click", () => {
                const val = btn.getAttribute("data-chart-period");
                this.chartPeriodDays = val === "ALL" ? null : parseInt(val, 10);
                this.selectedChartPointIndex = null;
                this.renderGraphScreen();
            });
        });
    }

    switchMainView(viewName) {
        this.activeBottomNav = viewName;
        const dashSection = document.getElementById("screen-dashboard");
        const graphSection = document.getElementById("screen-graph");
        const navDash = document.getElementById("nav-btn-dashboard");
        const navGraph = document.getElementById("nav-btn-graph");

        if (viewName === "dashboard") {
            dashSection.classList.remove("hidden");
            graphSection.classList.add("hidden");
            navDash.classList.add("active");
            navGraph.classList.remove("active");
            this.renderDashboardScreen();
        } else {
            dashSection.classList.add("hidden");
            graphSection.classList.remove("hidden");
            navDash.classList.remove("active");
            navGraph.classList.add("active");
            this.renderGraphScreen();
        }
    }

    renderAll() {
        this.renderDashboardScreen();
        if (this.activeBottomNav === "graph") {
            this.renderGraphScreen();
        }
    }

    renderDashboardScreen() {
        const profile = GymRatStorage.getProfile();
        const weightRecords = GymRatStorage.getWeightRecords();
        const plan = SafeWeightLossCalculator.calculate(profile, weightRecords);
        const diets = GymRatStorage.getDietRecordsByDate(this.todayStr);
        const checklist = GymRatStorage.getChecklist(this.todayStr);
        const workouts = GymRatStorage.getWorkoutRecordsByDate(this.todayStr);
        const weeklyWorkoutDays = GymRatStorage.getWeeklyWorkoutDaysCount(this.todayStr);

        // 1. 앳플리 스타일 상단 몸무게 & 이번 주 감량 목표 박스 업데이트
        document.getElementById("latest-record-date").textContent = `최근 기록일: ${plan.latestDate}`;
        document.getElementById("atflee-current-weight").textContent = plan.currentWeightKg.toFixed(2);
        document.getElementById("atflee-weekly-remaining").textContent = `- ${plan.remainingToLoseThisWeekKg.toFixed(2)}`;
        document.getElementById("atflee-weekly-sub1").textContent =
            `주간 권장 -${plan.weeklyTargetLossKg.toFixed(2)}kg (이번 주 목표 ${plan.thisWeekTargetWeightKg.toFixed(1)}kg)`;
        document.getElementById("atflee-weekly-sub2").textContent =
            `최종 ${plan.targetWeightKg.toFixed(1)}kg까지 -${plan.totalRemainingWeightKg.toFixed(2)}kg (${plan.estimatedWeeksToFinalGoal}주 코스)`;

        // 2. 지난 번 대비 3열
        const formatSigned = val => (val > 0 ? `+${val.toFixed(2)}` : val.toFixed(2));
        document.getElementById("delta-weight").textContent = formatSigned(plan.weightDeltaFromPrevKg);
        document.getElementById("delta-muscle").textContent = formatSigned(plan.muscleDeltaFromPrevKg);
        document.getElementById("delta-fat-mass").textContent = formatSigned(plan.fatMassDeltaFromPrevKg);

        // 3. 요약 / 보고서 탭 전환
        const tabSummaryBtn = document.getElementById("tab-btn-atflee-summary");
        const tabScienceBtn = document.getElementById("tab-btn-atflee-science");
        const panelSummary = document.getElementById("panel-atflee-summary");
        const panelScience = document.getElementById("panel-atflee-science");

        if (this.atfleeSubTab === "summary") {
            tabSummaryBtn.classList.add("active");
            tabScienceBtn.classList.remove("active");
            panelSummary.classList.remove("hidden");
            panelScience.classList.add("hidden");
        } else {
            tabSummaryBtn.classList.remove("active");
            tabScienceBtn.classList.add("active");
            panelSummary.classList.add("hidden");
            panelScience.classList.remove("hidden");
        }

        // 요약 리스트 렌더링
        const summaryRowsContainer = document.getElementById("atflee-summary-rows");
        const summaryItems = [
            {
                title: "몸무게",
                value: `${plan.currentWeightKg.toFixed(2)} kg`,
                target: `목표 ${plan.targetWeightKg.toFixed(1)}kg`,
                badge: plan.weightBadge
            },
            {
                title: "골격근량",
                value: `${plan.currentMuscleKg.toFixed(2)} kg`,
                target: `방어 ≥${plan.minTargetMuscleKg.toFixed(1)}kg`,
                badge: plan.muscleBadge
            },
            {
                title: "체지방량",
                value: `${plan.currentFatMassKg.toFixed(2)} kg`,
                target: `목표 ${plan.targetFatMassKg.toFixed(1)}kg`,
                badge: plan.bodyFatBadge
            },
            {
                title: "체지방률",
                value: `${plan.currentFatPercent.toFixed(1)} %`,
                target: `타깃 ${plan.targetFatPercent.toFixed(1)}% (19~20%)`,
                badge: plan.bodyFatBadge
            }
        ];

        summaryRowsContainer.innerHTML = summaryItems
            .map(
                item => `
            <div class="atflee-metric-row">
                <div class="metric-col-name">${item.title}</div>
                <div class="metric-col-val">
                    <strong>${item.value}</strong>
                    <span>${item.target}</span>
                </div>
                <div class="metric-col-badge">
                    <span>${item.badge.label}</span>
                    <i class="status-dot ${item.badge.dotClass}"></i>
                </div>
            </div>
        `
            )
            .join("");

        // 보고서(주간 감량 과학) 패널 업데이트
        document.getElementById("science-coaching-title").textContent = plan.scienceCoachingTitle;
        document.getElementById("science-coaching-detail").textContent = plan.scienceCoachingDetail;
        const weeklyPct = Math.round(plan.weeklyProgressRatio * 100);
        document.getElementById("science-weekly-progress-label").textContent =
            `이번 주 감량 달성률 (${plan.alreadyLostThisWeekKg.toFixed(2)} / ${plan.weeklyTargetLossKg.toFixed(2)}kg)`;
        document.getElementById("science-weekly-progress-pct").textContent = `${weeklyPct}%`;
        document.getElementById("science-weekly-progress-bar").style.width = `${weeklyPct}%`;
        document.getElementById("science-meta-bullets").innerHTML = `
            <li>골격근 방어 여유분: <strong>+${plan.muscleSafetyBufferKg.toFixed(2)}kg</strong> (마지노선 ${plan.minTargetMuscleKg.toFixed(1)}kg)</li>
            <li>권장 일일 에너지 적자: <strong>-${plan.recommendedDailyDeficitKcal} kcal/일</strong> (식단 + 운동 합산)</li>
            <li>예상 최종 목표(${plan.targetWeightKg.toFixed(1)}kg) 도달일: <strong>${plan.estimatedTargetDate}</strong> (약 ${plan.estimatedWeeksToFinalGoal}주 후)</li>
        `;

        // 4. 일일 영양 합계 대시보드 계산 및 렌더링
        const consumedCalories = diets.reduce((acc, d) => acc + Number(d.caloriesKcal), 0);
        const consumedProteinG = diets.reduce((acc, d) => acc + Number(d.proteinG), 0);
        const consumedCarbsG = diets.reduce((acc, d) => acc + Number(d.carbsG), 0);
        const consumedFatG = diets.reduce((acc, d) => acc + Number(d.fatG), 0);

        const targetCalories = Number(profile.dailyTargetCalories);
        const targetProteinG = Number(profile.dailyTargetProteinG);
        const targetCarbsG = Number(profile.dailyTargetCarbsG);
        const targetFatG = Number(profile.dailyTargetFatG);

        const remainingCalories = targetCalories - consumedCalories;
        const calorieProgressPct = Math.min(100, Math.round((consumedCalories / Math.max(1, targetCalories)) * 100));

        document.getElementById("kcal-header-target").textContent = `일일 에너지 밸런스 (목표 ${targetCalories.toLocaleString()} kcal)`;
        document.getElementById("kcal-consumed-val").textContent = consumedCalories.toLocaleString();
        document.getElementById("kcal-target-val").textContent = `/ ${targetCalories.toLocaleString()} kcal`;

        const kcalBar = document.getElementById("kcal-progress-bar");
        kcalBar.style.width = `${calorieProgressPct}%`;
        kcalBar.className = "progress-fill " + (remainingCalories < 0 ? "bg-danger" : calorieProgressPct > 90 ? "bg-warning" : "bg-blue");

        const kcalRemainText = document.getElementById("kcal-remaining-text");
        if (remainingCalories < 0) {
            kcalRemainText.textContent = `목표 대비 +${Math.abs(remainingCalories).toLocaleString()} kcal 초과`;
            kcalRemainText.className = "text-danger font-bold";
        } else {
            kcalRemainText.textContent = `남은 섭취 가능 칼로리: ${remainingCalories.toLocaleString()} kcal`;
            kcalRemainText.className = "text-blue font-bold";
        }
        document.getElementById("kcal-progress-pct").textContent = `${calorieProgressPct}%`;

        // 단백질 160g 방어 배너
        const proteinBanner = document.getElementById("protein-defense-banner");
        const proteinTitle = document.getElementById("protein-defense-title");
        const proteinSub = document.getElementById("protein-defense-sub");
        const remainingProtein = Math.max(0, targetProteinG - consumedProteinG);

        if (consumedProteinG >= targetProteinG) {
            proteinBanner.className = "protein-banner achieved";
            proteinTitle.textContent = `일일 단백질 ${targetProteinG}g 필수 방어 목표 달성! ✓`;
        } else {
            proteinBanner.className = "protein-banner pending";
            proteinTitle.textContent = `골격근 ${profile.minTargetSkeletalMuscleKg}kg 방어를 위해 단백질 ${remainingProtein}g 추가 필요`;
        }
        proteinSub.textContent = `현재 단백질 ${consumedProteinG}g / 목표 ${targetProteinG}g 이상`;

        // 탄/단/지 도넛 차트 & 게이지 바
        document.getElementById("donut-protein-val").textContent = `${consumedProteinG}g`;
        document.getElementById("donut-protein-target").textContent = `/ ${targetProteinG}g`;
        GymRatCharts.renderMacroDonut(document.getElementById("canvas-macro-donut"), {
            consumedProteinG,
            consumedCarbsG,
            consumedFatG
        });

        this.updateMacroBar("protein", consumedProteinG, targetProteinG, consumedProteinG >= targetProteinG ? "달성!" : `잔여 ${remainingProtein}g`);
        this.updateMacroBar("carbs", consumedCarbsG, targetCarbsG, `${Math.round((consumedCarbsG / Math.max(1, targetCarbsG)) * 100)}%`);
        this.updateMacroBar("fat", consumedFatG, targetFatG, `${Math.round((consumedFatG / Math.max(1, targetFatG)) * 100)}%`);

        // 5. 고정 루틴 등록 상태 업데이트
        const registeredCodes = new Set(diets.map(d => d.templateCode));
        this.updateRoutineCardState("breakfast", registeredCodes.has(FixedRoutineTemplates.BREAKFAST_FIXED.templateCode));
        this.updateRoutineCardState("lunch", registeredCodes.has(FixedRoutineTemplates.LUNCH_FIXED.templateCode));
        this.updateRoutineCardState("booster", registeredCodes.has(FixedRoutineTemplates.EXTRA_PROTEIN_BOOSTER.templateCode));

        // 6. 저녁 초저탄수 + 고단백 권장 가이드 목록 렌더링
        const lunchRegistered = registeredCodes.has(FixedRoutineTemplates.LUNCH_FIXED.templateCode);
        const dinnerSub = document.getElementById("dinner-guide-subtitle");
        if (lunchRegistered) {
            dinnerSub.textContent = "점심(구내식당+라떼 1,200kcal) 탄수화물·당류 상쇄 모드가 활성화되었습니다.";
            dinnerSub.className = "section-sub text-warning";
        } else {
            dinnerSub.textContent = "권장 타깃: 550~600 kcal / 단백질 50~55g / 탄수화물 10g 이하 제한";
            dinnerSub.className = "section-sub";
        }

        const dinnerContainer = document.getElementById("dinner-guide-list");
        dinnerContainer.innerHTML = FixedRoutineTemplates.DINNER_RECOMMENDATIONS.map(opt => {
            const selected = registeredCodes.has(opt.templateCode);
            return `
                <div class="routine-item dinner-option ${selected ? "selected-lime" : ""}" data-dinner-code="${opt.templateCode}">
                    <div class="routine-info">
                        <h4>${opt.title}</h4>
                        <p>${opt.subtitle}</p>
                        <span class="routine-badge text-lime">${opt.badgeText}</span>
                    </div>
                    <button type="button" class="btn-routine-action ${selected ? "active-lime" : ""}">
                        ${selected ? "선택됨 ✓" : "가이드 적용"}
                    </button>
                </div>
            `;
        }).join("");

        dinnerContainer.querySelectorAll("[data-dinner-code]").forEach(el => {
            el.addEventListener("click", () => {
                const code = el.getAttribute("data-dinner-code");
                const template = FixedRoutineTemplates.DINNER_RECOMMENDATIONS.find(d => d.templateCode === code);
                if (template) {
                    const selected = GymRatStorage.selectDinnerRecommendation(this.todayStr, template);
                    this.renderDashboardScreen();
                    this.showToast(
                        selected
                            ? `저녁 가이드 적용: ${template.title} (+${template.caloriesKcal}kcal / 단백질 +${template.proteinG}g)`
                            : "저녁 권장 식단 선택이 해제되었습니다."
                    );
                }
            });
        });

        // 7. 영양제 & 수분 섭취 체크리스트 업데이트
        document.getElementById("switch-creatine").checked = Boolean(checklist.creatine5gTaken);
        document.getElementById("switch-probiotics").checked = Boolean(checklist.probioticsTaken);

        const waterLiters = (checklist.waterIntakeMl / 1000).toFixed(2);
        const targetWaterLiters = (profile.dailyTargetWaterMl / 1000).toFixed(1);
        const waterPct = Math.min(100, Math.round((checklist.waterIntakeMl / Math.max(1, profile.dailyTargetWaterMl)) * 100));
        document.getElementById("water-status-text").textContent = `${waterLiters}L / ${targetWaterLiters}L`;
        document.getElementById("water-progress-bar").style.width = `${waterPct}%`;

        // 8. 주 4회 운동 & 웨이트 세트 목록 렌더링
        document.getElementById("weekly-workout-badge").textContent = `이번 주 운동 달성: ${weeklyWorkoutDays}일 / 목표 4회`;
        document.getElementById("check-weight-50m").checked = Boolean(checklist.weightSession50mDone);
        document.getElementById("check-stairmaster").checked = Boolean(checklist.stairMasterIntervalDone);

        const workoutListEl = document.getElementById("workout-sets-list");
        if (workouts.length === 0) {
            workoutListEl.innerHTML = `<p class="empty-hint">오늘 기록된 웨이트 세트가 없습니다. 우측 상단 [+ 세트 기록]을 눌러 추가하세요.</p>`;
        } else {
            workoutListEl.innerHTML = workouts
                .map(
                    w => `
                <div class="workout-set-row">
                    <div>
                        <strong>[${w.targetMuscleGroup}] ${w.exerciseName} · ${w.setNumber}세트</strong>
                        <span>중량 ${w.weightKg}kg × ${w.reps}회 (볼륨 ${Math.round(w.weightKg * w.reps)}kg)</span>
                    </div>
                    <button type="button" class="btn-icon-delete" data-delete-workout="${w.id}" title="삭제">✕</button>
                </div>
            `
                )
                .join("");

            workoutListEl.querySelectorAll("[data-delete-workout]").forEach(btn => {
                btn.addEventListener("click", () => {
                    const id = Number(btn.getAttribute("data-delete-workout"));
                    GymRatStorage.deleteWorkoutSet(id);
                    this.renderDashboardScreen();
                });
            });
        }
    }

    updateMacroBar(prefix, consumed, target, badgeText) {
        const pct = Math.min(100, Math.round((consumed / Math.max(1, target)) * 100));
        document.getElementById(`macro-${prefix}-text`).textContent = `${consumed}g / ${target}g (${badgeText})`;
        document.getElementById(`macro-${prefix}-bar`).style.width = `${pct}%`;
    }

    updateRoutineCardState(key, isRegistered) {
        const card = document.getElementById(`routine-card-${key}`);
        const btn = document.getElementById(`btn-toggle-${key}`);
        if (!card || !btn) return;
        if (isRegistered) {
            card.classList.add("registered");
            btn.textContent = "등록됨 ✓";
            btn.classList.add("active");
        } else {
            card.classList.remove("registered");
            btn.textContent = "원클릭 등록";
            btn.classList.remove("active");
        }
    }

    renderGraphScreen() {
        const profile = GymRatStorage.getProfile();
        const allRecords = GymRatStorage.getWeightRecords();
        const plan = SafeWeightLossCalculator.calculate(profile, allRecords);

        // 기간 필터링
        let filtered = allRecords;
        if (this.chartPeriodDays != null) {
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - this.chartPeriodDays);
            const cutoffStr = cutoff.toISOString().slice(0, 10);
            filtered = allRecords.filter(r => r.recordDate >= cutoffStr);
        }

        if (this.selectedChartPointIndex == null || this.selectedChartPointIndex >= filtered.length) {
            this.selectedChartPointIndex = Math.max(0, filtered.length - 1);
        }

        // 상단 요약 미니 카드
        const totalLost = Math.max(0, profile.startWeightKg - plan.currentWeightKg);
        const totalGoalSpan = Math.max(0.1, profile.startWeightKg - profile.targetWeightKg);
        const totalGoalPct = Math.min(100, Math.round((totalLost / totalGoalSpan) * 100));

        document.getElementById("graph-header-progress-text").textContent =
            `시작 ${profile.startWeightKg.toFixed(2)}kg → 현재 ${plan.currentWeightKg.toFixed(2)}kg`;
        document.getElementById("graph-header-remain-text").textContent =
            `최종 목표(${profile.targetWeightKg}kg)까지 -${plan.totalRemainingWeightKg.toFixed(2)}kg (${totalGoalPct}%)`;
        document.getElementById("graph-header-progress-bar").style.width = `${totalGoalPct}%`;

        // 탭 및 기간 버튼 활성화 표시
        document.querySelectorAll("[data-chart-tab]").forEach(btn => {
            btn.classList.toggle("active", btn.getAttribute("data-chart-tab") === this.chartMetricTab);
        });
        document.querySelectorAll("[data-chart-period]").forEach(btn => {
            const val = btn.getAttribute("data-chart-period");
            const active = (val === "ALL" && this.chartPeriodDays === null) || parseInt(val, 10) === this.chartPeriodDays;
            btn.classList.toggle("active", active);
        });

        // 선택된 포인트 툴팁 업데이트
        const selRecord = filtered[this.selectedChartPointIndex];
        if (selRecord) {
            const fatMass = selRecord.bodyFatMassKg != null
                ? Number(selRecord.bodyFatMassKg)
                : SafeWeightLossCalculator.round2(selRecord.weightKg * (selRecord.bodyFatPercentage / 100));
            document.getElementById("chart-tooltip-date").textContent = `측정일: ${selRecord.recordDate}`;
            document.getElementById("chart-tooltip-memo").textContent = selRecord.memo || "기록된 메모 없음";
            document.getElementById("chart-tooltip-weight").textContent = `${Number(selRecord.weightKg).toFixed(2)}kg`;
            document.getElementById("chart-tooltip-muscle").textContent = `${Number(selRecord.skeletalMuscleMassKg).toFixed(2)}kg`;
            document.getElementById("chart-tooltip-fat").textContent = `${fatMass.toFixed(2)}kg (${Number(selRecord.bodyFatPercentage).toFixed(1)}%)`;
        }

        // Canvas 그래프 렌더링
        GymRatCharts.renderBodyCompositionChart(
            document.getElementById("canvas-body-chart"),
            filtered,
            profile,
            this.chartMetricTab,
            this.selectedChartPointIndex,
            newIdx => {
                this.selectedChartPointIndex = newIdx;
                this.renderGraphScreen();
            }
        );

        // 히스토리 리스트 렌더링
        const historyEl = document.getElementById("weight-history-list");
        const reversed = [...filtered].reverse();
        historyEl.innerHTML = reversed
            .map(rec => {
                const fatMass = rec.bodyFatMassKg != null
                    ? Number(rec.bodyFatMassKg)
                    : SafeWeightLossCalculator.round2(rec.weightKg * (rec.bodyFatPercentage / 100));
                const muscleOk = Number(rec.skeletalMuscleMassKg) >= Number(profile.minTargetSkeletalMuscleKg);
                return `
                <div class="history-card">
                    <div class="history-info">
                        <div class="history-date-row">
                            <strong>${rec.recordDate}</strong>
                            <span class="defense-pill ${muscleOk ? "ok" : "warn"}">
                                ${muscleOk ? "골격근 방어 ✓" : "근손실 주의 ⚠"}
                            </span>
                        </div>
                        <p class="history-metrics">
                            체중 <b>${Number(rec.weightKg).toFixed(2)}kg</b> ·
                            골격근 <b>${Number(rec.skeletalMuscleMassKg).toFixed(2)}kg</b> ·
                            체지방량 <b>${fatMass.toFixed(2)}kg (${Number(rec.bodyFatPercentage).toFixed(1)}%)</b>
                        </p>
                        ${rec.memo ? `<p class="history-memo">${rec.memo}</p>` : ""}
                    </div>
                    <button type="button" class="btn-icon-delete" data-delete-weight="${rec.id}" title="기록 삭제">✕</button>
                </div>
            `;
            })
            .join("");

        historyEl.querySelectorAll("[data-delete-weight]").forEach(btn => {
            btn.addEventListener("click", () => {
                const id = Number(btn.getAttribute("data-delete-weight"));
                GymRatStorage.deleteWeightRecord(id);
                this.renderAll();
                this.showToast("체성분 기록이 삭제되었습니다.");
            });
        });
    }

    openBodyRecordModal() {
        const profile = GymRatStorage.getProfile();
        const records = GymRatStorage.getWeightRecords();
        const plan = SafeWeightLossCalculator.calculate(profile, records);

        document.getElementById("input-body-date").value = this.todayStr;
        document.getElementById("input-body-weight").value = plan.currentWeightKg.toFixed(2);
        document.getElementById("input-body-muscle").value = plan.currentMuscleKg.toFixed(2);
        document.getElementById("input-body-fat-mass").value = plan.currentFatMassKg.toFixed(2);
        document.getElementById("input-body-fat-pct").value = plan.currentFatPercent.toFixed(1);
        document.getElementById("input-body-memo").value = "";

        document.getElementById("modal-body-record").classList.remove("hidden");
    }

    handleSaveBodyRecord() {
        const recordDate = document.getElementById("input-body-date").value || this.todayStr;
        const weightKg = parseFloat(document.getElementById("input-body-weight").value) || 104.4;
        const skeletalMuscleMassKg = parseFloat(document.getElementById("input-body-muscle").value) || 42.8;
        const bodyFatMassKg = parseFloat(document.getElementById("input-body-fat-mass").value) || 29.86;
        const bodyFatPercentage = parseFloat(document.getElementById("input-body-fat-pct").value) || 28.6;
        const memo = document.getElementById("input-body-memo").value.trim();

        GymRatStorage.upsertWeightRecord({
            recordDate,
            weightKg,
            skeletalMuscleMassKg,
            bodyFatMassKg,
            bodyFatPercentage,
            memo
        });

        this.closeAllModals();
        this.renderAll();
        this.showToast(
            `체성분 저장 완료: ${weightKg.toFixed(2)}kg / 골격근 ${skeletalMuscleMassKg.toFixed(2)}kg / 체지방량 ${bodyFatMassKg.toFixed(2)}kg`
        );
    }

    openGoalSettingModal() {
        const profile = GymRatStorage.getProfile();
        document.getElementById("input-goal-weight").value = profile.targetWeightKg;
        document.getElementById("input-goal-muscle").value = profile.minTargetSkeletalMuscleKg;
        document.getElementById("input-goal-fat-pct").value = profile.targetBodyFatPercent;
        document.getElementById("input-goal-height").value = profile.heightCm;
        document.getElementById("input-goal-kcal").value = profile.dailyTargetCalories;
        document.getElementById("input-goal-protein").value = profile.dailyTargetProteinG;

        document.getElementById("modal-goal-setting").classList.remove("hidden");
    }

    handleSaveGoals() {
        const profile = GymRatStorage.getProfile();
        profile.targetWeightKg = parseFloat(document.getElementById("input-goal-weight").value) || 90.0;
        profile.minTargetSkeletalMuscleKg = parseFloat(document.getElementById("input-goal-muscle").value) || 41.0;
        profile.targetBodyFatPercent = parseFloat(document.getElementById("input-goal-fat-pct").value) || 19.5;
        profile.heightCm = parseFloat(document.getElementById("input-goal-height").value) || 184.0;
        profile.dailyTargetCalories = parseInt(document.getElementById("input-goal-kcal").value, 10) || 2250;
        profile.dailyTargetProteinG = parseInt(document.getElementById("input-goal-protein").value, 10) || 160;

        GymRatStorage.saveProfile(profile);
        this.closeAllModals();
        this.renderAll();
        this.showToast(
            `목표 업데이트 완료: 체중 ${profile.targetWeightKg}kg · 골격근 ${profile.minTargetSkeletalMuscleKg}kg 방어 · 체지방 ${profile.targetBodyFatPercent}%`
        );
    }

    openWorkoutModal() {
        const workouts = GymRatStorage.getWorkoutRecordsByDate(this.todayStr);
        const chipsContainer = document.getElementById("machine-preset-chips");
        chipsContainer.innerHTML = MachinePresets.map(
            (p, idx) => `
            <button type="button" class="chip-btn ${idx === 0 ? "active" : ""}" data-preset-idx="${idx}">
                ${p.name} (${p.muscle})
            </button>
        `
        ).join("");

        this.selectedMachinePreset = MachinePresets[0];
        document.getElementById("input-workout-name").value = this.selectedMachinePreset.name;
        document.getElementById("input-workout-set").value = workouts.length + 1;

        chipsContainer.querySelectorAll("[data-preset-idx]").forEach(btn => {
            btn.addEventListener("click", () => {
                chipsContainer.querySelectorAll(".chip-btn").forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                const preset = MachinePresets[Number(btn.getAttribute("data-preset-idx"))];
                this.selectedMachinePreset = preset;
                document.getElementById("input-workout-name").value = preset.name;
            });
        });

        document.getElementById("modal-workout-set").classList.remove("hidden");
    }

    handleSaveWorkoutSet() {
        const exerciseName = document.getElementById("input-workout-name").value.trim() || "체스트 프레스 머신";
        const setNumber = parseInt(document.getElementById("input-workout-set").value, 10) || 1;
        const weightKg = parseFloat(document.getElementById("input-workout-weight").value) || 80;
        const reps = parseInt(document.getElementById("input-workout-reps").value, 10) || 10;

        GymRatStorage.addWorkoutSet({
            recordDate: this.todayStr,
            exerciseName,
            targetMuscleGroup: this.selectedMachinePreset ? this.selectedMachinePreset.muscle : "대근육",
            setNumber,
            weightKg,
            reps
        });

        this.closeAllModals();
        this.renderDashboardScreen();
        this.showToast(`${exerciseName} ${setNumber}세트 (${weightKg}kg × ${reps}회) 기록 완료!`);
    }

    adjustTargetCalories(delta) {
        const profile = GymRatStorage.getProfile();
        profile.dailyTargetCalories = Math.max(1500, Math.min(3500, Number(profile.dailyTargetCalories) + delta));
        GymRatStorage.saveProfile(profile);
        this.renderDashboardScreen();
        this.showToast(`일일 목표 칼로리가 ${profile.dailyTargetCalories.toLocaleString()} kcal로 조정되었습니다.`);
    }

    addWater(deltaMl) {
        const checklist = GymRatStorage.getChecklist(this.todayStr);
        checklist.waterIntakeMl = Math.max(0, Math.min(6000, Number(checklist.waterIntakeMl) + deltaMl));
        GymRatStorage.saveChecklist(this.todayStr, checklist);
        this.renderDashboardScreen();
    }

    closeAllModals() {
        document.querySelectorAll(".modal-backdrop").forEach(m => m.classList.add("hidden"));
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const app = new GymRatApp();
    app.init();
});
