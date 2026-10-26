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
    SmartFoodCalorieEstimator,
    FoodCategoryCatalog
} from "./storage.js";
import { GymRatCharts } from "./chart.js";
import { FirebaseSyncService } from "./firebase-sync.js";
import { MotivationalQuotesService } from "./quotes.js";

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

        // PC-모바일 실시간 연동: 탭 활성화 또는 창 포커스 복귀 시 백그라운드 클라우드 자동 동기화
        const handleCloudAutoPull = () => {
            const syncInfo = FirebaseSyncService.getActiveSyncInfo();
            if (syncInfo.nickname && syncInfo.syncKey) {
                FirebaseSyncService.syncWithCloud(syncInfo.syncKey, syncInfo.nickname)
                    .then(res => {
                        if (res && res.success) {
                            this.renderAll();
                        }
                    })
                    .catch(e => console.warn("Cloud background sync error:", e));
            }
        };

        window.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "visible") {
                handleCloudAutoPull();
            }
        });
        window.addEventListener("focus", handleCloudAutoPull);
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
        const btnOpenWorkout = document.getElementById("btn-open-workout-modal");
        if (btnOpenWorkout) {
            btnOpenWorkout.addEventListener("click", () => {
                this.openWorkoutModal();
            });
        }

        // 최상단 중앙 운동 자극 문구 클릭 시 새로운 명언 갱신
        const quoteBar = document.getElementById("dashboard-quote-bar");
        if (quoteBar) {
            quoteBar.addEventListener("click", () => {
                MotivationalQuotesService.renderMotivationalQuote();
            });
        }

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
        const calcFatMassBadge = document.getElementById("display-calc-fat-mass");
        const memoInput = document.getElementById("input-body-memo");

        const updateFatMassDisplay = () => {
            const w = parseFloat(weightInput.value);
            const pct = parseFloat(fatPctInput.value);
            if (w > 0 && !isNaN(pct) && pct >= 0) {
                const fm = SafeWeightLossCalculator.round2(w * (pct / 100));
                if (calcFatMassBadge) calcFatMassBadge.textContent = `${fm.toFixed(2)} kg`;
                if (fatMassInput) fatMassInput.value = fm.toFixed(2);
            } else {
                if (calcFatMassBadge) calcFatMassBadge.textContent = "0.00 kg";
                if (fatMassInput) fatMassInput.value = "";
            }
        };

        dateInput.addEventListener("change", () => {
            const selectedDate = dateInput.value;
            const records = GymRatStorage.getWeightRecords();
            const found = records.find(r => r.recordDate === selectedDate);
            if (found) {
                weightInput.value = Number(found.weightKg).toFixed(2);
                muscleInput.value = Number(found.skeletalMuscleMassKg).toFixed(2);
                fatPctInput.value = Number(found.bodyFatPercentage).toFixed(1);
                updateFatMassDisplay();
                memoInput.value = found.memo || "";
            }
        });

        // 체중 및 체지방률(%) 입력 시 체지방량(kg) 실시간 자동 계산
        weightInput.addEventListener("input", updateFatMassDisplay);
        fatPctInput.addEventListener("input", updateFatMassDisplay);

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

        // 식습관 기반 식품 조합기 모달 오픈 및 이벤트
        const openHabitBtn = document.getElementById("btn-open-habit-modal");
        if (openHabitBtn) {
            openHabitBtn.addEventListener("click", () => {
                this.openHabitBuilderModal();
            });
        }

        const addModalMealBtn = document.getElementById("btn-add-modal-meal");
        if (addModalMealBtn) {
            addModalMealBtn.addEventListener("click", () => {
                this.handleAddMealSlot("modal-meal-slots-container", true);
            });
        }

        const saveModalMealsBtn = document.getElementById("btn-save-modal-meals");
        if (saveModalMealsBtn) {
            saveModalMealsBtn.addEventListener("click", () => {
                this.handleSaveModalMeals();
            });
        }

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
        const formWorkout = document.getElementById("form-workout-set");
        if (formWorkout) {
            formWorkout.addEventListener("submit", e => {
                e.preventDefault();
                this.handleSaveWorkoutSet();
            });
        }

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
        const quoteBar = document.getElementById("dashboard-quote-bar");
        const navDash = document.getElementById("nav-btn-dashboard");
        const navGraph = document.getElementById("nav-btn-graph");

        if (viewName === "dashboard") {
            dashSection.classList.remove("hidden");
            if (quoteBar) quoteBar.classList.remove("hidden");
            graphSection.classList.add("hidden");
            navDash.classList.add("active");
            navGraph.classList.remove("active");
            this.renderDashboardScreen();
        } else {
            dashSection.classList.add("hidden");
            if (quoteBar) quoteBar.classList.add("hidden");
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
        const weekPill = document.getElementById("current-week-pill");
        if (!hasRecords) {
            weekPill.textContent = "1주차 시작 대기";
            weekPill.className = "week-status-pill";
        } else if (plan.isThisWeekGoalFailed) {
            weekPill.textContent = `${plan.currentWeekNumber}주차 목표 실패 (초과 +${plan.excessWeightKg.toFixed(2)}kg)`;
            weekPill.className = "week-status-pill failure";
        } else if (plan.isThisWeekGoalSuccess) {
            weekPill.textContent = `${plan.currentWeekNumber}주차 목표 성공`;
            weekPill.className = "week-status-pill success";
        } else if (plan.latestDate === plan.startDateStr) {
            weekPill.textContent = "1주차 (시작일)";
            weekPill.className = "week-status-pill";
        } else {
            weekPill.textContent = `${plan.currentWeekNumber}주차 진행 중`;
            weekPill.className = "week-status-pill";
        }

        document.getElementById("atflee-current-weight").textContent = plan.currentWeightKg.toFixed(2);

        const remainingEl = document.getElementById("atflee-weekly-remaining");
        if (plan.isThisWeekGoalFailed) {
            remainingEl.textContent = `실패 (+${plan.excessWeightKg.toFixed(2)})`;
            remainingEl.className = "metric-value-huge text-danger";
        } else if (plan.isThisWeekGoalSuccess) {
            remainingEl.textContent = "성공 (0.00)";
            remainingEl.className = "metric-value-huge text-lime";
        } else {
            remainingEl.textContent = `- ${plan.remainingToLoseThisWeekKg.toFixed(2)}`;
            remainingEl.className = "metric-value-huge";
        }

        const sub1El = document.getElementById("atflee-weekly-sub1");
        if (plan.isThisWeekGoalFailed) {
            const catchupLabel = (plan.catchupMode === "1WEEK") ? "1주일 집중 보정" : "1달(4주) 분산 보정";
            sub1El.textContent = `${plan.currentWeekNumber}주차 목표(${plan.thisWeekTargetWeightKg.toFixed(2)}kg) 미달성 (+${plan.excessWeightKg.toFixed(2)}kg 초과 · ${catchupLabel})`;
        } else if (plan.isThisWeekGoalSuccess) {
            sub1El.textContent = `${plan.currentWeekNumber}주차 목표(${plan.thisWeekTargetWeightKg.toFixed(2)}kg) 도달 성공`;
        } else {
            sub1El.textContent = `${plan.currentWeekNumber}주차 권장 -${plan.weeklyTargetLossKg.toFixed(2)}kg (목표 ${plan.thisWeekTargetWeightKg.toFixed(2)}kg)`;
        }
        document.getElementById("atflee-weekly-sub2").textContent =
            `터치하여 ${plan.currentWeekNumber}주차 이전 기록 및 이후 몸무게 보기`;

        // 2. 어제 대비 3열
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
        const scTitle = document.getElementById("science-coaching-title");
        if (scTitle) scTitle.textContent = plan.scienceCoachingTitle;
        const scDetail = document.getElementById("science-coaching-detail");
        if (scDetail) scDetail.textContent = plan.scienceCoachingDetail;
        const weeklyPct = Math.round(plan.weeklyProgressRatio * 100);
        const scProgLabel = document.getElementById("science-weekly-progress-label");
        if (scProgLabel) scProgLabel.textContent = `이번 주 감량 달성률 (${plan.alreadyLostThisWeekKg.toFixed(2)} / ${plan.weeklyTargetLossKg.toFixed(2)}kg)`;
        const scProgPct = document.getElementById("science-weekly-progress-pct");
        if (scProgPct) scProgPct.textContent = `${weeklyPct}%`;
        const scProgBar = document.getElementById("science-weekly-progress-bar");
        if (scProgBar) scProgBar.style.width = `${weeklyPct}%`;
        const scBullets = document.getElementById("science-meta-bullets");
        if (scBullets) {
            scBullets.innerHTML = `
            <li>골격근 방어 여유분: <strong>+${plan.muscleSafetyBufferKg.toFixed(2)}kg</strong> (마지노선 ${plan.minTargetMuscleKg.toFixed(1)}kg)</li>
            <li>권장 일일 에너지 적자: <strong>-${plan.recommendedDailyDeficitKcal} kcal/일</strong> (식단 + 운동 합산)</li>
            <li>예상 최종 목표(${plan.targetWeightKg.toFixed(1)}kg) 도달일: <strong>${plan.estimatedTargetDate}</strong> (약 ${plan.estimatedWeeksToFinalGoal}주 후)</li>
        `;
        }

        // 4. 내 맞춤 평소 식습관 & 일평균 영양 요약 리스트 렌더링
        this.renderDashboardDietSummary();
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

        let weekStatusBadge = "";
        if (plan.isThisWeekGoalSuccess) {
            weekStatusBadge = '<span class="roadmap-goal-badge success">성공</span>';
        } else if (plan.isThisWeekGoalFailed) {
            weekStatusBadge = '<span class="roadmap-goal-badge failure">실패</span>';
        }

        const bannerEl = document.getElementById("roadmap-current-week-banner");
        bannerEl.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; align-items: center; gap: 6px;">
                    <strong class="${plan.isThisWeekGoalFailed ? "text-danger" : "text-lime"}" style="font-size: 13.5px;">현재 ${plan.currentWeekNumber}주차 목표 요약</strong>
                    ${weekStatusBadge}
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
                    <strong class="${plan.isThisWeekGoalFailed ? "text-danger" : "text-lime"}">${plan.thisWeekTargetWeightKg.toFixed(2)}kg ${plan.isThisWeekGoalSuccess ? "(성공)" : plan.isThisWeekGoalFailed ? "(실패)" : ""}</strong>
                </div>
            </div>
        `;

        // 1주차 목표 미달성 시 1주일 vs 1달 보정 감량 선택 UI 컨테이너
        const catchupContainer = document.getElementById("roadmap-catchup-container");
        if (catchupContainer) {
            if (plan.isThisWeekGoalFailed) {
                const is1Week = plan.catchupMode === "1WEEK";
                catchupContainer.innerHTML = `
                    <div class="catchup-plan-card">
                        <div class="catchup-header">
                            <span class="catchup-badge">목표 미달성 보정 플랜</span>
                            <strong style="font-size: 13.5px; color: var(--coral-danger);">
                                ${plan.currentWeekNumber}주차 목표 대비 +${plan.excessWeightKg.toFixed(2)}kg 초과 (실패)
                            </strong>
                        </div>
                        <p class="catchup-desc">
                            1주차 목표 감량치를 달성하지 못했습니다. 초과된 <strong>+${plan.excessWeightKg.toFixed(2)}kg</strong>을 다음 1주일 동안 빠르게 보정 감량할지, 1달(4주) 동안 무리 없이 분산 감량할지 선택해주세요.
                        </p>
                        <div class="catchup-options-grid">
                            <button type="button" class="btn-catchup-plan ${is1Week ? "active" : ""}" data-mode="1WEEK">
                                <span class="catchup-btn-title">1주일 집중 감량 플랜</span>
                                <span class="catchup-btn-meta">다음 주차에 기본 감량폭(-${plan.weeklyTargetLossKg.toFixed(2)}kg)에 초과분(-${plan.excessWeightKg.toFixed(2)}kg)을 더해 <strong>총 -${(plan.weeklyTargetLossKg + plan.excessWeightKg).toFixed(2)}kg</strong> 즉시 감량</span>
                                <span class="catchup-btn-kcal">일일 추가 약 -${plan.catchupKcal1Week.toLocaleString()} kcal 적자 권장</span>
                            </button>
                            <button type="button" class="btn-catchup-plan ${!is1Week ? "active" : ""}" data-mode="1MONTH">
                                <span class="catchup-btn-title">1달(4주) 분산 감량 플랜</span>
                                <span class="catchup-btn-meta">향후 4주에 걸쳐 매주 초과분의 1/4(-${plan.excessPerWeekMonth.toFixed(2)}kg)씩 나누어 <strong>매주 -${(plan.weeklyTargetLossKg + plan.excessPerWeekMonth).toFixed(2)}kg</strong> 안전 분산 감량</span>
                                <span class="catchup-btn-kcal">일일 추가 약 -${plan.catchupKcal1Month.toLocaleString()} kcal 적자 권장</span>
                            </button>
                        </div>
                    </div>
                `;

                catchupContainer.querySelectorAll(".btn-catchup-plan").forEach(btn => {
                    btn.addEventListener("click", async () => {
                        const mode = btn.dataset.mode;
                        const currProfile = GymRatStorage.getProfile();
                        currProfile.missedGoalCatchupMode = mode;
                        GymRatStorage.saveProfile(currProfile);
                        await FirebaseSyncService.autoSyncIfActive();
                        this.renderAll();
                        this.renderWeeklyRoadmapModalContent();
                        this.showToast(
                            mode === "1WEEK"
                                ? "초과 체중을 '1주일 집중 감량 플랜'으로 보정하도록 로드맵을 갱신했습니다."
                                : "초과 체중을 '1달(4주) 분산 감량 플랜'으로 분산 보정하도록 로드맵을 갱신했습니다."
                        );
                    });
                });
            } else {
                catchupContainer.innerHTML = "";
            }
        }

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

        // 1) 이전 측정 기록 렌더링 (주차별 목표 달성 시 '성공', 미달성 시 '실패' 배지 및 문구 표시)
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
                    let statusBadge = "";
                    let inlineBadge = "";
                    let targetSubText = "";
                    let subTextClass = "";

                    if (rec.isGoalSuccess) {
                        statusBadge = '<span class="roadmap-goal-badge success">성공</span>';
                        inlineBadge = '<span class="roadmap-inline-success">성공</span>';
                        targetSubText = `${deltaLabel} · 목표(${rec.weekTargetWeightKg.toFixed(2)}kg) 성공`;
                        subTextClass = "text-lime";
                    } else if (rec.isGoalFailed) {
                        statusBadge = '<span class="roadmap-goal-badge failure">실패</span>';
                        inlineBadge = '<span class="roadmap-inline-failure">실패</span>';
                        targetSubText = `${deltaLabel} · 목표(${rec.weekTargetWeightKg.toFixed(2)}kg) 대비 +${rec.excessKg.toFixed(2)}kg 초과 (실패)`;
                        subTextClass = "text-danger";
                    } else if (rec.isStartRecord) {
                        targetSubText = deltaLabel;
                    } else {
                        targetSubText = `${deltaLabel} (목표 ${rec.weekTargetWeightKg.toFixed(2)}kg)`;
                    }

                    const rowClassList = [
                        "roadmap-row",
                        isLatest ? "current-week-highlight" : "",
                        rec.isGoalSuccess ? "goal-success-row" : "",
                        rec.isGoalFailed ? "goal-failure-row" : ""
                    ]
                        .filter(Boolean)
                        .join(" ");

                    return `
                <div class="${rowClassList}">
                    <div>
                        <div class="roadmap-week-title-row">
                            <strong>${weekTitle}</strong>
                            ${statusBadge}
                        </div>
                        <span class="roadmap-sub">${rec.recordDate}</span>
                    </div>
                    <div>
                        <strong>${rec.weightKg.toFixed(2)} kg ${inlineBadge}</strong>
                        <span class="roadmap-sub ${subTextClass}">${targetSubText}</span>
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
        document.getElementById("input-body-fat-pct").value = plan.currentFatPercent.toFixed(1);

        const fatMassInput = document.getElementById("input-body-fat-mass");
        const calcBadge = document.getElementById("display-calc-fat-mass");
        if (fatMassInput) fatMassInput.value = plan.currentFatMassKg.toFixed(2);
        if (calcBadge) calcBadge.textContent = `${plan.currentFatMassKg.toFixed(2)} kg`;

        const todayExisting = records.find(r => r.recordDate === this.todayStr);
        document.getElementById("input-body-memo").value = todayExisting ? (todayExisting.memo || "") : "";

        document.getElementById("modal-body-record").classList.remove("hidden");
    }

    async handleSaveBodyRecord() {
        const recordDate = document.getElementById("input-body-date").value || getLocalDateString();
        const weightKg = parseFloat(document.getElementById("input-body-weight").value);
        const skeletalMuscleMassKg = parseFloat(document.getElementById("input-body-muscle").value);
        const bodyFatPercentage = parseFloat(document.getElementById("input-body-fat-pct").value);
        const memo = document.getElementById("input-body-memo").value.trim();

        if (isNaN(weightKg) || weightKg <= 0 || isNaN(skeletalMuscleMassKg) || skeletalMuscleMassKg <= 0) {
            this.showToast("몸무게와 골격근량을 올바르게 입력해주세요.");
            return;
        }

        if (isNaN(bodyFatPercentage) || bodyFatPercentage <= 0) {
            this.showToast("체지방률(%)을 올바르게 입력해주세요.");
            return;
        }

        // 체지방률(%)과 몸무게(kg)로부터 체지방량(kg) 자동 계산
        const bodyFatMassKg = SafeWeightLossCalculator.round2(weightKg * (bodyFatPercentage / 100));

        const updatedList = GymRatStorage.upsertWeightRecord({
            recordDate,
            weightKg,
            skeletalMuscleMassKg,
            bodyFatMassKg,
            bodyFatPercentage,
            memo
        });

        this.selectedChartPointIndex = updatedList.length - 1;
        this.closeAllModals();
        this.renderAll();
        await FirebaseSyncService.autoSyncIfActive();
        this.showToast(
            `${recordDate} 체성분 기록 반영 완료: ${weightKg.toFixed(2)}kg · 체지방량 ${bodyFatMassKg.toFixed(2)}kg 자동 계산 (총 ${updatedList.length}건 기록 보존)`
        );
    }
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
     * 식습관 식품 조합기 모달 오픈 및 렌더링
     */
    openHabitBuilderModal() {
        this.initDefaultOnboardMeals();
        this.renderMealSlots("modal-meal-slots-container", true);
        const modal = document.getElementById("modal-habit-builder");
        if (modal) modal.classList.remove("hidden");
    }

    /**
     * 식습관 식품 조합기 모달 저장 처리
     */
    handleSaveModalMeals() {
        if (!this.onboardMeals || this.onboardMeals.length === 0) {
            this.initDefaultOnboardMeals();
        }
        GymRatStorage.saveCustomOnboardMeals(this.onboardMeals);

        const bfMeal = this.onboardMeals.find(m => /아침/i.test(m.name)) || this.onboardMeals[0];
        const lcMeal = this.onboardMeals.find(m => /점심/i.test(m.name)) || (this.onboardMeals.length > 1 ? this.onboardMeals[1] : null);
        const bfKcal = bfMeal ? Number(bfMeal.kcal) : 470;
        const bfPro = bfMeal ? Number(bfMeal.pro) : 44;
        const lcKcal = lcMeal ? Number(lcMeal.kcal) : 1100;
        const lcPro = lcMeal ? Number(lcMeal.pro) : 38;

        GymRatStorage.saveCustomRoutines(
            {
                configuredMeals: this.onboardMeals,
                BREAKFAST_FIXED: {
                    templateCode: "FIXED_BREAKFAST",
                    mealType: "BREAKFAST",
                    mealLabel: "아침",
                    title: bfMeal ? bfMeal.name : "아침 식사",
                    subtitle: bfMeal && bfMeal.items && bfMeal.items.length > 0
                        ? bfMeal.items.map(i => { const it = FoodCategoryCatalog.getItem(i.id); return it ? `${it.name} ${i.quantity}${it.unit}` : ""; }).filter(Boolean).join(", ")
                        : "아침 고정 식단",
                    badgeText: `${bfKcal.toLocaleString()} kcal / 단백질 ${bfPro}g`,
                    caloriesKcal: bfKcal,
                    carbsG: bfMeal ? (bfMeal.carb || 0) : 37,
                    proteinG: bfPro,
                    fatG: bfMeal ? (bfMeal.fat || 0) : 17
                },
                LUNCH_FIXED: {
                    templateCode: "FIXED_LUNCH",
                    mealType: "LUNCH",
                    mealLabel: "점심",
                    title: lcMeal ? lcMeal.name : "점심 식사",
                    subtitle: lcMeal && lcMeal.items && lcMeal.items.length > 0
                        ? lcMeal.items.map(i => { const it = FoodCategoryCatalog.getItem(i.id); return it ? `${it.name} ${i.quantity}${it.unit}` : ""; }).filter(Boolean).join(", ")
                        : "점심 고정 식단",
                    badgeText: `${lcKcal.toLocaleString()} kcal / 단백질 ${lcPro}g`,
                    caloriesKcal: lcKcal,
                    carbsG: lcMeal ? (lcMeal.carb || 0) : 120,
                    proteinG: lcPro,
                    fatG: lcMeal ? (lcMeal.fat || 0) : 44
                }
            },
            this.todayStr
        );

        this.renderDashboardScreen();
        FirebaseSyncService.autoSyncIfActive();
        this.closeAllModals();
        this.showToast("식습관 식품 구성 및 일평균 영양 기준이 저장되었습니다.");
    }

    /**
     * 메인 대시보드 - 내 맞춤 평소 식습관 & 일평균 영양 요약 리스트 렌더링
     */
    renderDashboardDietSummary() {
        const container = document.getElementById("dashboard-diet-summary-list");
        if (!container) return;

        if (!this.onboardMeals || this.onboardMeals.length === 0) {
            this.initDefaultOnboardMeals();
        }

        const profile = GymRatStorage.getProfile();
        const targetKcal = Number(profile.dailyTargetCalories) || 2200;
        const targetPro = Number(profile.dailyTargetProteinG) || 150;

        let totalKcal = 0;
        let totalPro = 0;
        let totalCarb = 0;
        let totalFat = 0;

        const mealsHtml = this.onboardMeals.map((meal, idx) => {
            this.recalculateMealNutrients(meal);
            totalKcal += meal.kcal;
            totalPro += meal.pro;
            totalCarb += meal.carb || 0;
            totalFat += meal.fat || 0;

            let itemsDesc = "";
            if (meal.items && meal.items.length > 0) {
                itemsDesc = meal.items.map(itEntry => {
                    const catItem = FoodCategoryCatalog.getItem(itEntry.id);
                    return catItem ? `${catItem.name} × ${itEntry.quantity}${catItem.unit}` : "";
                }).filter(Boolean).join(", ");
            } else {
                itemsDesc = "등록된 구성 식품 없음 (식습관 식품 조합기에서 추가 가능)";
            }

            return `
                <div class="routine-item" style="cursor: default;">
                    <div class="routine-info" style="flex: 1;">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                            <span class="status-badge badge-blue" style="font-size: 11px; padding: 2px 7px;">${idx + 1}번째 끼니</span>
                            <h4 style="margin: 0; font-size: 15px;">${meal.name}</h4>
                        </div>
                        <p style="font-size: 12.5px; color: var(--text-secondary); margin: 4px 0;">${itemsDesc}</p>
                        <span class="routine-badge text-lime" style="font-size: 12px;">
                            ${meal.kcal.toLocaleString()} kcal · 단백질 ${meal.pro}g (탄수 ${meal.carb || 0}g · 지방 ${meal.fat || 0}g)
                        </span>
                    </div>
                </div>
            `;
        }).join("");

        const deltaKcal = totalKcal - targetKcal;
        const remainPro = Math.max(0, targetPro - totalPro);

        const summaryCardHtml = `
            <div class="tdee-preview-card" style="margin-top: 12px;">
                <div class="tdee-preview-header">
                    <strong class="text-lime">하루 맞춤 식습관 총 섭취 기준: ${totalKcal.toLocaleString()} kcal / 단백질 ${totalPro}g (탄수 ${totalCarb}g · 지방 ${totalFat}g)</strong>
                </div>
                <p class="tdee-preview-sub" style="margin-bottom: 0;">
                    일일 권장 목표(<b>${targetKcal.toLocaleString()} kcal</b>) 대비
                    ${deltaKcal > 0
                        ? `<strong class="text-warning">+${deltaKcal.toLocaleString()} kcal 초과</strong>`
                        : `<strong class="text-blue">${Math.abs(deltaKcal).toLocaleString()} kcal 여유</strong>`} ·
                    필수 단백질 목표(<b>${targetPro}g</b>) 기준
                    ${totalPro >= targetPro
                        ? '<strong class="text-lime">단백질 충족 달성</strong>'
                        : `추가 필요 단백질 <strong class="text-orange">${remainPro}g</strong>`}
                </p>
            </div>
        `;

        container.innerHTML = mealsHtml + summaryCardHtml;
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
        const syncInfo = FirebaseSyncService.getActiveSyncInfo();
        const profile = GymRatStorage.getProfile();
        const records = GymRatStorage.getWeightRecords();

        // 1. 이미 로그인 세션이 활성화되어 있고 설문을 완료했거나 체성분 기록이 있는 경우: 즉시 메인 대시보드로 복원 진입 후 클라우드 최신 동기화 풀
        if (syncInfo.nickname && syncInfo.syncKey && (profile.onboardingCompleted || records.length > 0)) {
            this.enterMainDashboard();
            FirebaseSyncService.syncWithCloud(syncInfo.syncKey, syncInfo.nickname)
                .then(res => {
                    if (res && res.success) {
                        this.renderAll();
                    }
                })
                .catch(e => console.warn("Startup cloud sync error:", e));
            return;
        }

        // 2. 로그인 세션은 있으나 로컬 온보딩 완료 플래그가 없는 경우: 클라우드에 기존 데이터가 있는지 먼저 동기화 시도
        if (syncInfo.nickname && syncInfo.syncKey && !profile.onboardingCompleted) {
            FirebaseSyncService.syncWithCloud(syncInfo.syncKey, syncInfo.nickname)
                .then(res => {
                    const refreshedProfile = GymRatStorage.getProfile();
                    const refreshedRecords = GymRatStorage.getWeightRecords();
                    if (refreshedProfile.onboardingCompleted || refreshedRecords.length > 0) {
                        this.enterMainDashboard();
                        this.renderAll();
                    } else {
                        this.openOnboardingWizard(syncInfo.nickname);
                    }
                })
                .catch(() => {
                    this.openOnboardingWizard(syncInfo.nickname);
                });
            return;
        }

        // 3. 미로그인 상태: 본인 지정 아이디 + PIN 게이트 화면 표시
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
        MotivationalQuotesService.renderMotivationalQuote();
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
            submitBtn.addEventListener("click", async e => {
                e.preventDefault();
                await this.handleCompleteOnboarding();
            });
        }

        const onboardForm = document.getElementById("form-onboarding-wizard");
        if (onboardForm) {
            onboardForm.addEventListener("submit", async e => {
                e.preventDefault();
                if (this.currentOnboardingStep && this.currentOnboardingStep < 5) {
                    this.goToOnboardingStep(this.currentOnboardingStep + 1);
                    return;
                }
                await this.handleCompleteOnboarding();
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

    /**
     * 식습관 끼니 기본 세팅 (기존 저장값 우선 복원, 없을 경우 카테고리별 표준 기본값)
     */
    initDefaultOnboardMeals() {
        const saved = GymRatStorage.getCustomOnboardMeals();
        if (saved && Array.isArray(saved) && saved.length > 0) {
            this.onboardMeals = saved.map(m => this.recalculateMealNutrients(m));
            return;
        }
        this.onboardMeals = [
            {
                id: "meal_bf",
                name: "아침 식사",
                items: [
                    { id: "egg_boiled", quantity: 3 },
                    { id: "apple", quantity: 1 },
                    { id: "whey_shake", quantity: 1 }
                ],
                kcal: 470,
                pro: 44,
                carb: 37,
                fat: 17
            },
            {
                id: "meal_lc",
                name: "점심 식사",
                items: [
                    { id: "cafeteria_seollongtang", quantity: 1 }
                ],
                kcal: 1100,
                pro: 38,
                carb: 120,
                fat: 44
            },
            {
                id: "meal_dn",
                name: "저녁 식사",
                items: [
                    { id: "chicken_breast", quantity: 200 },
                    { id: "white_rice", quantity: 1 },
                    { id: "kimchi", quantity: 1 }
                ],
                kcal: 558,
                pro: 54,
                carb: 71,
                fat: 5
            },
            {
                id: "meal_dr",
                name: "고정 음료 / 간식",
                items: [
                    { id: "barista_coffee", quantity: 1 }
                ],
                kcal: 174,
                pro: 5,
                carb: 25,
                fat: 6
            }
        ];
        this.onboardMeals.forEach(m => this.recalculateMealNutrients(m));
    }

    /**
     * 끼니 객체의 구성 식품들을 기반으로 칼로리 및 탄·단·지 정밀 재계산
     */
    recalculateMealNutrients(meal) {
        if (!meal) return meal;
        if (!Array.isArray(meal.items)) meal.items = [];
        let totalKcal = 0;
        let totalPro = 0;
        let totalCarb = 0;
        let totalFat = 0;
        meal.items.forEach(itEntry => {
            const catItem = FoodCategoryCatalog.getItem(itEntry.id);
            if (catItem) {
                const nut = FoodCategoryCatalog.computeNutrients(catItem, itEntry.quantity);
                totalKcal += nut.kcal;
                totalPro += nut.pro;
                totalCarb += nut.carb;
                totalFat += nut.fat;
            }
        });
        if (meal.items.length > 0) {
            meal.kcal = totalKcal;
            meal.pro = totalPro;
            meal.carb = totalCarb;
            meal.fat = totalFat;
        } else {
            meal.kcal = Number(meal.kcal) || 0;
            meal.pro = Number(meal.pro) || 0;
            meal.carb = Number(meal.carb) || 0;
            meal.fat = Number(meal.fat) || 0;
        }
        return meal;
    }

    /**
     * 식품군별 카테고리 기반 식단 조합기 UI 렌더링 (온보딩 및 모달 공용)
     */
    renderMealSlots(containerId, isModal = false) {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (!this.onboardMeals || this.onboardMeals.length === 0) {
            this.initDefaultOnboardMeals();
        }

        const categories = FoodCategoryCatalog.categories;

        container.innerHTML = this.onboardMeals
            .map((meal, mealIdx) => {
                this.recalculateMealNutrients(meal);
                const canDelete = this.onboardMeals.length > 1;

                let chipsHtml = "";
                if (meal.items && meal.items.length > 0) {
                    chipsHtml = meal.items
                        .map((itEntry, itemIdx) => {
                            const catItem = FoodCategoryCatalog.getItem(itEntry.id);
                            if (!catItem) return "";
                            const nut = FoodCategoryCatalog.computeNutrients(catItem, itEntry.quantity);
                            return `
                            <div class="meal-item-chip">
                                <span>${catItem.name} x ${itEntry.quantity}${catItem.unit}</span>
                                <span class="chip-meta">(${nut.kcal}kcal, 단백질 ${nut.pro}g)</span>
                                <button type="button" class="btn-remove-chip js-btn-remove-chip" data-container-id="${containerId}" data-meal-idx="${mealIdx}" data-item-idx="${itemIdx}" title="삭제">X</button>
                            </div>
                        `;
                        })
                        .join("");
                } else {
                    chipsHtml = `<span style="font-size: 11.5px; color: var(--text-secondary); padding: 4px 0;">추가된 음식이 없습니다. 아래 카테고리에서 식품을 선택하여 추가하세요.</span>`;
                }

                const defaultCat = categories[0].code;
                const initialCatItems = FoodCategoryCatalog.getItemsByCategory(defaultCat);
                const firstItem = initialCatItems[0] || {};

                const catOptionsHtml = categories.map(c => `<option value="${c.code}">${c.label}</option>`).join("");
                const itemOptionsHtml = initialCatItems
                    .map(it => `<option value="${it.id}">${it.name} (기준 ${it.baseQty}${it.unit}당 ${it.kcal}kcal / ${it.pro}g)</option>`)
                    .join("");

                return `
                <div class="meal-composer-card" data-meal-idx="${mealIdx}">
                    <div class="meal-composer-header">
                        <div style="display: flex; align-items: center; gap: 8px; flex: 1;">
                            <span class="status-badge badge-blue" style="font-size: 11px; padding: 2px 7px;">${mealIdx + 1}번째 끼니</span>
                            <input type="text" class="form-input js-meal-title" data-meal-idx="${mealIdx}" value="${meal.name}" style="font-weight: 800; font-size: 13.5px; width: 170px; padding: 4px 8px;" />
                        </div>
                        ${canDelete ? `<button type="button" class="btn-text-delete js-btn-delete-meal" data-container-id="${containerId}" data-meal-idx="${mealIdx}" style="color: var(--neon-orange); font-size: 12px; cursor: pointer; background: none; border: none;">이 끼니 삭제</button>` : ""}
                    </div>

                    <label style="font-size: 11px; color: var(--text-secondary); font-weight: 600; display: block; margin-bottom: 4px;">선택된 구성 식품 (클릭 시 개별 삭제)</label>
                    <div class="meal-items-chips-container js-chips-container" data-meal-idx="${mealIdx}">
                        ${chipsHtml}
                    </div>

                    <div class="food-adder-panel">
                        <label style="font-size: 11px; color: var(--neon-lime); font-weight: 600; display: block; margin-bottom: 6px;">+ 카테고리별 음식 추가</label>
                        <div class="food-adder-row">
                            <select class="form-input js-cat-select" data-container-id="${containerId}" data-meal-idx="${mealIdx}" style="width: 140px; font-size: 12px; padding: 6px 8px;">
                                ${catOptionsHtml}
                            </select>
                            <select class="form-input js-item-select" data-container-id="${containerId}" data-meal-idx="${mealIdx}" style="flex: 1; min-width: 180px; font-size: 12px; padding: 6px 8px;">
                                ${itemOptionsHtml}
                            </select>
                            <div class="qty-control-inline">
                                <input type="number" class="form-input js-qty-input" data-container-id="${containerId}" data-meal-idx="${mealIdx}" value="${firstItem.defaultQty || 1}" min="${firstItem.min || 1}" step="${firstItem.step || 1}" style="width: 65px; font-size: 12px; padding: 6px 8px; text-align: center;" />
                                <span class="js-qty-unit" data-meal-idx="${mealIdx}" style="font-size: 12px; color: var(--text-secondary); min-width: 20px;">${firstItem.unit || "개"}</span>
                            </div>
                            <button type="button" class="btn-outline-lime js-btn-add-food-item" data-container-id="${containerId}" data-meal-idx="${mealIdx}" style="font-size: 12px; padding: 6px 12px; white-space: nowrap;">
                                + 음식 추가
                            </button>
                        </div>
                    </div>

                    <div class="meal-total-badge js-meal-badge" data-meal-idx="${mealIdx}">
                        <strong>${meal.name} 영양 합계:</strong> <span class="text-lime font-bold">${meal.kcal.toLocaleString()} kcal</span> · 단백질 <strong class="text-lime">${meal.pro}g</strong> (탄수 ${meal.carb || 0}g · 지방 ${meal.fat || 0}g)
                    </div>
                </div>
            `;
            })
            .join("");

        // 1. 끼니명 수정
        container.querySelectorAll(".js-meal-title").forEach(inp => {
            inp.addEventListener("input", e => {
                const mIdx = parseInt(e.target.getAttribute("data-meal-idx"), 10);
                if (this.onboardMeals[mIdx]) {
                    this.onboardMeals[mIdx].name = e.target.value.trim() || `${mIdx + 1}번째 끼니`;
                    const badge = container.querySelector(`.meal-composer-card[data-meal-idx="${mIdx}"] .js-meal-badge strong`);
                    if (badge) badge.textContent = `${this.onboardMeals[mIdx].name} 영양 합계:`;
                    this.updateDietSummary(isModal);
                }
            });
        });

        // 2. 끼니 삭제
        container.querySelectorAll(".js-btn-delete-meal").forEach(btn => {
            btn.addEventListener("click", () => {
                const mIdx = parseInt(btn.getAttribute("data-meal-idx"), 10);
                if (this.onboardMeals.length <= 1) {
                    this.showToast("최소 1개 이상의 끼니가 필요합니다.");
                    return;
                }
                const deletedName = this.onboardMeals[mIdx].name;
                this.onboardMeals.splice(mIdx, 1);
                this.renderMealSlots(containerId, isModal);
                this.updateDietSummary(isModal);
                this.showToast(`${deletedName} 끼니가 삭제되었습니다. (현재 총 ${this.onboardMeals.length}끼)`);
            });
        });

        // 3. 카테고리 선택 변경 시 해당 카테고리 식품 목록 및 단위 자동 전환
        container.querySelectorAll(".js-cat-select").forEach(sel => {
            sel.addEventListener("change", e => {
                const mIdx = parseInt(e.target.getAttribute("data-meal-idx"), 10);
                const catCode = e.target.value;
                const items = FoodCategoryCatalog.getItemsByCategory(catCode);
                const card = container.querySelector(`.meal-composer-card[data-meal-idx="${mIdx}"]`);
                if (!card) return;
                const itemSel = card.querySelector(".js-item-select");
                const qtyInp = card.querySelector(".js-qty-input");
                const unitSpan = card.querySelector(".js-qty-unit");

                itemSel.innerHTML = items
                    .map(it => `<option value="${it.id}">${it.name} (기준 ${it.baseQty}${it.unit}당 ${it.kcal}kcal / ${it.pro}g)</option>`)
                    .join("");
                const first = items[0] || {};
                qtyInp.value = first.defaultQty || 1;
                qtyInp.min = first.min || 1;
                qtyInp.step = first.step || 1;
                unitSpan.textContent = first.unit || "개";
            });
        });

        // 4. 식품 선택 변경 시 단위 및 기본 수량 자동 세팅
        container.querySelectorAll(".js-item-select").forEach(sel => {
            sel.addEventListener("change", e => {
                const mIdx = parseInt(e.target.getAttribute("data-meal-idx"), 10);
                const itemId = e.target.value;
                const item = FoodCategoryCatalog.getItem(itemId);
                if (!item) return;
                const card = container.querySelector(`.meal-composer-card[data-meal-idx="${mIdx}"]`);
                if (!card) return;
                const qtyInp = card.querySelector(".js-qty-input");
                const unitSpan = card.querySelector(".js-qty-unit");
                qtyInp.value = item.defaultQty || 1;
                qtyInp.min = item.min || 1;
                qtyInp.step = item.step || 1;
                unitSpan.textContent = item.unit || "개";
            });
        });

        // 5. 음식 추가 버튼
        container.querySelectorAll(".js-btn-add-food-item").forEach(btn => {
            btn.addEventListener("click", () => {
                const mIdx = parseInt(btn.getAttribute("data-meal-idx"), 10);
                const meal = this.onboardMeals[mIdx];
                if (!meal) return;
                const card = container.querySelector(`.meal-composer-card[data-meal-idx="${mIdx}"]`);
                if (!card) return;
                const itemSel = card.querySelector(".js-item-select");
                const qtyInp = card.querySelector(".js-qty-input");
                const itemId = itemSel.value;
                const qty = parseFloat(qtyInp.value);
                if (!itemId || isNaN(qty) || qty <= 0) {
                    this.showToast("유효한 수량을 입력해주세요.");
                    return;
                }
                const item = FoodCategoryCatalog.getItem(itemId);
                if (!item) return;

                if (!Array.isArray(meal.items)) meal.items = [];
                const existing = meal.items.find(it => it.id === itemId);
                if (existing) {
                    existing.quantity += qty;
                } else {
                    meal.items.push({ id: itemId, quantity: qty });
                }
                this.recalculateMealNutrients(meal);
                this.renderMealSlots(containerId, isModal);
                this.updateDietSummary(isModal);
                const nut = FoodCategoryCatalog.computeNutrients(item, qty);
                this.showToast(`${item.name} ${qty}${item.unit} 추가 완료 (+${nut.kcal}kcal, 단백질 ${nut.pro}g)`);
            });
        });

        // 6. 개별 음식 칩 삭제 (X)
        container.querySelectorAll(".js-btn-remove-chip").forEach(btn => {
            btn.addEventListener("click", () => {
                const mIdx = parseInt(btn.getAttribute("data-meal-idx"), 10);
                const itIdx = parseInt(btn.getAttribute("data-item-idx"), 10);
                const meal = this.onboardMeals[mIdx];
                if (!meal || !meal.items || !meal.items[itIdx]) return;
                const removedItem = FoodCategoryCatalog.getItem(meal.items[itIdx].id);
                meal.items.splice(itIdx, 1);
                this.recalculateMealNutrients(meal);
                this.renderMealSlots(containerId, isModal);
                this.updateDietSummary(isModal);
                if (removedItem) {
                    this.showToast(`${removedItem.name} 항목이 삭제되었습니다.`);
                }
            });
        });

        this.updateDietSummary(isModal);
    }

    renderOnboardingMealSlots() {
        this.renderMealSlots("onboard-meal-slots-container", false);
    }

    handleAddMealSlot(containerId, isModal = false) {
        if (!this.onboardMeals) this.initDefaultOnboardMeals();
        const nextIdx = this.onboardMeals.length + 1;
        this.onboardMeals.push({
            id: `meal_${Date.now()}`,
            name: `${nextIdx}번째 식사 (보충/간식)`,
            items: [],
            kcal: 0,
            pro: 0,
            carb: 0,
            fat: 0
        });
        this.renderMealSlots(containerId, isModal);
        this.updateDietSummary(isModal);
        this.showToast(`${nextIdx}번째 끼니가 추가되었습니다. 원하는 음식을 카테고리에서 선택하세요.`);
    }

    handleAddOnboardMealSlot() {
        this.handleAddMealSlot("onboard-meal-slots-container", false);
    }

    updateDietSummary(isModal = false) {
        if (!this.onboardMeals || this.onboardMeals.length === 0) return;

        let totalKcal = 0;
        let totalPro = 0;
        let totalCarb = 0;
        let totalFat = 0;

        this.onboardMeals.forEach(m => {
            this.recalculateMealNutrients(m);
            totalKcal += m.kcal;
            totalPro += m.pro;
            totalCarb += m.carb || 0;
            totalFat += m.fat || 0;
        });

        const profile = GymRatStorage.getProfile();
        const evalRes = this.latestOnboardingEvaluation;
        const targetKcal = evalRes ? evalRes.recommendedDailyCalories : (profile.dailyTargetCalories || 2200);
        const targetPro = evalRes ? evalRes.recommendedProteinG : (profile.dailyTargetProteinG || 150);
        const deltaKcal = totalKcal - targetKcal;
        const remainPro = Math.max(0, targetPro - totalPro);

        const mealsListText = this.onboardMeals
            .map(m => `<b>${m.name}</b>: ${Number(m.kcal).toLocaleString()}kcal(${m.pro}g)`)
            .join(" · ");

        const summaryHtml = `
            <div class="tdee-preview-header">
                <strong class="text-lime">설정된 총 ${this.onboardMeals.length}끼 식단 섭취 합계: ${totalKcal.toLocaleString()} kcal (단백질 ${totalPro}g · 탄수 ${totalCarb}g · 지방 ${totalFat}g)</strong>
            </div>
            <p class="tdee-preview-sub" style="margin-bottom: 0;">
                ${mealsListText}<br/>
                설계된 일일 권장 목표 칼로리(<b>${targetKcal.toLocaleString()} kcal</b>) 대비
                ${deltaKcal > 0
                    ? `<strong class="text-warning">+${deltaKcal.toLocaleString()} kcal 초과</strong>`
                    : `<strong class="text-blue">${Math.abs(deltaKcal).toLocaleString()} kcal 여유</strong>`}
                (필수 단백질 목표 <b>${targetPro}g</b> 기준 ${totalPro >= targetPro ? '<strong class="text-lime">단백질 충족 달성</strong>' : `추가 필요 단백질 <strong class="text-orange">${remainPro}g</strong>`})
            </p>
        `;

        const summaryBox = isModal
            ? document.getElementById("modal-meal-summary-box")
            : document.getElementById("onboard-step4-diet-summary");

        if (summaryBox) {
            summaryBox.innerHTML = summaryHtml;
        }
    }

    updateOnboardingStep4DietSummary() {
        this.updateDietSummary(false);
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

    async handleCompleteOnboarding() {
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
            GymRatStorage.saveCustomOnboardMeals(this.onboardMeals);

            const bfMeal = this.onboardMeals.find(m => /아침/i.test(m.name)) || this.onboardMeals[0];
            const lcMeal = this.onboardMeals.find(m => /점심/i.test(m.name)) || (this.onboardMeals.length > 1 ? this.onboardMeals[1] : null);

            const bfKcal = bfMeal ? Number(bfMeal.kcal) : 470;
            const bfPro = bfMeal ? Number(bfMeal.pro) : 44;
            const lcKcal = lcMeal ? Number(lcMeal.kcal) : 1100;
            const lcPro = lcMeal ? Number(lcMeal.pro) : 38;

            GymRatStorage.saveCustomRoutines(
                {
                    configuredMeals: this.onboardMeals,
                    BREAKFAST_FIXED: {
                        templateCode: "FIXED_BREAKFAST",
                        mealType: "BREAKFAST",
                        mealLabel: "아침",
                        title: bfMeal ? bfMeal.name : "아침 식사",
                        subtitle: bfMeal && bfMeal.items && bfMeal.items.length > 0
                            ? bfMeal.items.map(i => { const it = FoodCategoryCatalog.getItem(i.id); return it ? `${it.name} ${i.quantity}${it.unit}` : ""; }).filter(Boolean).join(", ")
                            : "아침 고정 식단",
                        badgeText: `${bfKcal.toLocaleString()} kcal / 단백질 ${bfPro}g`,
                        caloriesKcal: bfKcal,
                        carbsG: bfMeal ? (bfMeal.carb || 0) : 37,
                        proteinG: bfPro,
                        fatG: bfMeal ? (bfMeal.fat || 0) : 17
                    },
                    LUNCH_FIXED: {
                        templateCode: "FIXED_LUNCH",
                        mealType: "LUNCH",
                        mealLabel: "점심",
                        title: lcMeal ? lcMeal.name : "점심 식사",
                        subtitle: lcMeal && lcMeal.items && lcMeal.items.length > 0
                            ? lcMeal.items.map(i => { const it = FoodCategoryCatalog.getItem(i.id); return it ? `${it.name} ${i.quantity}${it.unit}` : ""; }).filter(Boolean).join(", ")
                            : "점심 고정 식단",
                        badgeText: `${lcKcal.toLocaleString()} kcal / 단백질 ${lcPro}g`,
                        caloriesKcal: lcKcal,
                        carbsG: lcMeal ? (lcMeal.carb || 0) : 120,
                        proteinG: lcPro,
                        fatG: lcMeal ? (lcMeal.fat || 0) : 44
                    }
                },
                this.todayStr
            );

            // 3. 1일차(1주차 시작일) 초기 체성분 기록 저장 (기존 기록이 없을 때만 추가하여 기존 기록 절대 보존)
            const existingRecords = GymRatStorage.getWeightRecords();
            if (existingRecords.length === 0) {
                const bodyFatMassKg = SafeWeightLossCalculator.round2(currentWeightKg * (currentFatPercent / 100));
                GymRatStorage.upsertWeightRecord({
                    recordDate: this.todayStr,
                    weightKg: currentWeightKg,
                    skeletalMuscleMassKg: currentMuscleKg,
                    bodyFatMassKg,
                    bodyFatPercentage: currentFatPercent,
                    memo: "맞춤 설계 1주차 시작 기준 기록"
                });
            }

            // 4. 로컬 슬롯 즉시 동기화 및 클라우드 즉시 백업
            const syncInfo = FirebaseSyncService.getActiveSyncInfo();
            if (syncInfo.syncKey) {
                GymRatStorage.saveSlotSnapshot(syncInfo.syncKey);
            }
            await FirebaseSyncService.autoSyncIfActive();

            // 5. 대시보드 진입
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

    async handleCloudUnlink() {
        await FirebaseSyncService.autoSyncIfActive();
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
