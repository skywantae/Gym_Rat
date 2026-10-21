/**
 * GymRat - 메인 웹 애플리케이션 컨트롤러
 * - 이모티콘 완전 배제
 * - '오늘 체성분 입력' 단일 진입점 및 저장 즉시 전 화면 실시간 반영 (기존 기록 100% 보존)
 * - '이번 주 목표까지' 클릭 시 현재 주차, 이전 측정 기록, 이후 주차별 예상 몸무게 모달 표시
 */

import { SafeWeightLossCalculator, getLocalDateString } from "./calculator.js";
import {
    GymRatStorage,
    FixedRoutineTemplates,
    HabitMealCatalog,
    MachinePresets,
    SmartFoodCalorieEstimator
} from "./storage.js";
import { GymRatCharts } from "./chart.js";
import { FirebaseSyncService } from "./firebase-sync.js";

class GymRatApp {
    constructor() {
        this.todayStr = getLocalDateString();
        this.activeBottomNav = "dashboard"; // "dashboard" | "graph"
        this.atfleeSubTab = "summary";      // "summary" | "science"
        this.roadmapSubTab = "past";        // "past" | "future"
        this.chartPeriodDays = 30;          // 7 | 30 | 90 | 180 | null
        this.chartMetricTab = "OVERLAY";    // "OVERLAY" | "WEIGHT_ONLY" | "MUSCLE_ONLY" | "BODY_FAT_ONLY"
        this.selectedChartPointIndex = null;
        this.selectedMachinePreset = MachinePresets[0];
    }

    init() {
        GymRatStorage.ensureSeeded();
        this.bindStaticEvents();
        this.initLandingGate();

        const handleViewportChange = () => {
            if (this.resizeRaf) cancelAnimationFrame(this.resizeRaf);
            this.resizeRaf = requestAnimationFrame(() => {
                const mainEl = document.getElementById("app-main");
                if (mainEl && !mainEl.classList.contains("hidden")) {
                    if (this.activeBottomNav === "graph") {
                        this.renderGraphScreen();
                    } else {
                        this.renderDashboardScreen();
                    }
                }
            });
        };

        window.addEventListener("resize", handleViewportChange);
        window.addEventListener("orientationchange", handleViewportChange);
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

        // 오늘 체성분 입력 모달 열기 버튼들
        document.querySelectorAll(".js-open-body-modal").forEach(btn => {
            btn.addEventListener("click", () => this.openBodyRecordModal());
        });

        // 목표 설정 모달 열기 버튼들
        document.querySelectorAll(".js-open-goal-modal").forEach(btn => {
            btn.addEventListener("click", () => this.openGoalSettingModal());
        });

        // '이번 주 목표까지' 박스 클릭 -> 현재 주차, 이전 기록, 이후 예상 몸무게 로드맵 모달 오픈
        document.getElementById("box-weekly-target").addEventListener("click", () => {
            this.openWeeklyRoadmapModal();
        });

        // 로드맵 모달 내 탭 전환 ([이전 측정 기록] | [이후 주차별 예상 몸무게])
        document.getElementById("tab-btn-roadmap-past").addEventListener("click", () => {
            this.roadmapSubTab = "past";
            this.renderWeeklyRoadmapModalContent();
        });
        document.getElementById("tab-btn-roadmap-future").addEventListener("click", () => {
            this.roadmapSubTab = "future";
            this.renderWeeklyRoadmapModalContent();
        });

        // 로드맵 모달에서 목표 수치 변경 모달로 이동
        document.querySelectorAll(".js-open-goal-from-roadmap").forEach(btn => {
            btn.addEventListener("click", () => {
                this.closeAllModals();
                this.openGoalSettingModal();
            });
        });

        // 웨이트 세트 모달 열기
        document.getElementById("btn-open-workout-modal").addEventListener("click", () => {
            this.openWorkoutModal();
        });

        // 모달 닫기 버튼들
        document.querySelectorAll(".js-close-modal").forEach(btn => {
            btn.addEventListener("click", () => this.closeAllModals());
        });

        // 체성분 모달: 날짜 변경 시 해당 날짜에 기존 기록이 있으면 불러오고 없으면 최신값 유지
        const dateInput = document.getElementById("input-body-date");
        const weightInput = document.getElementById("input-body-weight");
        const muscleInput = document.getElementById("input-body-muscle");
        const fatMassInput = document.getElementById("input-body-fat-mass");
        const fatPctInput = document.getElementById("input-body-fat-pct");
        const memoInput = document.getElementById("input-body-memo");

        dateInput.addEventListener("change", () => {
            const selectedDate = dateInput.value;
            const records = GymRatStorage.getWeightRecords();
            const found = records.find(r => r.recordDate === selectedDate);
            if (found) {
                weightInput.value = Number(found.weightKg).toFixed(2);
                muscleInput.value = Number(found.skeletalMuscleMassKg).toFixed(2);
                const fm = found.bodyFatMassKg != null
                    ? Number(found.bodyFatMassKg)
                    : SafeWeightLossCalculator.round2(found.weightKg * (found.bodyFatPercentage / 100));
                fatMassInput.value = fm.toFixed(2);
                fatPctInput.value = Number(found.bodyFatPercentage).toFixed(1);
                memoInput.value = found.memo || "";
            }
        });

        // 체중 / 체지방량(kg) / 체지방률(%) 실시간 자동 상호 계산
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

        // 목표 설정 저장 폼 제출 및 직업/활동량 실시간 TDEE 프리뷰 이벤트
        document.getElementById("form-goal-setting").addEventListener("submit", e => {
            e.preventDefault();
            this.handleSaveGoals();
        });

        [
            "input-goal-gender",
            "input-goal-age",
            "input-goal-height",
            "input-goal-occupation",
            "input-goal-posture",
            "input-goal-work-hours",
            "input-goal-work-days",
            "input-goal-workout-days",
            "input-goal-weight",
            "input-goal-muscle",
            "input-goal-fat-pct"
        ].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener("input", () => this.updateGoalModalTdeePreview());
                el.addEventListener("change", () => this.updateGoalModalTdeePreview());
            }
        });

        document.getElementById("btn-apply-recommended-kcal").addEventListener("click", () => {
            if (this.latestPreviewRecommendedKcal) {
                document.getElementById("input-goal-kcal").value = this.latestPreviewRecommendedKcal;
                this.showToast(`권장 섭취 칼로리(${this.latestPreviewRecommendedKcal.toLocaleString()} kcal)가 입력칸에 반영되었습니다.`);
            }
        });

        // 식습관 기반 고정 식단 칼로리 계산기 모달 오픈 및 이벤트
        document.getElementById("btn-open-habit-modal").addEventListener("click", () => {
            this.openHabitBuilderModal();
        });

        document.getElementById("form-habit-builder").addEventListener("submit", e => {
            e.preventDefault();
            this.handleSaveHabitBuilder();
        });

        document.getElementById("select-habit-breakfast").addEventListener("change", e => {
            this.applyBreakfastPresetToInputs(e.target.value);
            this.updateHabitBuilderPreview();
        });

        document.getElementById("select-habit-lunch-main").addEventListener("change", e => {
            this.applyLunchMainPresetToInputs(e.target.value);
            this.updateHabitBuilderPreview();
        });

        document.getElementById("select-habit-drink").addEventListener("change", e => {
            this.applyDrinkPresetToInputs(e.target.value);
            this.updateHabitBuilderPreview();
        });

        const bindModalDirectFoodCalc = (btnId, inputId, category, applyFn) => {
            const btn = document.getElementById(btnId);
            const inp = document.getElementById(inputId);
            const trigger = () => {
                if (!inp) return;
                const est = SmartFoodCalorieEstimator.estimateFromText(inp.value, category);
                if (!est) {
                    this.showToast("계산할 음식 이름을 입력해주세요. (예: 육회비빔밥 / 계란 2개, 두유)");
                    return;
                }
                applyFn(est);
                this.updateHabitBuilderPreview();
                this.showToast(`${est.breakdownText} -> 총 ${est.caloriesKcal.toLocaleString()} kcal (단백질 ${est.proteinG}g) 계산 반영`);
            };
            if (btn) btn.addEventListener("click", trigger);
            if (inp) {
                inp.addEventListener("keydown", e => {
                    if (e.key === "Enter") {
                        e.preventDefault();
                        trigger();
                    }
                });
            }
        };

        bindModalDirectFoodCalc("btn-modal-calc-bf", "input-modal-direct-bf", "BREAKFAST", est => {
            document.getElementById("select-habit-breakfast").value = "CUSTOM";
            document.getElementById("input-habit-bf-title").value = `아침 고정 루틴 (${est.summaryTitle})`;
            document.getElementById("input-habit-bf-kcal").value = est.caloriesKcal;
            document.getElementById("input-habit-bf-pro").value = est.proteinG;
            document.getElementById("input-habit-bf-carb").value = est.carbsG;
            document.getElementById("input-habit-bf-fat").value = est.fatG;
        });

        bindModalDirectFoodCalc("btn-modal-calc-lc", "input-modal-direct-lc", "LUNCH", est => {
            document.getElementById("select-habit-lunch-main").value = "CUSTOM";
            document.getElementById("input-habit-lc-kcal").value = est.caloriesKcal;
            document.getElementById("input-habit-lc-pro").value = est.proteinG;
            document.getElementById("input-habit-lc-carb").value = est.carbsG;
            document.getElementById("input-habit-lc-fat").value = est.fatG;
        });

        bindModalDirectFoodCalc("btn-modal-calc-dr", "input-modal-direct-dr", "DRINK", est => {
            document.getElementById("select-habit-drink").value = "CUSTOM";
            document.getElementById("input-habit-dr-kcal").value = est.caloriesKcal;
            document.getElementById("input-habit-dr-pro").value = est.proteinG;
            document.getElementById("input-habit-dr-carb").value = est.carbsG;
            document.getElementById("input-habit-dr-fat").value = est.fatG;
        });

        [
            "input-habit-bf-title",
            "input-habit-bf-kcal",
            "input-habit-bf-pro",
            "input-habit-bf-carb",
            "input-habit-bf-fat",
            "input-habit-lc-kcal",
            "input-habit-lc-pro",
            "input-habit-lc-carb",
            "input-habit-lc-fat",
            "input-habit-dr-kcal",
            "input-habit-dr-pro",
            "input-habit-dr-carb",
            "input-habit-dr-fat"
        ].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener("input", () => this.updateHabitBuilderPreview());
            }
        });

        // 랜딩 페이지(아이디 + PIN 게이트) 폼 및 액션 이벤트
        const landingForm = document.getElementById("form-landing-auth");
        if (landingForm) {
            landingForm.addEventListener("submit", e => {
                e.preventDefault();
                this.handleLandingAuthSubmit();
            });
        }

        const togglePinBtn = document.getElementById("btn-toggle-landing-pin");
        if (togglePinBtn) {
            togglePinBtn.addEventListener("click", () => {
                const pinEl = document.getElementById("landing-input-pin");
                if (!pinEl) return;
                const isHidden = pinEl.type === "password";
                pinEl.type = isHidden ? "text" : "password";
                togglePinBtn.textContent = isHidden ? "숨김" : "표시";
            });
        }

        // 클라우드 동기화 모달 및 액션 버튼 이벤트
        document.getElementById("btn-open-sync-modal").addEventListener("click", () => {
            this.openCloudSyncModal();
        });

        const headerLogoutBtn = document.getElementById("btn-header-logout");
        if (headerLogoutBtn) {
            headerLogoutBtn.addEventListener("click", () => {
                this.handleCloudUnlink();
            });
        }

        const onboardLogoutBtn = document.getElementById("btn-onboard-logout");
        if (onboardLogoutBtn) {
            onboardLogoutBtn.addEventListener("click", () => {
                this.handleCloudUnlink();
            });
        }

        const openOnboardFromGoalBtn = document.getElementById("btn-open-onboarding-from-goal");
        if (openOnboardFromGoalBtn) {
            openOnboardFromGoalBtn.addEventListener("click", () => {
                const syncInfo = FirebaseSyncService.getActiveSyncInfo();
                this.closeAllModals();
                this.openOnboardingWizard(syncInfo.nickname || "");
            });
        }

        document.getElementById("btn-action-backup").addEventListener("click", () => {
            this.handleCloudBackup();
        });

        document.getElementById("btn-action-restore").addEventListener("click", () => {
            this.handleCloudRestore();
        });

        document.getElementById("btn-sync-unlink").addEventListener("click", () => {
            this.handleCloudUnlink();
        });

        // 신규 계정 온보딩 질문 리스트 & 논문 근거 목표 일수 시뮬레이터 이벤트
        this.bindOnboardingWizardEvents();

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

        // 고정 식단 루틴 원클릭 토글 (사용자 맞춤 설정된 루틴 템플릿 적용)
        document.getElementById("btn-toggle-breakfast").addEventListener("click", () => {
            const customRoutines = GymRatStorage.getCustomRoutines();
            const tpl = customRoutines.BREAKFAST_FIXED;
            const added = GymRatStorage.toggleTemplateDiet(this.todayStr, tpl);
            this.renderDashboardScreen();
            FirebaseSyncService.autoSyncIfActive();
            this.showToast(
                added
                    ? `${tpl.title} 등록 완료 (+${tpl.caloriesKcal} kcal / 단백질 +${tpl.proteinG}g)`
                    : "아침 고정 루틴이 해제되었습니다."
            );
        });

        document.getElementById("btn-toggle-lunch").addEventListener("click", () => {
            const customRoutines = GymRatStorage.getCustomRoutines();
            const tpl = customRoutines.LUNCH_FIXED;
            const added = GymRatStorage.toggleTemplateDiet(this.todayStr, tpl);
            this.renderDashboardScreen();
            FirebaseSyncService.autoSyncIfActive();
            this.showToast(
                added
                    ? `${tpl.title} 등록 완료 (+${tpl.caloriesKcal.toLocaleString()} kcal). 저녁 가이드를 확인하세요.`
                    : "점심 고정 루틴이 해제되었습니다."
            );
        });

        document.getElementById("btn-toggle-booster").addEventListener("click", () => {
            const customRoutines = GymRatStorage.getCustomRoutines();
            const tpl = customRoutines.EXTRA_PROTEIN_BOOSTER;
            const added = GymRatStorage.toggleTemplateDiet(this.todayStr, tpl);
            this.renderDashboardScreen();
            FirebaseSyncService.autoSyncIfActive();
            this.showToast(
                added
                    ? `${tpl.title} 추가 완료 (+${tpl.proteinG}g 단백질)`
                    : "단백질 부스터가 해제되었습니다."
            );
        });

        // 영양제 & 수분 & 운동 완료 체크박스
        document.getElementById("switch-creatine").addEventListener("change", e => {
            const checklist = GymRatStorage.getChecklist(this.todayStr);
            checklist.creatine5gTaken = e.target.checked;
            GymRatStorage.saveChecklist(this.todayStr, checklist);
            FirebaseSyncService.autoSyncIfActive();
            if (e.target.checked) {
                this.showToast("크레아틴 5g 복용 완료. 근세포 수분 보유 및 스트렝스 방어에 도움됩니다.");
            }
        });

        document.getElementById("switch-probiotics").addEventListener("change", e => {
            const checklist = GymRatStorage.getChecklist(this.todayStr);
            checklist.probioticsTaken = e.target.checked;
            GymRatStorage.saveChecklist(this.todayStr, checklist);
            FirebaseSyncService.autoSyncIfActive();
        });

        document.getElementById("btn-water-250").addEventListener("click", () => this.addWater(250));
        document.getElementById("btn-water-500").addEventListener("click", () => this.addWater(500));
        document.getElementById("btn-water-reset").addEventListener("click", () => this.addWater(-99999));

        document.getElementById("check-weight-50m").addEventListener("change", e => {
            const checklist = GymRatStorage.getChecklist(this.todayStr);
            checklist.weightSession50mDone = e.target.checked;
            GymRatStorage.saveChecklist(this.todayStr, checklist);
            this.renderDashboardScreen();
            FirebaseSyncService.autoSyncIfActive();
        });

        document.getElementById("check-stairmaster").addEventListener("change", e => {
            const checklist = GymRatStorage.getChecklist(this.todayStr);
            checklist.stairMasterIntervalDone = e.target.checked;
            GymRatStorage.saveChecklist(this.todayStr, checklist);
            this.renderDashboardScreen();
            FirebaseSyncService.autoSyncIfActive();
            if (e.target.checked) {
                this.showToast("천국의 계단 10분 고강도 인터벌 유산소 완료.");
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
        this.renderGraphScreen();
    }

    renderDashboardScreen() {
        const profile = GymRatStorage.getProfile();
        const weightRecords = GymRatStorage.getWeightRecords();
        const plan = SafeWeightLossCalculator.calculate(profile, weightRecords);
        const diets = GymRatStorage.getDietRecordsByDate(this.todayStr);
        const checklist = GymRatStorage.getChecklist(this.todayStr);
        const workouts = GymRatStorage.getWorkoutRecordsByDate(this.todayStr);
        const weeklyWorkoutDays = GymRatStorage.getWeeklyWorkoutDaysCount(this.todayStr);

        // 상단 클라우드 동기화 상태 배지 반영
        const syncInfo = FirebaseSyncService.getActiveSyncInfo();
        const syncBtn = document.getElementById("btn-open-sync-modal");
        if (syncBtn) {
            if (syncInfo.nickname) {
                syncBtn.textContent = `계정: ${syncInfo.nickname}`;
                syncBtn.className = "btn-cloud-account active";
            } else {
                syncBtn.textContent = "클라우드 동기화";
                syncBtn.className = "btn-cloud-account";
            }
        }

        // 1. 앳플리 스타일 상단 몸무게 & 이번 주 감량 목표 박스 업데이트
        const hasRecords = weightRecords.length > 0;
        document.getElementById("latest-record-date").textContent = hasRecords
            ? `최근 기록일: ${plan.latestDate} (1주차 시작일: ${plan.startDateStr} · 총 ${weightRecords.length}회 기록)`
            : "등록된 체성분 기록이 없습니다. [오늘 체성분 입력]으로 1주차 시작일을 기록하세요.";
        document.getElementById("current-week-pill").textContent = !hasRecords
            ? "1주차 시작 대기"
            : plan.isThisWeekGoalSuccess
                ? `${plan.currentWeekNumber}주차 목표 성공`
                : plan.latestDate === plan.startDateStr
                    ? "1주차 (시작일)"
                    : `${plan.currentWeekNumber}주차 진행 중`;
        document.getElementById("atflee-current-weight").textContent = plan.currentWeightKg.toFixed(2);
        document.getElementById("atflee-weekly-remaining").textContent = plan.isThisWeekGoalSuccess
            ? "성공 (0.00)"
            : `- ${plan.remainingToLoseThisWeekKg.toFixed(2)}`;
        document.getElementById("atflee-weekly-sub1").textContent = plan.isThisWeekGoalSuccess
            ? `${plan.currentWeekNumber}주차 목표(${plan.thisWeekTargetWeightKg.toFixed(2)}kg) 도달 성공`
            : `${plan.currentWeekNumber}주차 권장 -${plan.weeklyTargetLossKg.toFixed(2)}kg (목표 ${plan.thisWeekTargetWeightKg.toFixed(2)}kg)`;
        document.getElementById("atflee-weekly-sub2").textContent =
            `터치하여 ${plan.currentWeekNumber}주차 이전 기록 및 이후 몸무게 보기`;

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
                target: `방어 ${plan.minTargetMuscleKg.toFixed(1)}kg 이상`,
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

        // 직업군 · 근무시간 · 근무형태(좌식/입식) 기반 TDEE 분석 표시
        const tdee = plan.tdeeAnalysis;
        const genderText = profile.gender === "FEMALE" ? "여성" : "남성";
        document.getElementById("tdee-occupation-title").textContent =
            `일평균 총 소모 칼로리(TDEE): 약 ${tdee.estimatedDailyTdeeKcal.toLocaleString()} kcal`;
        document.getElementById("tdee-occupation-sub").textContent =
            `${genderText} ${profile.age || 32}세 · ${tdee.occupationLabel.split("(")[0].trim()} · ${tdee.postureLabel.split("(")[0].trim()} (일 ${tdee.dailyWorkHours}시간 / 주 ${tdee.weeklyWorkDays}일)`;
        document.getElementById("tdee-breakdown-text").innerHTML =
            `기초대사량(BMR) <b>${tdee.bmrKcal.toLocaleString()}kcal</b> + 근무 중 활동소모(일평균) <b>${tdee.avgDailyWorkNeatKcal.toLocaleString()}kcal</b>(근무일 +${tdee.workDayExtraKcal}kcal) + 일상·운동·소화 소모 <b>${(tdee.nonWorkNeatKcal + tdee.avgDailyExerciseKcal + tdee.tefKcal).toLocaleString()}kcal</b> · 권장 섭취량: <strong class="text-lime">${tdee.recommendedIntakeKcal.toLocaleString()} kcal/일</strong>`;

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
            proteinTitle.textContent = `일일 단백질 ${targetProteinG}g 필수 방어 목표 달성 완료`;
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

        this.updateMacroBar("protein", consumedProteinG, targetProteinG, consumedProteinG >= targetProteinG ? "달성 완료" : `잔여 ${remainingProtein}g`);
        this.updateMacroBar("carbs", consumedCarbsG, targetCarbsG, `${Math.round((consumedCarbsG / Math.max(1, targetCarbsG)) * 100)}%`);
        this.updateMacroBar("fat", consumedFatG, targetFatG, `${Math.round((consumedFatG / Math.max(1, targetFatG)) * 100)}%`);

        // 5. 사용자 맞춤형 고정 식단 루틴 텍스트 및 등록 상태 업데이트
        const customRoutines = GymRatStorage.getCustomRoutines();
        const bfTpl = customRoutines.BREAKFAST_FIXED;
        const lcTpl = customRoutines.LUNCH_FIXED;
        const bsTpl = customRoutines.EXTRA_PROTEIN_BOOSTER;

        document.getElementById("routine-title-breakfast").textContent = bfTpl.title;
        document.getElementById("routine-sub-breakfast").textContent = bfTpl.subtitle;
        document.getElementById("routine-badge-breakfast").textContent =
            `${Number(bfTpl.caloriesKcal).toLocaleString()} kcal · 단백질 ${bfTpl.proteinG}g · 탄수 ${bfTpl.carbsG}g · 지방 ${bfTpl.fatG}g`;

        document.getElementById("routine-title-lunch").textContent = lcTpl.title;
        document.getElementById("routine-sub-lunch").textContent = lcTpl.subtitle;
        document.getElementById("routine-badge-lunch").textContent =
            `${Number(lcTpl.caloriesKcal).toLocaleString()} kcal · 단백질 ${lcTpl.proteinG}g · 탄수 ${lcTpl.carbsG}g · 지방 ${lcTpl.fatG}g`;

        document.getElementById("routine-title-booster").textContent = bsTpl.title;
        document.getElementById("routine-sub-booster").textContent = bsTpl.subtitle;
        document.getElementById("routine-badge-booster").textContent =
            `${Number(bsTpl.caloriesKcal).toLocaleString()} kcal · 단백질 ${bsTpl.proteinG}g · 탄수 ${bsTpl.carbsG}g · 지방 ${bsTpl.fatG}g`;

        const registeredCodes = new Set(diets.map(d => d.templateCode));
        this.updateRoutineCardState("breakfast", registeredCodes.has(bfTpl.templateCode));
        this.updateRoutineCardState("lunch", registeredCodes.has(lcTpl.templateCode));
        this.updateRoutineCardState("booster", registeredCodes.has(bsTpl.templateCode));

        // 6. 저녁 초저탄수 + 고단백 권장 가이드 목록 렌더링 (아침+점심 고정 칼로리 역산 반영)
        const lunchRegistered = registeredCodes.has(lcTpl.templateCode);
        const dinnerSub = document.getElementById("dinner-guide-subtitle");
        const fixedDaytimeKcal = Number(bfTpl.caloriesKcal) + Number(lcTpl.caloriesKcal);
        const dinnerBudgetKcal = Math.max(300, targetCalories - fixedDaytimeKcal);
        const dinnerNeededProtein = Math.max(30, targetProteinG - (Number(bfTpl.proteinG) + Number(lcTpl.proteinG)));

        if (lunchRegistered) {
            dinnerSub.textContent = `점심(${Number(lcTpl.caloriesKcal).toLocaleString()}kcal) 등록됨 · 저녁 권장 잔여 예산 약 ${dinnerBudgetKcal.toLocaleString()} kcal / 부족 단백질 ${dinnerNeededProtein}g 보충 모드`;
            dinnerSub.className = "section-sub text-warning";
        } else {
            dinnerSub.textContent = `아침+점심(${fixedDaytimeKcal.toLocaleString()}kcal) 제외 저녁 권장 예산: 약 ${dinnerBudgetKcal.toLocaleString()} kcal / 잔여 단백질 ${dinnerNeededProtein}g (탄수 10g 이하 권장)`;
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
                        ${selected ? "선택됨" : "가이드 적용"}
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
                    FirebaseSyncService.autoSyncIfActive();
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
            workoutListEl.innerHTML = `<p class="empty-hint">오늘 기록된 웨이트 세트가 없습니다. 우측 상단 [세트 기록 추가]를 눌러 기록하세요.</p>`;
        } else {
            workoutListEl.innerHTML = workouts
                .map(
                    w => `
                <div class="workout-set-row">
                    <div>
                        <strong>[${w.targetMuscleGroup}] ${w.exerciseName} · ${w.setNumber}세트</strong>
                        <span>중량 ${w.weightKg}kg × ${w.reps}회 (볼륨 ${Math.round(w.weightKg * w.reps)}kg)</span>
                    </div>
                    <button type="button" class="btn-text-delete" data-delete-workout="${w.id}">삭제</button>
                </div>
            `
                )
                .join("");

            workoutListEl.querySelectorAll("[data-delete-workout]").forEach(btn => {
                btn.addEventListener("click", () => {
                    const id = Number(btn.getAttribute("data-delete-workout"));
                    GymRatStorage.deleteWorkoutSet(id);
                    this.renderDashboardScreen();
                    FirebaseSyncService.autoSyncIfActive();
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
            btn.textContent = "등록됨";
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

        // 기간 필터링 (최신 기록 날짜 기준으로 필터링하여 과거/미래 모든 기록이 정상 표시되도록 보장)
        let filtered = allRecords;
        if (this.chartPeriodDays != null && allRecords.length > 0) {
            const latestDateStr = allRecords[allRecords.length - 1].recordDate;
            const [y, m, d] = latestDateStr.split("-").map(Number);
            const cutoff = new Date(y, m - 1, d);
            cutoff.setDate(cutoff.getDate() - this.chartPeriodDays);
            const cutoffStr = getLocalDateString(cutoff);
            filtered = allRecords.filter(r => r.recordDate >= cutoffStr);
        }

        if (this.selectedChartPointIndex == null || this.selectedChartPointIndex >= filtered.length) {
            this.selectedChartPointIndex = Math.max(0, filtered.length - 1);
        }

        const totalLost = Math.max(0, profile.startWeightKg - plan.currentWeightKg);
        const totalGoalSpan = Math.max(0.1, profile.startWeightKg - profile.targetWeightKg);
        const totalGoalPct = Math.min(100, Math.round((totalLost / totalGoalSpan) * 100));

        document.getElementById("graph-header-progress-text").textContent =
            `시작 ${profile.startWeightKg.toFixed(2)}kg → 현재 ${plan.currentWeightKg.toFixed(2)}kg`;
        document.getElementById("graph-header-remain-text").textContent =
            `최종 목표(${profile.targetWeightKg}kg)까지 -${plan.totalRemainingWeightKg.toFixed(2)}kg (${totalGoalPct}%)`;
        document.getElementById("graph-header-progress-bar").style.width = `${totalGoalPct}%`;

        document.querySelectorAll("[data-chart-tab]").forEach(btn => {
            btn.classList.toggle("active", btn.getAttribute("data-chart-tab") === this.chartMetricTab);
        });
        document.querySelectorAll("[data-chart-period]").forEach(btn => {
            const val = btn.getAttribute("data-chart-period");
            const active = (val === "ALL" && this.chartPeriodDays === null) || parseInt(val, 10) === this.chartPeriodDays;
            btn.classList.toggle("active", active);
        });

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
        } else {
            document.getElementById("chart-tooltip-date").textContent = "측정 기록 없음";
            document.getElementById("chart-tooltip-memo").textContent = "상단 [오늘 체성분 입력] 버튼으로 1주차 시작 기록을 등록하세요.";
            document.getElementById("chart-tooltip-weight").textContent = "-";
            document.getElementById("chart-tooltip-muscle").textContent = "-";
            document.getElementById("chart-tooltip-fat").textContent = "-";
        }

        if (!document.getElementById("screen-graph").classList.contains("hidden")) {
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
        }

        const historyEl = document.getElementById("weight-history-list");
        const reversed = [...filtered].reverse();
        if (reversed.length === 0) {
            historyEl.innerHTML = `<p class="empty-hint">저장된 체성분 측정 기록이 없습니다. 상단 [오늘 체성분 입력] 버튼을 눌러 1주차 시작일 기록을 등록하세요.</p>`;
        } else {
            historyEl.innerHTML = reversed
                .map(rec => {
                    const fatMass = rec.bodyFatMassKg != null
                        ? Number(rec.bodyFatMassKg)
                        : SafeWeightLossCalculator.round2(rec.weightKg * (rec.bodyFatPercentage / 100));
                    const muscleOk = Number(rec.skeletalMuscleMassKg) >= Number(profile.minTargetSkeletalMuscleKg);
                    const weekNum = SafeWeightLossCalculator.calculateWeekNumber(plan.startDateStr, rec.recordDate);
                    const weekLabel = rec.recordDate === plan.startDateStr ? "1주차 시작일" : `${weekNum}주차`;
                    const metaItem = plan.pastRecordsWithMeta.find(r => r.recordDate === rec.recordDate && r.id === rec.id) ||
                        plan.pastRecordsWithMeta.find(r => r.recordDate === rec.recordDate);
                    const goalSuccess = metaItem ? Boolean(metaItem.isGoalSuccess) : false;
                    return `
                <div class="history-card">
                    <div class="history-info">
                        <div class="history-date-row">
                            <strong>[${weekLabel}] ${rec.recordDate}</strong>
                            <div style="display: flex; align-items: center; gap: 6px;">
                                ${goalSuccess ? '<span class="roadmap-goal-badge success">성공</span>' : ""}
                                <span class="defense-pill ${muscleOk ? "ok" : "warn"}">
                                    ${muscleOk ? "골격근 방어" : "근손실 주의"}
                                </span>
                            </div>
                        </div>
                        <p class="history-metrics">
                            체중 <b>${Number(rec.weightKg).toFixed(2)}kg</b> ·
                            골격근 <b>${Number(rec.skeletalMuscleMassKg).toFixed(2)}kg</b> ·
                            체지방량 <b>${fatMass.toFixed(2)}kg (${Number(rec.bodyFatPercentage).toFixed(1)}%)</b>
                        </p>
                        ${rec.memo ? `<p class="history-memo">${rec.memo}</p>` : ""}
                    </div>
                    <button type="button" class="btn-text-delete" data-delete-weight="${rec.id}">삭제</button>
                </div>
            `;
                })
                .join("");

            historyEl.querySelectorAll("[data-delete-weight]").forEach(btn => {
                btn.addEventListener("click", () => {
                    const id = Number(btn.getAttribute("data-delete-weight"));
                    GymRatStorage.deleteWeightRecord(id);
                    this.selectedChartPointIndex = null;
                    this.renderAll();
                    FirebaseSyncService.autoSyncIfActive();
                    this.showToast("선택한 날짜의 체성분 기록이 삭제되었습니다.");
                });
            });
        }
    }

    /**
     * '이번 주 목표까지' 클릭 시 열리는 주차별 현황, 이전 기록, 이후 예상 몸무게 모달
     */
    openWeeklyRoadmapModal() {
        this.renderWeeklyRoadmapModalContent();
        document.getElementById("modal-weekly-roadmap").classList.remove("hidden");
    }

    renderWeeklyRoadmapModalContent() {
        const profile = GymRatStorage.getProfile();
        const records = GymRatStorage.getWeightRecords();
        const plan = SafeWeightLossCalculator.calculate(profile, records);

        document.getElementById("roadmap-modal-title").textContent =
            records.length === 0
                ? "1주차 감량 로드맵 (기록 대기 중)"
                : plan.latestDate === plan.startDateStr
                    ? "현재 1주차 (시작일) 감량 현황 및 로드맵"
                    : `현재 ${plan.currentWeekNumber}주차 감량 현황 및 로드맵`;
        document.getElementById("roadmap-modal-subtitle").textContent =
            records.length === 0
                ? `첫 체성분 기록을 등록하면 해당 날짜가 1주차 시작일로 지정되며, 목표(${plan.targetWeightKg.toFixed(1)}kg)까지 주차별 로드맵이 생성됩니다.`
                : `1주차 시작일(${plan.startDateStr}) 기준 측정 기록(${records.length}회)과 이후 목표(${plan.targetWeightKg.toFixed(1)}kg) 도달 예상 몸무게입니다.`;

        const bannerEl = document.getElementById("roadmap-current-week-banner");
        bannerEl.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; align-items: center; gap: 6px;">
                    <strong class="text-lime" style="font-size: 13.5px;">현재 ${plan.currentWeekNumber}주차 목표 요약</strong>
                    ${plan.isThisWeekGoalSuccess ? '<span class="roadmap-goal-badge success">성공</span>' : ""}
                </div>
                <span style="font-size: 11.5px; color: var(--text-secondary);">주간 권장 감량: -${plan.weeklyTargetLossKg.toFixed(2)}kg</span>
            </div>
            <div class="roadmap-summary-grid">
                <div>
                    <span>${plan.currentWeekNumber}주차 시작</span>
                    <strong>${plan.thisWeekStartWeightKg.toFixed(2)}kg</strong>
                </div>
                <div>
                    <span>현재 몸무게</span>
                    <strong class="text-blue">${plan.currentWeightKg.toFixed(2)}kg</strong>
                </div>
                <div>
                    <span>${plan.currentWeekNumber}주차 목표</span>
                    <strong class="text-lime">${plan.thisWeekTargetWeightKg.toFixed(2)}kg ${plan.isThisWeekGoalSuccess ? "(성공)" : ""}</strong>
                </div>
            </div>
        `;

        const tabPastBtn = document.getElementById("tab-btn-roadmap-past");
        const tabFutureBtn = document.getElementById("tab-btn-roadmap-future");
        const panelPast = document.getElementById("panel-roadmap-past");
        const panelFuture = document.getElementById("panel-roadmap-future");

        if (this.roadmapSubTab === "past") {
            tabPastBtn.classList.add("active");
            tabFutureBtn.classList.remove("active");
            panelPast.classList.remove("hidden");
            panelFuture.classList.add("hidden");
        } else {
            tabPastBtn.classList.remove("active");
            tabFutureBtn.classList.add("active");
            panelPast.classList.add("hidden");
            panelFuture.classList.remove("hidden");
        }

        // 1) 이전 측정 기록 렌더링 (주차별 목표 몸무게 도달 시 '성공' 배지 및 문구 표시)
        const pastRowsEl = document.getElementById("roadmap-past-rows");
        if (plan.pastRecordsWithMeta.length === 0) {
            pastRowsEl.innerHTML = `<p class="empty-hint" style="padding: 18px 8px; text-align: center;">저장된 측정 기록이 없습니다. 상단 [오늘 체성분 입력] 버튼을 눌러 1주차 시작일을 기록하세요.</p>`;
        } else {
            pastRowsEl.innerHTML = plan.pastRecordsWithMeta
                .map((rec, idx) => {
                    const deltaSign = rec.deltaWeightKg > 0 ? `+${rec.deltaWeightKg.toFixed(2)}` : rec.deltaWeightKg.toFixed(2);
                    const isLatest = idx === 0;
                    const weekTitle = rec.isStartRecord
                        ? "1주차 (시작일)"
                        : `${rec.weekNumber}주차 ${isLatest ? "(현재)" : ""}`;
                    const deltaLabel = rec.isStartRecord ? "시작 기준점" : `${deltaSign} kg`;
                    const targetSubText = rec.isGoalSuccess
                        ? `${deltaLabel} · 목표(${rec.weekTargetWeightKg.toFixed(2)}kg) 성공`
                        : rec.isStartRecord
                            ? deltaLabel
                            : `${deltaLabel} (목표 ${rec.weekTargetWeightKg.toFixed(2)}kg)`;
                    const rowClassList = [
                        "roadmap-row",
                        isLatest ? "current-week-highlight" : "",
                        rec.isGoalSuccess ? "goal-success-row" : ""
                    ]
                        .filter(Boolean)
                        .join(" ");

                    return `
                <div class="${rowClassList}">
                    <div>
                        <div class="roadmap-week-title-row">
                            <strong>${weekTitle}</strong>
                            ${rec.isGoalSuccess ? '<span class="roadmap-goal-badge success">성공</span>' : ""}
                        </div>
                        <span class="roadmap-sub">${rec.recordDate}</span>
                    </div>
                    <div>
                        <strong>${rec.weightKg.toFixed(2)} kg ${rec.isGoalSuccess ? '<span class="roadmap-inline-success">성공</span>' : ""}</strong>
                        <span class="roadmap-sub ${rec.isGoalSuccess ? "text-lime" : ""}">${targetSubText}</span>
                    </div>
                    <div>
                        <strong>골격근 ${rec.skeletalMuscleMassKg.toFixed(2)}kg</strong>
                        <span class="roadmap-sub">체지방 ${rec.bodyFatMassKg.toFixed(2)}kg (${rec.bodyFatPercentage.toFixed(1)}%)</span>
                    </div>
                </div>
            `;
                })
                .join("");
        }

        // 2) 이후 주차별 예상 몸무게 시뮬레이션 렌더링
        const futureRowsEl = document.getElementById("roadmap-future-rows");
        futureRowsEl.innerHTML = plan.futureWeeklyRoadmap
            .map(step => {
                return `
                <div class="roadmap-row ${step.isCurrentWeek ? "current-week-highlight" : ""}">
                    <div>
                        <strong>${step.weekNumber}주차 ${step.isCurrentWeek ? "(이번 주)" : "예상"}</strong>
                        <span class="roadmap-sub">${step.dateRangeText}</span>
                    </div>
                    <div>
                        <strong class="text-warning">-${step.weeklyLossKg.toFixed(2)} kg</strong>
                        <span class="roadmap-sub">안전 감량폭</span>
                    </div>
                    <div>
                        <strong class="text-lime">${step.expectedWeightKg.toFixed(2)} kg</strong>
                        <span class="roadmap-sub">예상 체지방률 ${step.expectedFatPercent.toFixed(1)}%</span>
                    </div>
                </div>
            `;
            })
            .join("");
    }

    openBodyRecordModal() {
        const profile = GymRatStorage.getProfile();
        const records = GymRatStorage.getWeightRecords();
        const plan = SafeWeightLossCalculator.calculate(profile, records);

        this.todayStr = getLocalDateString();
        document.getElementById("input-body-date").value = this.todayStr;
        document.getElementById("input-body-weight").value = plan.currentWeightKg.toFixed(2);
        document.getElementById("input-body-muscle").value = plan.currentMuscleKg.toFixed(2);
        document.getElementById("input-body-fat-mass").value = plan.currentFatMassKg.toFixed(2);
        document.getElementById("input-body-fat-pct").value = plan.currentFatPercent.toFixed(1);

        const todayExisting = records.find(r => r.recordDate === this.todayStr);
        document.getElementById("input-body-memo").value = todayExisting ? (todayExisting.memo || "") : "";

        document.getElementById("modal-body-record").classList.remove("hidden");
    }

    handleSaveBodyRecord() {
        const recordDate = document.getElementById("input-body-date").value || getLocalDateString();
        const weightKg = parseFloat(document.getElementById("input-body-weight").value);
        const skeletalMuscleMassKg = parseFloat(document.getElementById("input-body-muscle").value);
        let bodyFatMassKg = parseFloat(document.getElementById("input-body-fat-mass").value);
        let bodyFatPercentage = parseFloat(document.getElementById("input-body-fat-pct").value);
        const memo = document.getElementById("input-body-memo").value.trim();

        if (isNaN(weightKg) || weightKg <= 0 || isNaN(skeletalMuscleMassKg) || skeletalMuscleMassKg <= 0) {
            this.showToast("몸무게와 골격근량을 올바르게 입력해주세요.");
            return;
        }

        if (isNaN(bodyFatPercentage) && !isNaN(bodyFatMassKg)) {
            bodyFatPercentage = SafeWeightLossCalculator.round1((bodyFatMassKg / weightKg) * 100);
        } else if (isNaN(bodyFatMassKg) && !isNaN(bodyFatPercentage)) {
            bodyFatMassKg = SafeWeightLossCalculator.round2(weightKg * (bodyFatPercentage / 100));
        }

        const updatedList = GymRatStorage.upsertWeightRecord({
            recordDate,
            weightKg,
            skeletalMuscleMassKg,
            bodyFatMassKg: isNaN(bodyFatMassKg) ? 29.86 : bodyFatMassKg,
            bodyFatPercentage: isNaN(bodyFatPercentage) ? 28.6 : bodyFatPercentage,
            memo
        });

        this.selectedChartPointIndex = updatedList.length - 1;
        this.closeAllModals();
        this.renderAll();
        FirebaseSyncService.autoSyncIfActive();
        this.showToast(
            `${recordDate} 체성분 기록 반영 완료: ${weightKg.toFixed(2)}kg (총 ${updatedList.length}건 기록 보존)`
        );
    }

    openGoalSettingModal() {
        const profile = GymRatStorage.getProfile();
        document.getElementById("input-goal-gender").value = profile.gender || "MALE";
        document.getElementById("input-goal-age").value = profile.age || 32;
        document.getElementById("input-goal-height").value = profile.heightCm || 184.0;
        document.getElementById("input-goal-occupation").value = profile.occupationCode || "OFFICE_IT";
        document.getElementById("input-goal-posture").value = profile.workPostureCode || "MOSTLY_SITTING";
        document.getElementById("input-goal-work-hours").value = profile.dailyWorkHours != null ? profile.dailyWorkHours : 8.0;
        document.getElementById("input-goal-work-days").value = profile.weeklyWorkDays != null ? profile.weeklyWorkDays : 5;
        document.getElementById("input-goal-workout-days").value = profile.weeklyWorkoutTargetDays != null ? profile.weeklyWorkoutTargetDays : 4;

        document.getElementById("input-goal-weight").value = profile.targetWeightKg;
        document.getElementById("input-goal-muscle").value = profile.minTargetSkeletalMuscleKg;
        document.getElementById("input-goal-fat-pct").value = profile.targetBodyFatPercent;
        document.getElementById("input-goal-kcal").value = profile.dailyTargetCalories;
        document.getElementById("input-goal-protein").value = profile.dailyTargetProteinG;

        this.updateGoalModalTdeePreview();
        document.getElementById("modal-goal-setting").classList.remove("hidden");
    }

    updateGoalModalTdeePreview() {
        const profile = GymRatStorage.getProfile();
        const records = GymRatStorage.getWeightRecords();
        const plan = SafeWeightLossCalculator.calculate(profile, records);

        const gender = document.getElementById("input-goal-gender").value || "MALE";
        const age = parseInt(document.getElementById("input-goal-age").value, 10) || 32;
        const heightCm = parseFloat(document.getElementById("input-goal-height").value) || 184.0;
        const occupationCode = document.getElementById("input-goal-occupation").value || "OFFICE_IT";
        const workPostureCode = document.getElementById("input-goal-posture").value || "MOSTLY_SITTING";
        const dailyWorkHours = parseFloat(document.getElementById("input-goal-work-hours").value);
        const weeklyWorkDays = parseInt(document.getElementById("input-goal-work-days").value, 10);
        const weeklyWorkoutSessions = parseInt(document.getElementById("input-goal-workout-days").value, 10);

        const tdee = SafeWeightLossCalculator.computeOccupationalTdee({
            gender,
            age,
            heightCm,
            weightKg: plan.currentWeightKg,
            fatPercent: plan.currentFatPercent,
            occupationCode,
            workPostureCode,
            dailyWorkHours: isNaN(dailyWorkHours) ? 8 : dailyWorkHours,
            weeklyWorkDays: isNaN(weeklyWorkDays) ? 5 : weeklyWorkDays,
            weeklyWorkoutSessions: isNaN(weeklyWorkoutSessions) ? 4 : weeklyWorkoutSessions,
            recommendedDailyDeficitKcal: plan.recommendedDailyDeficitKcal
        });

        this.latestPreviewRecommendedKcal = tdee.recommendedIntakeKcal;

        document.getElementById("goal-tdee-total-text").textContent =
            `일평균 총 소모량(TDEE): 약 ${tdee.estimatedDailyTdeeKcal.toLocaleString()} kcal/일`;
        document.getElementById("goal-tdee-detail-text").innerHTML =
            `기초대사량(BMR) <b>${tdee.bmrKcal.toLocaleString()}kcal</b> + 근무 활동소모(일평균) <b>${tdee.avgDailyWorkNeatKcal.toLocaleString()}kcal</b>(근무일 당일 +${tdee.workDayExtraKcal}kcal) + 일상·운동·소화 소모 <b>${(tdee.nonWorkNeatKcal + tdee.avgDailyExerciseKcal + tdee.tefKcal).toLocaleString()}kcal</b><br/>` +
            `주간 안전 감량(-${plan.weeklyTargetLossKg.toFixed(2)}kg/주, 일일 -${plan.recommendedDailyDeficitKcal}kcal 적자) 반영 권장 섭취량: <strong class="text-lime">${tdee.recommendedIntakeKcal.toLocaleString()} kcal/일</strong>`;
    }

    handleSaveGoals() {
        const profile = GymRatStorage.getProfile();
        profile.gender = document.getElementById("input-goal-gender").value || "MALE";
        profile.age = parseInt(document.getElementById("input-goal-age").value, 10) || 32;
        profile.heightCm = parseFloat(document.getElementById("input-goal-height").value) || 184.0;
        profile.occupationCode = document.getElementById("input-goal-occupation").value || "OFFICE_IT";
        profile.workPostureCode = document.getElementById("input-goal-posture").value || "MOSTLY_SITTING";
        const workHours = parseFloat(document.getElementById("input-goal-work-hours").value);
        const workDays = parseInt(document.getElementById("input-goal-work-days").value, 10);
        const workoutDays = parseInt(document.getElementById("input-goal-workout-days").value, 10);
        profile.dailyWorkHours = isNaN(workHours) ? 8.0 : workHours;
        profile.weeklyWorkDays = isNaN(workDays) ? 5 : workDays;
        profile.weeklyWorkoutTargetDays = isNaN(workoutDays) ? 4 : workoutDays;

        profile.targetWeightKg = parseFloat(document.getElementById("input-goal-weight").value) || 90.0;
        profile.minTargetSkeletalMuscleKg = parseFloat(document.getElementById("input-goal-muscle").value) || 41.0;
        profile.targetBodyFatPercent = parseFloat(document.getElementById("input-goal-fat-pct").value) || 19.5;
        profile.dailyTargetCalories = parseInt(document.getElementById("input-goal-kcal").value, 10) || 2250;
        profile.dailyTargetProteinG = parseInt(document.getElementById("input-goal-protein").value, 10) || 160;

        GymRatStorage.saveProfile(profile);
        this.closeAllModals();
        this.renderAll();
        FirebaseSyncService.autoSyncIfActive();
        this.showToast(
            `프로필·직업 활동량·목표 저장 완료: 일일 목표 ${profile.dailyTargetCalories.toLocaleString()} kcal · 목표 체중 ${profile.targetWeightKg}kg`
        );
    }

    /**
     * 식습관 기반 나만의 고정 식단 칼로리 계산기 모달
     */
    openHabitBuilderModal() {
        const customRoutines = GymRatStorage.getCustomRoutines();

        const bfSelect = document.getElementById("select-habit-breakfast");
        bfSelect.innerHTML =
            HabitMealCatalog.BREAKFAST_PRESETS.map(
                p => `<option value="${p.code}">${p.label} (${p.caloriesKcal} kcal / 단백질 ${p.proteinG}g)</option>`
            ).join("") + `<option value="CUSTOM">직접 입력 / 사용자 커스텀</option>`;

        const lcSelect = document.getElementById("select-habit-lunch-main");
        lcSelect.innerHTML =
            HabitMealCatalog.LUNCH_MAIN_PRESETS.map(
                p => `<option value="${p.code}">${p.label} (${p.caloriesKcal.toLocaleString()} kcal)</option>`
            ).join("") + `<option value="CUSTOM">직접 입력 / 사용자 커스텀</option>`;

        const drSelect = document.getElementById("select-habit-drink");
        drSelect.innerHTML =
            HabitMealCatalog.FIXED_DRINK_PRESETS.map(
                p => `<option value="${p.code}">${p.label} (${p.caloriesKcal} kcal)</option>`
            ).join("") + `<option value="CUSTOM">직접 입력 / 사용자 커스텀</option>`;

        bfSelect.value = customRoutines.breakfastPresetCode || "BF_EGG3_APPLE1_SHAKE";
        lcSelect.value = customRoutines.lunchMainPresetCode || "LC_CAFETERIA_SEOLLEONGTANG";
        drSelect.value = customRoutines.fixedDrinkPresetCode || "DR_GS25_BARISTA_174";

        // 아침 기존 값 세팅
        const bf = customRoutines.BREAKFAST_FIXED;
        document.getElementById("input-habit-bf-title").value = bf.title;
        document.getElementById("input-habit-bf-kcal").value = bf.caloriesKcal;
        document.getElementById("input-habit-bf-pro").value = bf.proteinG;
        document.getElementById("input-habit-bf-carb").value = bf.carbsG;
        document.getElementById("input-habit-bf-fat").value = bf.fatG;

        // 점심 주메뉴 + 고정 음료 값 세팅
        this.applyLunchMainPresetToInputs(lcSelect.value);
        this.applyDrinkPresetToInputs(drSelect.value);

        this.updateHabitBuilderPreview();
        document.getElementById("modal-habit-builder").classList.remove("hidden");
    }

    applyBreakfastPresetToInputs(code) {
        const found = HabitMealCatalog.BREAKFAST_PRESETS.find(p => p.code === code);
        if (!found) return;
        document.getElementById("input-habit-bf-title").value = `아침 고정 루틴 (${found.label})`;
        document.getElementById("input-habit-bf-kcal").value = found.caloriesKcal;
        document.getElementById("input-habit-bf-pro").value = found.proteinG;
        document.getElementById("input-habit-bf-carb").value = found.carbsG;
        document.getElementById("input-habit-bf-fat").value = found.fatG;
    }

    applyLunchMainPresetToInputs(code) {
        const found = HabitMealCatalog.LUNCH_MAIN_PRESETS.find(p => p.code === code);
        if (!found) return;
        document.getElementById("input-habit-lc-kcal").value = found.caloriesKcal;
        document.getElementById("input-habit-lc-pro").value = found.proteinG;
        document.getElementById("input-habit-lc-carb").value = found.carbsG;
        document.getElementById("input-habit-lc-fat").value = found.fatG;
    }

    applyDrinkPresetToInputs(code) {
        const found = HabitMealCatalog.FIXED_DRINK_PRESETS.find(p => p.code === code);
        if (!found) return;
        document.getElementById("input-habit-dr-kcal").value = found.caloriesKcal;
        document.getElementById("input-habit-dr-pro").value = found.proteinG;
        document.getElementById("input-habit-dr-carb").value = found.carbsG;
        document.getElementById("input-habit-dr-fat").value = found.fatG;
    }

    updateHabitBuilderPreview() {
        const profile = GymRatStorage.getProfile();
        const bfKcal = parseInt(document.getElementById("input-habit-bf-kcal").value, 10) || 0;
        const bfPro = parseInt(document.getElementById("input-habit-bf-pro").value, 10) || 0;

        const lcKcal = parseInt(document.getElementById("input-habit-lc-kcal").value, 10) || 0;
        const lcPro = parseInt(document.getElementById("input-habit-lc-pro").value, 10) || 0;

        const drKcal = parseInt(document.getElementById("input-habit-dr-kcal").value, 10) || 0;
        const drPro = parseInt(document.getElementById("input-habit-dr-pro").value, 10) || 0;

        const lunchTotalKcal = lcKcal + drKcal;
        const lunchTotalPro = lcPro + drPro;
        const daytimeTotalKcal = bfKcal + lunchTotalKcal;
        const daytimeTotalPro = bfPro + lunchTotalPro;

        const targetKcal = Number(profile.dailyTargetCalories) || 2250;
        const targetPro = Number(profile.dailyTargetProteinG) || 160;
        const remainDinnerKcal = targetKcal - daytimeTotalKcal;
        const remainDinnerPro = Math.max(0, targetPro - daytimeTotalPro);

        const box = document.getElementById("habit-calc-result-box");
        box.innerHTML = `
            <div class="tdee-preview-header">
                <strong class="text-lime">아침 + 점심·음료 고정 합계: ${daytimeTotalKcal.toLocaleString()} kcal (단백질 ${daytimeTotalPro}g)</strong>
            </div>
            <p class="tdee-preview-sub">
                1) 아침 고정: <b>${bfKcal.toLocaleString()} kcal</b> (단백질 ${bfPro}g)<br/>
                2) 점심 + 고정 음료 합산: 식사 <b>${lcKcal.toLocaleString()} kcal</b> + 음료 <b>${drKcal.toLocaleString()} kcal</b> = <b>${lunchTotalKcal.toLocaleString()} kcal</b> (단백질 ${lunchTotalPro}g)<br/>
                3) 일일 목표(${targetKcal.toLocaleString()} kcal / 단백질 ${targetPro}g) 기준 <b>저녁 권장 잔여 칼로리: <span class="text-blue">${remainDinnerKcal.toLocaleString()} kcal</span></b> / <b>추가 필요 단백질: <span class="text-lime">${remainDinnerPro}g</span></b>
            </p>
        `;
    }

    handleSaveHabitBuilder() {
        const bfCode = document.getElementById("select-habit-breakfast").value;
        const lcCode = document.getElementById("select-habit-lunch-main").value;
        const drCode = document.getElementById("select-habit-drink").value;

        const bfTitle = document.getElementById("input-habit-bf-title").value.trim() || "아침 고정 루틴";
        const bfKcal = parseInt(document.getElementById("input-habit-bf-kcal").value, 10) || 0;
        const bfPro = parseInt(document.getElementById("input-habit-bf-pro").value, 10) || 0;
        const bfCarb = parseInt(document.getElementById("input-habit-bf-carb").value, 10) || 0;
        const bfFat = parseInt(document.getElementById("input-habit-bf-fat").value, 10) || 0;

        const lcKcal = parseInt(document.getElementById("input-habit-lc-kcal").value, 10) || 0;
        const lcPro = parseInt(document.getElementById("input-habit-lc-pro").value, 10) || 0;
        const lcCarb = parseInt(document.getElementById("input-habit-lc-carb").value, 10) || 0;
        const lcFat = parseInt(document.getElementById("input-habit-lc-fat").value, 10) || 0;

        const drKcal = parseInt(document.getElementById("input-habit-dr-kcal").value, 10) || 0;
        const drPro = parseInt(document.getElementById("input-habit-dr-pro").value, 10) || 0;
        const drCarb = parseInt(document.getElementById("input-habit-dr-carb").value, 10) || 0;
        const drFat = parseInt(document.getElementById("input-habit-dr-fat").value, 10) || 0;

        const bfPresetObj = HabitMealCatalog.BREAKFAST_PRESETS.find(p => p.code === bfCode);
        const lcPresetObj = HabitMealCatalog.LUNCH_MAIN_PRESETS.find(p => p.code === lcCode);
        const drPresetObj = HabitMealCatalog.FIXED_DRINK_PRESETS.find(p => p.code === drCode);

        const lcLabelShort = lcPresetObj ? lcPresetObj.label.split("(")[0].trim() : "점심 식사";
        const drLabelShort = drPresetObj ? drPresetObj.label.split("(")[0].trim() : "고정 음료";

        const lunchCombinedKcal = lcKcal + drKcal;
        const lunchCombinedPro = lcPro + drPro;
        const lunchCombinedCarb = lcCarb + drCarb;
        const lunchCombinedFat = lcFat + drFat;

        GymRatStorage.saveCustomRoutines(
            {
                breakfastPresetCode: bfCode,
                lunchMainPresetCode: lcCode,
                fixedDrinkPresetCode: drCode,
                BREAKFAST_FIXED: {
                    templateCode: "FIXED_BREAKFAST_EGG_APPLE_SHAKE",
                    mealType: "BREAKFAST",
                    mealLabel: "아침",
                    title: bfTitle,
                    subtitle: bfPresetObj ? bfPresetObj.detail : `사용자 맞춤 아침 식단 (${bfKcal} kcal / 단백질 ${bfPro}g)`,
                    badgeText: `원클릭 고정 루틴 · ${bfKcal.toLocaleString()} kcal / 단백질 ${bfPro}g`,
                    caloriesKcal: bfKcal,
                    carbsG: bfCarb,
                    proteinG: bfPro,
                    fatG: bfFat
                },
                LUNCH_FIXED: {
                    templateCode: "FIXED_LUNCH_CAFETERIA_LATTE",
                    mealType: "LUNCH",
                    mealLabel: "점심",
                    title: `점심 고정 루틴 (${lcLabelShort} + ${drLabelShort})`,
                    subtitle: `${lcLabelShort}(약 ${lcKcal.toLocaleString()} kcal) + ${drLabelShort}(${drKcal.toLocaleString()} kcal)`,
                    badgeText: `고정 템플릿 · ${lunchCombinedKcal.toLocaleString()} kcal / 단백질 ${lunchCombinedPro}g`,
                    caloriesKcal: lunchCombinedKcal,
                    carbsG: lunchCombinedCarb,
                    proteinG: lunchCombinedPro,
                    fatG: lunchCombinedFat
                }
            },
            this.todayStr
        );

        this.closeAllModals();
        this.renderDashboardScreen();
        FirebaseSyncService.autoSyncIfActive();
        this.showToast(
            `맞춤 식습관 루틴 적용 완료: 아침 ${bfKcal.toLocaleString()}kcal / 점심+음료 ${lunchCombinedKcal.toLocaleString()}kcal`
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
        FirebaseSyncService.autoSyncIfActive();
        this.showToast(`${exerciseName} ${setNumber}세트 (${weightKg}kg × ${reps}회) 기록 완료.`);
    }

    adjustTargetCalories(delta) {
        const profile = GymRatStorage.getProfile();
        profile.dailyTargetCalories = Math.max(1500, Math.min(3500, Number(profile.dailyTargetCalories) + delta));
        GymRatStorage.saveProfile(profile);
        this.renderDashboardScreen();
        FirebaseSyncService.autoSyncIfActive();
        this.showToast(`일일 목표 칼로리가 ${profile.dailyTargetCalories.toLocaleString()} kcal로 조정되었습니다.`);
    }

    addWater(deltaMl) {
        const checklist = GymRatStorage.getChecklist(this.todayStr);
        checklist.waterIntakeMl = Math.max(0, Math.min(6000, Number(checklist.waterIntakeMl) + deltaMl));
        GymRatStorage.saveChecklist(this.todayStr, checklist);
        this.renderDashboardScreen();
        FirebaseSyncService.autoSyncIfActive();
    }

    /**
     * 초기 랜딩 페이지 (본인 지정 아이디 + PIN 게이트) 초기화 및 인증 처리
     */
    initLandingGate() {
        const landingGate = document.getElementById("screen-landing-gate");
        const onboardingWizard = document.getElementById("screen-onboarding-wizard");
        const appMain = document.getElementById("app-main");
        const bottomNav = document.getElementById("app-bottom-nav");
        const idInput = document.getElementById("landing-input-id");
        const pinInput = document.getElementById("landing-input-pin");
        const statusBox = document.getElementById("landing-status-box");

        if (landingGate) landingGate.classList.remove("hidden");
        if (onboardingWizard) onboardingWizard.classList.add("hidden");
        if (appMain) appMain.classList.add("hidden");
        if (bottomNav) bottomNav.classList.add("hidden");
        if (statusBox) statusBox.classList.add("hidden");

        const syncInfo = FirebaseSyncService.getActiveSyncInfo();
        if (syncInfo.nickname) {
            if (idInput) idInput.value = syncInfo.nickname;
            if (pinInput) pinInput.value = "";
        } else {
            if (idInput) idInput.value = "";
            if (pinInput) pinInput.value = "";
        }
    }

    setLandingStatus(message, type = "info") {
        const box = document.getElementById("landing-status-box");
        if (!box) return;
        if (!message) {
            box.classList.add("hidden");
            return;
        }
        box.textContent = message;
        box.className = `landing-status-box ${type}`;
    }

    async handleLandingAuthSubmit() {
        const idInput = document.getElementById("landing-input-id");
        const pinInput = document.getElementById("landing-input-pin");
        const submitBtn = document.getElementById("btn-landing-submit");

        const userId = idInput ? idInput.value.trim() : "";
        const pin = pinInput ? pinInput.value.trim() : "";

        if (!userId || pin.length < 4) {
            this.setLandingStatus("아이디와 4자리 이상의 PIN 번호를 입력해주세요.", "error");
            return;
        }

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = "접속 중...";
        }
        this.setLandingStatus("", "info");

        try {
            const res = await FirebaseSyncService.authenticateWithCloud(userId, pin);
            this.setLandingStatus("", "info");

            const currentRecords = GymRatStorage.getWeightRecords();
            const currentProfile = GymRatStorage.getProfile();

            // 체성분 로그가 0건이고 온보딩을 완료하지 않은 신규 계정이면 맞춤 설계 질문 리스트 실행
            if (currentRecords.length === 0 && !currentProfile.onboardingCompleted) {
                this.openOnboardingWizard(res.nickname);
                this.showToast(
                    `[${res.nickname}] 신규 계정입니다. 맞춤 목표 및 추천 기간 설정 질문지를 작성해주세요.`
                );
            } else {
                this.enterMainDashboard();
                this.showToast(
                    `[${res.nickname}] 로그인 완료 (저장된 체성분 기록 ${res.recordsCount}건 불러옴)`
                );
            }
        } catch (err) {
            this.setLandingStatus(
                `접속 오류: ${err.message || "인터넷 연결을 확인한 뒤 다시 시도해주세요."}`,
                "error"
            );
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = "시작하기";
            }
        }
    }

    enterMainDashboard() {
        const landingGate = document.getElementById("screen-landing-gate");
        const onboardingWizard = document.getElementById("screen-onboarding-wizard");
        const appMain = document.getElementById("app-main");
        const bottomNav = document.getElementById("app-bottom-nav");

        if (landingGate) landingGate.classList.add("hidden");
        if (onboardingWizard) onboardingWizard.classList.add("hidden");
        if (appMain) appMain.classList.remove("hidden");
        if (bottomNav) bottomNav.classList.remove("hidden");

        this.renderAll();
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    /**
     * 신규 계정 온보딩 질문 리스트 (1문 1화면 단계별 진행)
     * & 식품군 확장/직접 음식 입력 평균 칼로리 계산 & 논문 근거 목표 일수 시뮬레이터
     */
    bindOnboardingWizardEvents() {
        // 단계별 이동 버튼 (다음 질문으로 / 이전 질문 / 상단 탭 클릭)
        const navMap = [
            { id: "btn-onboard-next-1", targetStep: 2 },
            { id: "btn-onboard-prev-2", targetStep: 1 },
            { id: "btn-onboard-next-2", targetStep: 3 },
            { id: "btn-onboard-prev-3", targetStep: 2 },
            { id: "btn-onboard-next-3", targetStep: 4 },
            { id: "btn-onboard-prev-4", targetStep: 3 },
            { id: "btn-onboard-next-4", targetStep: 5 },
            { id: "btn-onboard-prev-5", targetStep: 4 }
        ];

        navMap.forEach(({ id, targetStep }) => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.addEventListener("click", () => {
                    this.goToOnboardingStep(targetStep);
                });
            }
        });

        document.querySelectorAll("[data-step-jump]").forEach(btn => {
            btn.addEventListener("click", () => {
                const step = parseInt(btn.getAttribute("data-step-jump"), 10);
                if (step >= 1 && step <= 5) {
                    this.goToOnboardingStep(step);
                }
            });
        });

        const autoEstimateBtn = document.getElementById("btn-onboard-auto-estimate");
        if (autoEstimateBtn) {
            autoEstimateBtn.addEventListener("click", () => {
                const gender = document.getElementById("onboard-gender").value || "MALE";
                const age = parseInt(document.getElementById("onboard-age").value, 10) || 32;
                const heightCm = parseFloat(document.getElementById("onboard-height").value) || 175;
                const weightKg = parseFloat(document.getElementById("onboard-current-weight").value) || 80;
                const est = SafeWeightLossCalculator.estimateBodyComposition({
                    gender,
                    age,
                    heightCm,
                    weightKg
                });
                document.getElementById("onboard-current-muscle").value = est.skeletalMuscleMassKg.toFixed(1);
                document.getElementById("onboard-current-fat-pct").value = est.bodyFatPercentage.toFixed(1);
                this.applyOnboardingRecommendedTargets(true);
                this.showToast(
                    `성별·키·체중 기반으로 추정 골격근량(${est.skeletalMuscleMassKg}kg)과 체지방률(${est.bodyFatPercentage}%)이 자동 입력되었습니다.`
                );
            });
        }

        const resetRecTargetsBtn = document.getElementById("btn-onboard-recommend-targets");
        if (resetRecTargetsBtn) {
            resetRecTargetsBtn.addEventListener("click", () => {
                this.applyOnboardingRecommendedTargets(true);
                this.showToast("현재 신체 스펙과 프로그램 목적에 맞는 안전 추천 목표치 및 권장 일수로 초기화되었습니다.");
            });
        }

        // 신체 스펙 및 목적 변경 시 추천 목표치 + 권장 일수 자동 갱신
        [
            "onboard-gender",
            "onboard-age",
            "onboard-height",
            "onboard-current-weight",
            "onboard-current-muscle",
            "onboard-current-fat-pct",
            "onboard-program-goal",
            "onboard-experience"
        ].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener("change", () => this.applyOnboardingRecommendedTargets(true));
                el.addEventListener("input", () => this.applyOnboardingRecommendedTargets(true));
            }
        });

        // 운동 횟수·강도·직업군 변경 시 TDEE 및 시뮬레이션 실시간 갱신
        [
            "onboard-workout-days",
            "onboard-workout-intensity",
            "onboard-occupation",
            "onboard-posture",
            "onboard-work-hours"
        ].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener("change", () => this.updateOnboardingSimulation(false));
                el.addEventListener("input", () => this.updateOnboardingSimulation(false));
            }
        });

        // 질문 4 (평소 식습관): 끼니 추가 버튼 이벤트
        const btnAddMeal = document.getElementById("btn-add-onboard-meal");
        if (btnAddMeal) {
            btnAddMeal.addEventListener("click", () => {
                this.handleAddOnboardMealSlot();
            });
        }

        // 목표 체중·골격근·체지방률을 사용자가 직접 수정하면 해당 목표에 맞는 권장 일수로 재계산
        [
            "onboard-target-weight",
            "onboard-target-muscle",
            "onboard-target-fat-pct"
        ].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener("input", () => this.updateOnboardingSimulation(true));
                el.addEventListener("change", () => this.updateOnboardingSimulation(true));
            }
        });

        // 기간 슬라이더 및 직접 입력 이벤트
        const sliderEl = document.getElementById("onboard-duration-slider");
        const numInputEl = document.getElementById("onboard-duration-input");

        if (sliderEl) {
            sliderEl.addEventListener("input", () => {
                const days = parseInt(sliderEl.value, 10) || 56;
                if (numInputEl) numInputEl.value = days;
                this.updateOnboardingSimulation(false);
            });
        }

        if (numInputEl) {
            numInputEl.addEventListener("input", () => {
                const raw = parseInt(numInputEl.value, 10);
                if (!isNaN(raw)) {
                    const clamped = Math.max(14, Math.min(365, raw));
                    if (sliderEl) sliderEl.value = clamped;
                    this.updateOnboardingSimulation(false);
                }
            });
            numInputEl.addEventListener("change", () => {
                const raw = parseInt(numInputEl.value, 10) || 56;
                const clamped = Math.max(14, Math.min(365, raw));
                numInputEl.value = clamped;
                if (sliderEl) sliderEl.value = clamped;
                this.updateOnboardingSimulation(false);
            });
        }

        // 앞당기기 / 늘리기 퀵 버튼 이벤트
        const stepDays = delta => {
            const current = parseInt(document.getElementById("onboard-duration-input").value, 10) || this.onboardRecommendedDays || 56;
            const next = Math.max(14, Math.min(365, current + delta));
            document.getElementById("onboard-duration-input").value = next;
            document.getElementById("onboard-duration-slider").value = next;
            this.updateOnboardingSimulation(false);
        };

        const btnMinus14 = document.getElementById("btn-days-minus-14");
        const btnMinus7 = document.getElementById("btn-days-minus-7");
        const btnResetRec = document.getElementById("btn-days-reset-rec");
        const btnPlus7 = document.getElementById("btn-days-plus-7");
        const btnPlus14 = document.getElementById("btn-days-plus-14");

        const btnPaceStandard = document.getElementById("btn-pace-standard");
        const btnPaceAccelerated = document.getElementById("btn-pace-accelerated");
        const btnPaceGentle = document.getElementById("btn-pace-gentle");

        const setPaceDays = (days) => {
            if (!days || days <= 0) return;
            const inputEl = document.getElementById("onboard-duration-input");
            const sliderEl = document.getElementById("onboard-duration-slider");
            if (inputEl) inputEl.value = days;
            if (sliderEl) sliderEl.value = days;
            this.updateOnboardingSimulation(false);
        };

        if (btnPaceStandard) {
            btnPaceStandard.addEventListener("click", () => {
                const evalObj = this.latestOnboardingEvaluation;
                setPaceDays(evalObj ? evalObj.standardDays : this.onboardRecommendedDays);
            });
        }
        if (btnPaceAccelerated) {
            btnPaceAccelerated.addEventListener("click", () => {
                const evalObj = this.latestOnboardingEvaluation;
                setPaceDays(evalObj ? evalObj.acceleratedDays : Math.round((this.onboardRecommendedDays || 56) * 0.65));
            });
        }
        if (btnPaceGentle) {
            btnPaceGentle.addEventListener("click", () => {
                const evalObj = this.latestOnboardingEvaluation;
                setPaceDays(evalObj ? evalObj.gentleDays : Math.round((this.onboardRecommendedDays || 56) * 1.5));
            });
        }

        if (btnMinus14) btnMinus14.addEventListener("click", () => stepDays(-14));
        if (btnMinus7) btnMinus7.addEventListener("click", () => stepDays(-7));
        if (btnResetRec) {
            btnResetRec.addEventListener("click", () => {
                const rec = this.onboardRecommendedDays || 56;
                document.getElementById("onboard-duration-input").value = rec;
                document.getElementById("onboard-duration-slider").value = rec;
                this.updateOnboardingSimulation(false);
            });
        }
        if (btnPlus7) btnPlus7.addEventListener("click", () => stepDays(7));
        if (btnPlus14) btnPlus14.addEventListener("click", () => stepDays(14));

        const submitBtn = document.getElementById("btn-onboard-submit");
        if (submitBtn) {
            submitBtn.addEventListener("click", e => {
                e.preventDefault();
                this.handleCompleteOnboarding();
            });
        }

        const onboardForm = document.getElementById("form-onboarding-wizard");
        if (onboardForm) {
            onboardForm.addEventListener("submit", e => {
                e.preventDefault();
                if (this.currentOnboardingStep && this.currentOnboardingStep < 5) {
                    this.goToOnboardingStep(this.currentOnboardingStep + 1);
                    return;
                }
                this.handleCompleteOnboarding();
            });
        }
    }

    goToOnboardingStep(stepNumber) {
        const clampedStep = Math.max(1, Math.min(5, Number(stepNumber) || 1));
        this.currentOnboardingStep = clampedStep;

        const stepTitles = {
            1: "질문 1 / 5 · 나이 · 성별 · 키 · 현재 체성분",
            2: "질문 2 / 5 · 운동 목적 및 주간 운동 횟수·강도",
            3: "질문 3 / 5 · 직업군 및 하루 근무 환경 (소모 칼로리 산출)",
            4: "질문 4 / 5 · 평소 식습관 구성 및 음식 평균 칼로리 계산 (2~5끼 자유 설정)",
            5: "질문 5 / 5 · 추천 목표 및 도달 일수 설정 (앞당기기/늘리기 논문 분석)"
        };

        for (let i = 1; i <= 5; i++) {
            const cardEl = document.getElementById(`onboard-step-${i}`);
            if (cardEl) {
                if (i === clampedStep) {
                    cardEl.classList.remove("hidden");
                } else {
                    cardEl.classList.add("hidden");
                }
            }
        }

        const pct = clampedStep * 20;
        const indTextEl = document.getElementById("onboard-step-indicator-text");
        const pctTextEl = document.getElementById("onboard-step-pct-text");
        const barEl = document.getElementById("onboard-step-progress-bar");

        if (indTextEl) indTextEl.textContent = stepTitles[clampedStep];
        if (pctTextEl) pctTextEl.textContent = `${pct}% 진행`;
        if (barEl) barEl.style.width = `${pct}%`;

        document.querySelectorAll("[data-step-jump]").forEach(btn => {
            const s = parseInt(btn.getAttribute("data-step-jump"), 10);
            btn.classList.remove("active", "completed");
            if (s === clampedStep) {
                btn.classList.add("active");
            } else if (s < clampedStep) {
                btn.classList.add("completed");
            }
        });

        this.updateOnboardingSimulation(false);
        this.updateOnboardingStep4DietSummary();
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    initDefaultOnboardMeals() {
        this.onboardMeals = [
            {
                id: "meal_bf",
                name: "아침 식사",
                category: "BREAKFAST",
                presetCode: "BF_EGG3_APPLE1_SHAKE",
                directText: "계란 3개, 사과 1개, 단백질 쉐이크 1스쿱",
                kcal: 480,
                pro: 40,
                hint: "삶은/훈제 계란 3알 + 사과 1개 + 단백질 쉐이크 (480 kcal / 단백질 40g)"
            },
            {
                id: "meal_lc",
                name: "점심 식사",
                category: "LUNCH",
                presetCode: "LC_CAFETERIA_SEOLLEONGTANG",
                directText: "구내식당 설렁탕 1그릇",
                kcal: 1100,
                pro: 32,
                hint: "구내식당 설렁탕·곰탕·국밥류 정식 (1,100 kcal / 단백질 32g)"
            },
            {
                id: "meal_dn",
                name: "저녁 식사",
                category: "DINNER",
                presetCode: "LC_DIET_BOX_SALAD",
                directText: "닭가슴살 200g + 밥 200g + 김치",
                kcal: 543,
                pro: 54,
                hint: "닭가슴살 200g(240kcal, 단백질 48g) + 쌀밥 200g(285kcal, 단백질 5g) + 김치 1회(18kcal, 단백질 1g)"
            },
            {
                id: "meal_dr",
                name: "고정 음료 / 간식",
                category: "DRINK",
                presetCode: "DR_GS25_BARISTA_174",
                directText: "GS25 바리스타 커피",
                kcal: 174,
                pro: 5,
                hint: "편의점 바리스타 커피 (174 kcal / 단백질 5g)"
            }
        ];
    }

    renderOnboardingMealSlots() {
        const container = document.getElementById("onboard-meal-slots-container");
        if (!container) return;

        if (!this.onboardMeals || this.onboardMeals.length === 0) {
            this.initDefaultOnboardMeals();
        }

        const buildPresetOptions = currentCode => {
            let html = '<option value="">(프리셋 선택 또는 아래에 직접 음식 수기 입력)</option>';
            html += '<optgroup label="아침 식사 대표 프리셋">';
            HabitMealCatalog.BREAKFAST_PRESETS.forEach(p => {
                const sel = p.code === currentCode ? " selected" : "";
                html += `<option value="${p.code}" data-kcal="${p.caloriesKcal}" data-pro="${p.proteinG}" data-detail="${p.detail}"${sel}>${p.label} (${p.caloriesKcal}kcal, 단백질 ${p.proteinG}g)</option>`;
            });
            html += '</optgroup>';
            html += '<optgroup label="점심·저녁 일반 식사 대표 프리셋">';
            HabitMealCatalog.LUNCH_MAIN_PRESETS.forEach(p => {
                const sel = p.code === currentCode ? " selected" : "";
                html += `<option value="${p.code}" data-kcal="${p.caloriesKcal}" data-pro="${p.proteinG}" data-detail="${p.detail}"${sel}>${p.label} (${p.caloriesKcal.toLocaleString()}kcal, 단백질 ${p.proteinG}g)</option>`;
            });
            html += '</optgroup>';
            html += '<optgroup label="음료·단백질·간식 대표 프리셋">';
            HabitMealCatalog.FIXED_DRINK_PRESETS.forEach(p => {
                const sel = p.code === currentCode ? " selected" : "";
                html += `<option value="${p.code}" data-kcal="${p.caloriesKcal}" data-pro="${p.proteinG}" data-detail="${p.detail}"${sel}>${p.label} (${p.caloriesKcal}kcal, 단백질 ${p.proteinG}g)</option>`;
            });
            html += '</optgroup>';
            return html;
        };

        container.innerHTML = this.onboardMeals
            .map((meal, idx) => {
                const canDelete = this.onboardMeals.length > 1;
                return `
                <div class="meal-builder-block" data-meal-idx="${idx}" style="margin-bottom: 14px; background: rgba(33, 38, 45, 0.7); border: 1px solid var(--border-subtle); border-radius: 12px; padding: 12px 14px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span class="status-badge badge-blue" style="font-size: 11px; padding: 2px 7px;">${idx + 1}번째 끼니</span>
                            <input type="text" class="form-input js-onboard-meal-name" data-meal-idx="${idx}" value="${meal.name}" style="font-weight: 800; font-size: 13.5px; width: 170px; padding: 4px 8px;" />
                        </div>
                        ${canDelete ? `<button type="button" class="btn-text-delete js-delete-onboard-meal" data-meal-idx="${idx}" style="color: var(--neon-orange); font-size: 12px; cursor: pointer; background: none; border: none;">이 끼니 삭제</button>` : ""}
                    </div>

                    <div class="form-group" style="margin-bottom: 8px;">
                        <label style="font-size: 11.5px; color: var(--text-secondary);">식품군별 대표 메뉴 프리셋 선택</label>
                        <select class="form-input js-onboard-meal-preset" data-meal-idx="${idx}">
                            ${buildPresetOptions(meal.presetCode)}
                        </select>
                    </div>

                    <div class="direct-food-calc-row" style="display: flex; gap: 6px; margin-bottom: 6px;">
                        <input
                            type="text"
                            class="form-input js-onboard-meal-direct"
                            data-meal-idx="${idx}"
                            placeholder="직접 수기 입력 (예: 계란후라이 + 공기밥 + 김치 + 스팸 3조각 / 닭가슴살 200g)"
                            value="${meal.directText || ""}"
                            style="flex: 1;"
                        />
                        <button type="button" class="btn-outline-lime btn-calc-food js-btn-calc-meal" data-meal-idx="${idx}" style="white-space: nowrap; font-size: 11.5px; padding: 6px 12px;">
                            평균 칼로리 자동 계산
                        </button>
                    </div>
                    <p class="food-breakdown-hint js-onboard-meal-hint" data-meal-idx="${idx}" style="font-size: 11px; color: var(--text-secondary); margin-bottom: 8px; line-height: 1.4;">
                        ${meal.hint || "음식을 직접 적고 [평균 칼로리 자동 계산]을 누르면 그램(g)·조각 단위가 자동 계산됩니다."}
                    </p>

                    <div class="form-row-2" style="margin-top: 8px;">
                        <div class="form-group" style="margin-bottom: 0;">
                            <label style="font-size: 11.5px;">섭취 칼로리 (kcal)</label>
                            <input type="number" class="form-input js-onboard-meal-kcal" data-meal-idx="${idx}" min="0" max="4000" step="5" value="${meal.kcal}" />
                        </div>
                        <div class="form-group" style="margin-bottom: 0;">
                            <label style="font-size: 11.5px;">섭취 단백질 (g)</label>
                            <input type="number" class="form-input js-onboard-meal-pro" data-meal-idx="${idx}" min="0" max="250" step="1" value="${meal.pro}" />
                        </div>
                    </div>
                </div>
            `;
            })
            .join("");

        // 이벤트 바인딩
        container.querySelectorAll(".js-onboard-meal-name").forEach(inp => {
            inp.addEventListener("input", e => {
                const idx = parseInt(e.target.getAttribute("data-meal-idx"), 10);
                if (this.onboardMeals[idx]) this.onboardMeals[idx].name = e.target.value.trim() || `${idx + 1}번째 식사`;
            });
        });

        container.querySelectorAll(".js-onboard-meal-preset").forEach(sel => {
            sel.addEventListener("change", e => {
                const idx = parseInt(e.target.getAttribute("data-meal-idx"), 10);
                const opt = sel.selectedOptions[0];
                if (!opt || !this.onboardMeals[idx]) return;
                const code = opt.value;
                this.onboardMeals[idx].presetCode = code;
                if (code) {
                    const kcal = parseInt(opt.getAttribute("data-kcal"), 10) || 0;
                    const pro = parseInt(opt.getAttribute("data-pro"), 10) || 0;
                    const detail = opt.getAttribute("data-detail") || "";
                    this.onboardMeals[idx].kcal = kcal;
                    this.onboardMeals[idx].pro = pro;
                    this.onboardMeals[idx].hint = `${detail} -> ${kcal.toLocaleString()} kcal / 단백질 ${pro}g`;
                    const block = container.querySelector(`.meal-builder-block[data-meal-idx="${idx}"]`);
                    if (block) {
                        block.querySelector(".js-onboard-meal-kcal").value = kcal;
                        block.querySelector(".js-onboard-meal-pro").value = pro;
                        block.querySelector(".js-onboard-meal-hint").textContent = this.onboardMeals[idx].hint;
                    }
                }
                this.updateOnboardingStep4DietSummary();
            });
        });

        const runMealCalc = idx => {
            const block = container.querySelector(`.meal-builder-block[data-meal-idx="${idx}"]`);
            if (!block || !this.onboardMeals[idx]) return;
            const directInp = block.querySelector(".js-onboard-meal-direct");
            const text = directInp ? directInp.value.trim() : "";
            if (!text) {
                this.showToast("평균 칼로리를 계산할 음식 이름을 입력해주세요. (예: 닭가슴살 200g / 계란후라이 + 공기밥 + 김치 + 스팸 3조각)");
                return;
            }
            const est = SmartFoodCalorieEstimator.estimateFromText(text, "LUNCH");
            if (!est) {
                this.showToast("입력한 음식의 영양 정보를 추정할 수 없습니다. 다시 입력해주세요.");
                return;
            }
            this.onboardMeals[idx].directText = text;
            this.onboardMeals[idx].kcal = est.caloriesKcal;
            this.onboardMeals[idx].pro = est.proteinG;
            this.onboardMeals[idx].hint = `자동 계산 내역: ${est.breakdownText} -> 총 ${est.caloriesKcal.toLocaleString()} kcal / 단백질 ${est.proteinG}g (탄수 ${est.carbsG}g · 지방 ${est.fatG}g)`;
            block.querySelector(".js-onboard-meal-kcal").value = est.caloriesKcal;
            block.querySelector(".js-onboard-meal-pro").value = est.proteinG;
            block.querySelector(".js-onboard-meal-hint").textContent = this.onboardMeals[idx].hint;
            this.updateOnboardingStep4DietSummary();
            this.showToast(`${est.breakdownText} -> 총 ${est.caloriesKcal.toLocaleString()} kcal (단백질 ${est.proteinG}g) 자동 계산 완료`);
        };

        container.querySelectorAll(".js-btn-calc-meal").forEach(btn => {
            btn.addEventListener("click", () => {
                const idx = parseInt(btn.getAttribute("data-meal-idx"), 10);
                runMealCalc(idx);
            });
        });

        container.querySelectorAll(".js-onboard-meal-direct").forEach(inp => {
            inp.addEventListener("keydown", e => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    const idx = parseInt(inp.getAttribute("data-meal-idx"), 10);
                    runMealCalc(idx);
                }
            });
            inp.addEventListener("input", e => {
                const idx = parseInt(inp.getAttribute("data-meal-idx"), 10);
                if (this.onboardMeals[idx]) this.onboardMeals[idx].directText = e.target.value;
            });
        });

        container.querySelectorAll(".js-onboard-meal-kcal").forEach(inp => {
            inp.addEventListener("input", e => {
                const idx = parseInt(inp.getAttribute("data-meal-idx"), 10);
                if (this.onboardMeals[idx]) {
                    this.onboardMeals[idx].kcal = parseInt(e.target.value, 10) || 0;
                    this.updateOnboardingStep4DietSummary();
                }
            });
        });

        container.querySelectorAll(".js-onboard-meal-pro").forEach(inp => {
            inp.addEventListener("input", e => {
                const idx = parseInt(inp.getAttribute("data-meal-idx"), 10);
                if (this.onboardMeals[idx]) {
                    this.onboardMeals[idx].pro = parseInt(e.target.value, 10) || 0;
                    this.updateOnboardingStep4DietSummary();
                }
            });
        });

        container.querySelectorAll(".js-delete-onboard-meal").forEach(btn => {
            btn.addEventListener("click", () => {
                const idx = parseInt(btn.getAttribute("data-meal-idx"), 10);
                if (this.onboardMeals.length <= 1) {
                    this.showToast("최소 1개 이상의 끼니가 필요합니다.");
                    return;
                }
                const deletedName = this.onboardMeals[idx].name;
                this.onboardMeals.splice(idx, 1);
                this.renderOnboardingMealSlots();
                this.updateOnboardingStep4DietSummary();
                this.showToast(`${deletedName} 끼니가 삭제되었습니다. (현재 총 ${this.onboardMeals.length}끼 설정)`);
            });
        });
    }

    handleAddOnboardMealSlot() {
        if (!this.onboardMeals) this.initDefaultOnboardMeals();
        const nextIdx = this.onboardMeals.length + 1;
        this.onboardMeals.push({
            id: `meal_${Date.now()}`,
            name: `${nextIdx}번째 식사 (보충/간식)`,
            category: "EXTRA",
            presetCode: "",
            directText: "",
            kcal: 350,
            pro: 25,
            hint: "음식을 직접 수기로 입력하고 [평균 칼로리 자동 계산]을 누르세요."
        });
        this.renderOnboardingMealSlots();
        this.updateOnboardingStep4DietSummary();
        this.showToast(`${nextIdx}번째 끼니가 추가되었습니다. (총 ${this.onboardMeals.length}끼 설정 중)`);
    }

    updateOnboardingStep4DietSummary() {
        if (!this.onboardMeals || this.onboardMeals.length === 0) return;

        const totalKcal = this.onboardMeals.reduce((sum, m) => sum + (Number(m.kcal) || 0), 0);
        const totalPro = this.onboardMeals.reduce((sum, m) => sum + (Number(m.pro) || 0), 0);

        const evalRes = this.latestOnboardingEvaluation;
        const targetKcal = evalRes ? evalRes.recommendedDailyCalories : 2200;
        const targetPro = evalRes ? evalRes.recommendedProteinG : 150;
        const deltaKcal = totalKcal - targetKcal;
        const remainPro = Math.max(0, targetPro - totalPro);

        const summaryBox = document.getElementById("onboard-step4-diet-summary");
        if (summaryBox) {
            const mealsListText = this.onboardMeals
                .map(m => `<b>${m.name}</b>: ${Number(m.kcal).toLocaleString()}kcal(${m.pro}g)`)
                .join(" · ");
            summaryBox.innerHTML = `
                <div class="tdee-preview-header">
                    <strong class="text-lime">설정된 총 ${this.onboardMeals.length}끼 식단 섭취 합계: ${totalKcal.toLocaleString()} kcal (단백질 ${totalPro}g)</strong>
                </div>
                <p class="tdee-preview-sub">
                    ${mealsListText}<br/>
                    설계된 일일 권장 목표 칼로리(<b>${targetKcal.toLocaleString()} kcal</b>) 대비
                    ${deltaKcal > 0
                        ? `<strong class="text-warning">+${deltaKcal.toLocaleString()} kcal 초과</strong>`
                        : `<strong class="text-blue">${Math.abs(deltaKcal).toLocaleString()} kcal 여유</strong>`}
                    (필수 단백질 목표 <b>${targetPro}g</b> 기준 ${totalPro >= targetPro ? '<strong class="text-lime">단백질 충족 달성</strong>' : `추가 필요 단백질 <strong class="text-orange">${remainPro}g</strong>`})
                </p>
            `;
        }
    }

    openOnboardingWizard(nickname = "") {
        const landingGate = document.getElementById("screen-landing-gate");
        const onboardingWizard = document.getElementById("screen-onboarding-wizard");
        const appMain = document.getElementById("app-main");
        const bottomNav = document.getElementById("app-bottom-nav");

        if (landingGate) landingGate.classList.add("hidden");
        if (appMain) appMain.classList.add("hidden");
        if (bottomNav) bottomNav.classList.add("hidden");
        if (onboardingWizard) onboardingWizard.classList.remove("hidden");

        const subEl = document.getElementById("onboard-account-subtitle");
        if (subEl) {
            const label = nickname ? `[계정: ${nickname}] ` : "";
            subEl.textContent = `${label}질문 1번부터 5번까지 차례대로 답변하시면 신체 스펙·목적·식습관에 맞춘 최적 목표와 추천 일수를 산출합니다.`;
        }

        // 식습관 끼니 초기화 및 렌더링
        this.initDefaultOnboardMeals();
        this.renderOnboardingMealSlots();
        this.updateOnboardingStep4DietSummary();

        const profile = GymRatStorage.getProfile();
        const records = GymRatStorage.getWeightRecords();
        const latestRec = records.length > 0 ? records[records.length - 1] : null;

        document.getElementById("onboard-gender").value = profile.gender || "MALE";
        document.getElementById("onboard-age").value = profile.age || 32;
        document.getElementById("onboard-height").value = profile.heightCm || 175;

        if (latestRec) {
            document.getElementById("onboard-current-weight").value = Number(latestRec.weightKg).toFixed(1);
            document.getElementById("onboard-current-muscle").value = Number(latestRec.skeletalMuscleMassKg).toFixed(1);
            document.getElementById("onboard-current-fat-pct").value = Number(latestRec.bodyFatPercentage).toFixed(1);
        } else {
            const defaultW = 82.0;
            const est = SafeWeightLossCalculator.estimateBodyComposition({
                gender: profile.gender || "MALE",
                age: profile.age || 32,
                heightCm: profile.heightCm || 175,
                weightKg: defaultW
            });
            document.getElementById("onboard-current-weight").value = defaultW.toFixed(1);
            document.getElementById("onboard-current-muscle").value = est.skeletalMuscleMassKg.toFixed(1);
            document.getElementById("onboard-current-fat-pct").value = est.bodyFatPercentage.toFixed(1);
        }

        document.getElementById("onboard-program-goal").value = profile.programGoalType || "DIET";
        document.getElementById("onboard-workout-days").value = profile.weeklyWorkoutTargetDays ?? 4;
        document.getElementById("onboard-workout-intensity").value = profile.workoutIntensityCode || "MODERATE_HYPERTROPHY";
        document.getElementById("onboard-experience").value = profile.trainingExperienceCode || "INTERMEDIATE";
        document.getElementById("onboard-occupation").value = profile.occupationCode || "OFFICE_IT";
        document.getElementById("onboard-posture").value = profile.workPostureCode || "MOSTLY_SITTING";
        document.getElementById("onboard-work-hours").value = profile.dailyWorkHours ?? 8;

        if (profile.onboardingCompleted && records.length > 0) {
            document.getElementById("onboard-target-weight").value = Number(profile.targetWeightKg).toFixed(1);
            document.getElementById("onboard-target-muscle").value = Number(profile.minTargetSkeletalMuscleKg).toFixed(1);
            document.getElementById("onboard-target-fat-pct").value = Number(profile.targetBodyFatPercent).toFixed(1);
            if (profile.customTargetDurationDays) {
                document.getElementById("onboard-duration-input").value = profile.customTargetDurationDays;
                document.getElementById("onboard-duration-slider").value = profile.customTargetDurationDays;
                this.updateOnboardingSimulation(false);
            } else {
                this.updateOnboardingSimulation(true);
            }
        } else {
            this.applyOnboardingRecommendedTargets(true);
        }

        // 항상 첫 번째 질문(1/5) 화면부터 시작
        this.goToOnboardingStep(1);
    }

    applyOnboardingRecommendedTargets(resetDaysToRecommended = true) {
        const gender = document.getElementById("onboard-gender").value || "MALE";
        const heightCm = parseFloat(document.getElementById("onboard-height").value) || 175;
        const currentWeightKg = parseFloat(document.getElementById("onboard-current-weight").value) || 82;
        const currentMuscleKg = parseFloat(document.getElementById("onboard-current-muscle").value) || 34.5;
        const currentFatPercent = parseFloat(document.getElementById("onboard-current-fat-pct").value) || 23.5;
        const programGoalType = document.getElementById("onboard-program-goal").value || "DIET";
        const trainingExperienceCode = document.getElementById("onboard-experience").value || "INTERMEDIATE";

        const recTargets = SafeWeightLossCalculator.recommendTargetsFromCurrent({
            gender,
            heightCm,
            currentWeightKg,
            currentMuscleKg,
            currentFatPercent,
            programGoalType,
            trainingExperienceCode
        });

        document.getElementById("onboard-target-weight").value = recTargets.targetWeightKg.toFixed(1);
        document.getElementById("onboard-target-muscle").value = recTargets.minTargetSkeletalMuscleKg.toFixed(1);
        document.getElementById("onboard-target-fat-pct").value = recTargets.targetBodyFatPercent.toFixed(1);

        this.updateOnboardingSimulation(resetDaysToRecommended);
    }

    updateOnboardingSimulation(resetDaysToRecommended = false) {
        const gender = document.getElementById("onboard-gender").value || "MALE";
        const age = parseInt(document.getElementById("onboard-age").value, 10) || 32;
        const heightCm = parseFloat(document.getElementById("onboard-height").value) || 175;
        const currentWeightKg = parseFloat(document.getElementById("onboard-current-weight").value) || 82;
        const currentMuscleKg = parseFloat(document.getElementById("onboard-current-muscle").value) || 34.5;
        const currentFatPercent = parseFloat(document.getElementById("onboard-current-fat-pct").value) || 23.5;

        const programGoalType = document.getElementById("onboard-program-goal").value || "DIET";
        const weeklyWorkoutSessions = parseInt(document.getElementById("onboard-workout-days").value, 10) || 4;
        const workoutIntensityCode = document.getElementById("onboard-workout-intensity").value || "MODERATE_HYPERTROPHY";
        const trainingExperienceCode = document.getElementById("onboard-experience").value || "INTERMEDIATE";
        const occupationCode = document.getElementById("onboard-occupation").value || "OFFICE_IT";
        const workPostureCode = document.getElementById("onboard-posture").value || "MOSTLY_SITTING";
        const dailyWorkHours = parseFloat(document.getElementById("onboard-work-hours").value) || 8;

        const targetWeightKg = parseFloat(document.getElementById("onboard-target-weight").value) || currentWeightKg;
        const targetMuscleKg = parseFloat(document.getElementById("onboard-target-muscle").value) || currentMuscleKg;
        const targetFatPercent = parseFloat(document.getElementById("onboard-target-fat-pct").value) || currentFatPercent;

        const tdeeObj = SafeWeightLossCalculator.computeOccupationalTdee({
            gender,
            age,
            heightCm,
            weightKg: currentWeightKg,
            fatPercent: currentFatPercent,
            occupationCode,
            workPostureCode,
            dailyWorkHours,
            weeklyWorkDays: 5,
            weeklyWorkoutSessions,
            workoutIntensityCode,
            recommendedDailyDeficitKcal: 500
        });

        // 질문 3 화면의 실시간 TDEE 프리뷰 박스 업데이트
        const step3Box = document.getElementById("onboard-step3-tdee-box");
        if (step3Box) {
            step3Box.innerHTML = `
                <div class="tdee-preview-header">
                    <strong class="text-lime">산출된 일평균 총 소모 칼로리(TDEE): 약 ${tdeeObj.estimatedDailyTdeeKcal.toLocaleString()} kcal/일</strong>
                </div>
                <p class="tdee-preview-sub">
                    기초대사량(BMR) <b>${tdeeObj.bmrKcal.toLocaleString()} kcal</b> + 근무 중 활동대사량(일평균) <b>${tdeeObj.avgDailyWorkNeatKcal.toLocaleString()} kcal</b> + 운동·일상·소화 대사량 <b>${(tdeeObj.nonWorkNeatKcal + tdeeObj.avgDailyExerciseKcal + tdeeObj.tefKcal).toLocaleString()} kcal</b>
                </p>
            `;
        }

        // 1차 호출로 권장 일수(recommendedDays) 산출
        const initialEval = SafeWeightLossCalculator.evaluateDurationPlan({
            gender,
            age,
            heightCm,
            currentWeightKg,
            currentMuscleKg,
            currentFatPercent,
            targetWeightKg,
            targetMuscleKg,
            targetFatPercent,
            programGoalType,
            workoutIntensityCode,
            trainingExperienceCode,
            weeklyWorkoutSessions,
            occupationCode,
            workPostureCode,
            dailyWorkHours,
            selectedDurationDays: null
        });

        this.onboardRecommendedDays = initialEval.recommendedDays;

        const sliderEl = document.getElementById("onboard-duration-slider");
        const numInputEl = document.getElementById("onboard-duration-input");

        let selectedDays = initialEval.recommendedDays;
        if (resetDaysToRecommended) {
            selectedDays = initialEval.recommendedDays;
            if (sliderEl) sliderEl.value = selectedDays;
            if (numInputEl) numInputEl.value = selectedDays;
        } else {
            selectedDays = parseInt(numInputEl ? numInputEl.value : sliderEl.value, 10) || initialEval.recommendedDays;
        }

        // 선택된 일수로 정밀 논문 분석 수행
        const planEval = SafeWeightLossCalculator.evaluateDurationPlan({
            gender,
            age,
            heightCm,
            currentWeightKg,
            currentMuscleKg,
            currentFatPercent,
            targetWeightKg,
            targetMuscleKg,
            targetFatPercent,
            programGoalType,
            workoutIntensityCode,
            trainingExperienceCode,
            weeklyWorkoutSessions,
            occupationCode,
            workPostureCode,
            dailyWorkHours,
            selectedDurationDays: selectedDays
        });

        this.latestOnboardingEvaluation = planEval;

        if (sliderEl) {
            sliderEl.min = planEval.minAllowedDays;
            sliderEl.max = planEval.maxAllowedDays;
        }
        if (numInputEl) {
            numInputEl.min = planEval.minAllowedDays;
            numInputEl.max = planEval.maxAllowedDays;
        }

        const btnPaceStandardEl = document.getElementById("btn-pace-standard");
        const btnPaceAcceleratedEl = document.getElementById("btn-pace-accelerated");
        const btnPaceGentleEl = document.getElementById("btn-pace-gentle");

        if (btnPaceStandardEl) {
            btnPaceStandardEl.classList.toggle("active", Math.abs(planEval.selectedDays - planEval.standardDays) <= 3);
            btnPaceStandardEl.textContent = `표준 지속가능 (NCBI StatPearls · ${planEval.standardDays}일 / ${planEval.standardWeeklyRateKg}kg/주)`;
        }
        if (btnPaceAcceleratedEl) {
            btnPaceAcceleratedEl.classList.toggle("active", Math.abs(planEval.selectedDays - planEval.acceleratedDays) <= 3);
            btnPaceAcceleratedEl.textContent = `집중 가속 감량 (Purcell & ECO 임상 · ${planEval.acceleratedDays}일 / ${planEval.acceleratedWeeklyRateKg}kg/주)`;
        }
        if (btnPaceGentleEl) {
            btnPaceGentleEl.classList.toggle("active", Math.abs(planEval.selectedDays - planEval.gentleDays) <= 3);
            btnPaceGentleEl.textContent = `완만 근육방어 (Garthe & Helms · ${planEval.gentleDays}일 / ${planEval.gentleWeeklyRateKg}kg/주)`;
        }

        // UI 반영: 기간 및 추천일수 비교
        document.getElementById("onboard-selected-days-val").textContent =
            `${planEval.selectedDays}일 (${planEval.selectedWeeks}주)`;
        document.getElementById("onboard-rec-days-badge").textContent =
            `권장 표준: ${planEval.recommendedDays}일 (${planEval.recommendedWeeks}주)`;

        // 산출 공식 및 학술 논문 근거 배너 렌더링
        const formulaBox = document.getElementById("onboard-formula-evidence-box");
        if (formulaBox) {
            formulaBox.innerHTML = `
                <div class="tdee-preview-header">
                    <strong class="text-lime">과학적 기간 산출 공식: ${planEval.formulaText}</strong>
                </div>
                <p class="tdee-preview-sub">
                    ${planEval.scientificEvidenceText}
                </p>
            `;
        }

        const deltaEl = document.getElementById("onboard-delta-days-text");
        const resetBtn = document.getElementById("btn-days-reset-rec");
        if (planEval.daysDeltaFromRecommended < 0) {
            deltaEl.textContent = `권장 표준 기간보다 ${Math.abs(planEval.daysDeltaFromRecommended)}일 앞당김 (기간 단축 모드 · 주당 변화량 증가)`;
            deltaEl.className = "duration-delta-sub text-warning";
            if (resetBtn) resetBtn.classList.remove("active");
        } else if (planEval.daysDeltaFromRecommended > 0) {
            deltaEl.textContent = `권장 표준 기간보다 +${planEval.daysDeltaFromRecommended}일 늘림 (기간 연장 모드 · 근손실 방어 및 식단 여유 증가)`;
            deltaEl.className = "duration-delta-sub text-blue";
            if (resetBtn) resetBtn.classList.remove("active");
        } else {
            deltaEl.textContent = "스포츠 영양학 및 임상 메타분석 기준 가장 이상적인 권장 도달 일수입니다.";
            deltaEl.className = "duration-delta-sub text-lime";
            if (resetBtn) resetBtn.classList.add("active");
        }

        // KPI 요약 그리드 반영
        document.getElementById("onboard-kpi-tdee").textContent =
            `${tdeeObj.estimatedDailyTdeeKcal.toLocaleString()} kcal`;
        const weeklySign = planEval.selectedWeeklyChangeKg > 0 ? "+" : "";
        document.getElementById("onboard-kpi-weekly-rate").textContent =
            `${weeklySign}${planEval.selectedWeeklyChangeKg.toFixed(2)} kg/주`;
        document.getElementById("onboard-kpi-target-kcal").textContent =
            `${planEval.recommendedDailyCalories.toLocaleString()} kcal`;
        document.getElementById("onboard-kpi-target-protein").textContent =
            `${planEval.recommendedProteinG} g`;

        // 논문 근거 배지 및 요약문 반영
        const badgeEl = document.getElementById("onboard-pace-badge");
        badgeEl.textContent = planEval.paceStatusLabel;
        badgeEl.className = `status-badge ${planEval.paceBadgeClass}`;
        document.getElementById("onboard-pace-summary").textContent = planEval.paceSummaryText;

        // 장점 리스트 렌더링
        const prosContainer = document.getElementById("onboard-pros-list");
        prosContainer.innerHTML = planEval.prosList
            .map(
                item => `
            <div class="paper-evidence-item">
                <strong>${item.title}</strong>
                <p>${item.detail}</p>
                <span class="paper-citation-tag">근거 논문: ${item.citation}</span>
            </div>
        `
            )
            .join("");

        // 단점 리스트 렌더링
        const consContainer = document.getElementById("onboard-cons-list");
        consContainer.innerHTML = planEval.consList
            .map(
                item => `
            <div class="paper-evidence-item">
                <strong>${item.title}</strong>
                <p>${item.detail}</p>
                <span class="paper-citation-tag">근거 논문: ${item.citation}</span>
            </div>
        `
            )
            .join("");
    }

    handleCompleteOnboarding() {
        try {
            this.updateOnboardingSimulation(false);
            const evalRes =
                this.latestOnboardingEvaluation ||
                SafeWeightLossCalculator.evaluateDurationPlan({
                    currentWeightKg: parseFloat(document.getElementById("onboard-current-weight").value) || 82,
                    targetWeightKg: parseFloat(document.getElementById("onboard-target-weight").value) || 75
                });

            const gender = document.getElementById("onboard-gender").value || "MALE";
            const age = parseInt(document.getElementById("onboard-age").value, 10) || 32;
            const heightCm = parseFloat(document.getElementById("onboard-height").value) || 175;
            const currentWeightKg = parseFloat(document.getElementById("onboard-current-weight").value) || 82;
            const currentMuscleKg = parseFloat(document.getElementById("onboard-current-muscle").value) || 34.5;
            const currentFatPercent = parseFloat(document.getElementById("onboard-current-fat-pct").value) || 23.5;

            const programGoalType = document.getElementById("onboard-program-goal").value || "DIET";
            const weeklyWorkoutTargetDays = parseInt(document.getElementById("onboard-workout-days").value, 10) || 4;
            const workoutIntensityCode = document.getElementById("onboard-workout-intensity").value || "MODERATE_HYPERTROPHY";
            const trainingExperienceCode = document.getElementById("onboard-experience").value || "INTERMEDIATE";
            const occupationCode = document.getElementById("onboard-occupation").value || "OFFICE_IT";
            const workPostureCode = document.getElementById("onboard-posture").value || "MOSTLY_SITTING";
            const dailyWorkHours = parseFloat(document.getElementById("onboard-work-hours").value) || 8;

            const targetWeightKg = parseFloat(document.getElementById("onboard-target-weight").value) || currentWeightKg;
            const minTargetSkeletalMuscleKg = parseFloat(document.getElementById("onboard-target-muscle").value) || currentMuscleKg;
            const targetBodyFatPercent = parseFloat(document.getElementById("onboard-target-fat-pct").value) || currentFatPercent;

            // 1. 프로필 및 목표 저장
            const profile = GymRatStorage.getProfile();
            profile.gender = gender;
            profile.age = age;
            profile.heightCm = heightCm;
            profile.occupationCode = occupationCode;
            profile.workPostureCode = workPostureCode;
            profile.dailyWorkHours = dailyWorkHours;
            profile.weeklyWorkDays = 5;
            profile.weeklyWorkoutTargetDays = weeklyWorkoutTargetDays;
            profile.programGoalType = programGoalType;
            profile.workoutIntensityCode = workoutIntensityCode;
            profile.trainingExperienceCode = trainingExperienceCode;
            profile.targetWeightKg = targetWeightKg;
            profile.minTargetSkeletalMuscleKg = minTargetSkeletalMuscleKg;
            profile.targetBodyFatPercent = targetBodyFatPercent;
            profile.dailyTargetCalories = evalRes.recommendedDailyCalories;
            profile.dailyTargetProteinG = evalRes.recommendedProteinG;
            profile.customTargetDurationDays = evalRes.selectedDays;
            profile.onboardingCompleted = true;
            GymRatStorage.saveProfile(profile);

            // 2. 평소 식습관 끼니 목록 저장 및 고정 루틴 생성
            if (!this.onboardMeals || this.onboardMeals.length === 0) {
                this.initDefaultOnboardMeals();
            }

            const bfMeal = this.onboardMeals.find(m => /아침/i.test(m.name)) || this.onboardMeals[0];
            const lcMeal = this.onboardMeals.find(m => /점심/i.test(m.name)) || (this.onboardMeals.length > 1 ? this.onboardMeals[1] : null);
            const dnMeal = this.onboardMeals.find(m => /저녁/i.test(m.name));

            const bfKcal = bfMeal ? Number(bfMeal.kcal) : 480;
            const bfPro = bfMeal ? Number(bfMeal.pro) : 40;
            const lcKcal = lcMeal ? Number(lcMeal.kcal) : 950;
            const lcPro = lcMeal ? Number(lcMeal.pro) : 32;

            GymRatStorage.saveCustomRoutines(
                {
                    configuredMeals: this.onboardMeals,
                    BREAKFAST_FIXED: {
                        templateCode: "FIXED_BREAKFAST",
                        mealType: "BREAKFAST",
                        mealLabel: "아침",
                        title: bfMeal ? bfMeal.name : "아침 식사",
                        subtitle: bfMeal ? (bfMeal.directText || bfMeal.hint || `${bfKcal} kcal / 단백질 ${bfPro}g`) : "아침 고정 식단",
                        badgeText: `원클릭 고정 루틴 · ${bfKcal.toLocaleString()} kcal / 단백질 ${bfPro}g`,
                        caloriesKcal: bfKcal,
                        carbsG: Math.round((bfKcal * 0.45) / 4),
                        proteinG: bfPro,
                        fatG: Math.round((bfKcal * 0.25) / 9)
                    },
                    LUNCH_FIXED: {
                        templateCode: "FIXED_LUNCH",
                        mealType: "LUNCH",
                        mealLabel: "점심",
                        title: lcMeal ? lcMeal.name : "점심 식사",
                        subtitle: lcMeal ? (lcMeal.directText || lcMeal.hint || `${lcKcal} kcal / 단백질 ${lcPro}g`) : "점심 고정 식단",
                        badgeText: `고정 템플릿 · ${lcKcal.toLocaleString()} kcal / 단백질 ${lcPro}g`,
                        caloriesKcal: lcKcal,
                        carbsG: Math.round((lcKcal * 0.5) / 4),
                        proteinG: lcPro,
                        fatG: Math.round((lcKcal * 0.25) / 9)
                    }
                },
                this.todayStr
            );

            // 3. 1일차(1주차 시작일) 초기 체성분 기록 저장 (기존 기록이 없을 때만 추가하여 기존 기록 절대 보존)
            const existingRecords = GymRatStorage.getWeightRecords();
            if (existingRecords.length === 0) {
                const bodyFatMassKg = SafeWeightLossCalculator.round2(currentWeightKg * (currentFatPercent / 100));
                GymRatStorage.saveWeightRecord({
                    recordDate: this.todayStr,
                    weightKg: currentWeightKg,
                    skeletalMuscleMassKg: currentMuscleKg,
                    bodyFatMassKg,
                    bodyFatPercentage: currentFatPercent,
                    memo: "맞춤 설계 1주차 시작 기준 기록"
                });
            }

            // 4. 클라우드 즉시 백업 및 대시보드 진입
            FirebaseSyncService.autoSyncIfActive();
            this.enterMainDashboard();
            this.showToast(
                `맞춤 설계 완료: 목표 ${targetWeightKg}kg (${evalRes.selectedDays}일 과정 · 일일 ${evalRes.recommendedDailyCalories.toLocaleString()}kcal)`
            );
        } catch (err) {
            console.error("Onboarding completion error:", err);
            // 오류 발생 시에도 사용자 진입이 막히지 않도록 대시보드 강제 진입
            this.enterMainDashboard();
            this.showToast("대시보드 시작 완료");
        }
    }

    /**
     * Firebase Cloud Firestore 하이브리드 동기화 모달 (방법 C)
     */
    openCloudSyncModal() {
        const syncInfo = FirebaseSyncService.getActiveSyncInfo();
        const nickInput = document.getElementById("input-sync-nickname");
        const pinInput = document.getElementById("input-sync-pin");
        const titleEl = document.getElementById("sync-status-title");
        const descEl = document.getElementById("sync-status-desc");
        const unlinkBtn = document.getElementById("btn-sync-unlink");

        if (syncInfo.nickname) {
            nickInput.value = syncInfo.nickname;
            pinInput.value = "";
            titleEl.textContent = `연결 상태: [${syncInfo.nickname}] 클라우드 동기화 활성화됨`;
            titleEl.className = "text-lime";
            const lastTimeStr = syncInfo.lastSyncTimestamp
                ? new Date(syncInfo.lastSyncTimestamp).toLocaleString()
                : "최근 동기화 없음";
            descEl.innerHTML = `현재 이 기기는 <strong>${syncInfo.nickname}</strong> 계정으로 Firebase Cloud Firestore와 연결되어 있습니다.<br/>최근 동기화 시각: ${lastTimeStr}`;
            unlinkBtn.style.display = "inline-block";
        } else {
            nickInput.value = "";
            pinInput.value = "";
            titleEl.textContent = "연결 상태: 로컬 기기 단독 사용 중";
            titleEl.className = "text-blue";
            descEl.textContent = "본인 지정 아이디와 PIN 번호(4자리 이상)를 입력하여 클라우드에 백업하거나 다른 기기의 기록을 불러오세요.";
            unlinkBtn.style.display = "inline-block";
        }

        document.getElementById("modal-cloud-sync").classList.remove("hidden");
    }

    async handleCloudBackup() {
        const nick = document.getElementById("input-sync-nickname").value.trim();
        const pin = document.getElementById("input-sync-pin").value.trim();

        if (!nick || pin.length < 4) {
            this.showToast("본인 지정 아이디와 4자리 이상의 PIN 번호를 입력해주세요.");
            return;
        }

        const backupBtn = document.getElementById("btn-action-backup");
        const originalText = backupBtn.textContent;
        backupBtn.disabled = true;
        backupBtn.textContent = "백업 중...";

        try {
            const res = await FirebaseSyncService.backupToCloud(nick, pin);
            this.renderDashboardScreen();
            this.openCloudSyncModal();
            this.showToast(`Firebase 클라우드 백업 완료: 총 ${res.recordsCount}건 체성분 기록이 보관되었습니다.`);
        } catch (err) {
            this.showToast(`클라우드 백업 실패: ${err.message || "네트워크 오류"}`);
        } finally {
            backupBtn.disabled = false;
            backupBtn.textContent = originalText;
        }
    }

    async handleCloudRestore() {
        const nick = document.getElementById("input-sync-nickname").value.trim();
        const pin = document.getElementById("input-sync-pin").value.trim();

        if (!nick || pin.length < 4) {
            this.showToast("본인 지정 아이디와 4자리 이상의 PIN 번호를 입력해주세요.");
            return;
        }

        const restoreBtn = document.getElementById("btn-action-restore");
        const originalText = restoreBtn.textContent;
        restoreBtn.disabled = true;
        restoreBtn.textContent = "복원 중...";

        try {
            const res = await FirebaseSyncService.restoreFromCloud(nick, pin);
            this.renderAll();
            this.openCloudSyncModal();
            this.showToast(`Firebase 클라우드 복원 및 병합 완료: 총 ${res.recordsCount}건 기록이 동기화되었습니다.`);
        } catch (err) {
            this.showToast(`클라우드 복원 실패: ${err.message || "해당 계정 백업이 없거나 오류 발생"}`);
        } finally {
            restoreBtn.disabled = false;
            restoreBtn.textContent = originalText;
        }
    }

    handleCloudUnlink() {
        FirebaseSyncService.clearActiveSyncInfo();
        this.closeAllModals();
        this.initLandingGate();
        const idInput = document.getElementById("landing-input-id");
        if (idInput) idInput.focus();
        window.scrollTo({ top: 0, behavior: "smooth" });
        this.showToast("로그아웃되었습니다. 다른 아이디와 PIN 번호로 로그인할 수 있습니다.");
    }

    closeAllModals() {
        document.querySelectorAll(".modal-backdrop").forEach(m => m.classList.add("hidden"));
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const app = new GymRatApp();
    app.init();
});
