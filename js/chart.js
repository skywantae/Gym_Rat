/**
 * GymRat — 고해상도(Retina/DPI) HTML5 Canvas 차트 렌더러
 * 1) 3대 영양소(탄/단/지) 도넛 차트
 * 2) 체중(90kg 목표 점선) & 골격근량(41kg 방어 점선) & 체지방률(19.5% 목표 점선) 반응형 꺾은선 그래프
 */

export class GymRatCharts {
    static renderMacroDonut(canvas, summary) {
        if (!canvas) return;
        const dpr = window.devicePixelRatio || 1;
        const size = 116;
        canvas.width = size * dpr;
        canvas.height = size * dpr;
        canvas.style.width = `${size}px`;
        canvas.style.height = `${size}px`;

        const ctx = canvas.getContext("2d");
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, size, size);

        const cx = size / 2;
        const cy = size / 2;
        const radius = 44;
        const lineWidth = 12;

        const pCal = summary.consumedProteinG * 4;
        const cCal = summary.consumedCarbsG * 4;
        const fCal = summary.consumedFatG * 9;
        const total = pCal + cCal + fCal;

        if (total <= 0) {
            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.strokeStyle = "#30363D";
            ctx.lineWidth = lineWidth;
            ctx.stroke();
            return;
        }

        const segments = [
            { value: pCal, color: "#39D353" }, // 단백질 (Neon Lime)
            { value: cCal, color: "#D29922" }, // 탄수화물 (Amber)
            { value: fCal, color: "#BC8CFF" }  // 지방 (Purple)
        ];

        let startAngle = -Math.PI / 2;
        segments.forEach(seg => {
            if (seg.value <= 0) return;
            const sweep = (seg.value / total) * Math.PI * 2;
            ctx.beginPath();
            ctx.arc(cx, cy, radius, startAngle, startAngle + sweep);
            ctx.strokeStyle = seg.color;
            ctx.lineWidth = lineWidth;
            ctx.stroke();
            startAngle += sweep;
        });
    }

    static renderBodyCompositionChart(canvas, records, profile, selectedTab, selectedIndex, onSelectIndex) {
        if (!canvas) return;
        const rect = canvas.parentElement.getBoundingClientRect();
        const width = Math.max(220, Math.floor(rect.width));
        const height = width >= 600 ? 310 : width < 340 ? 235 : 270;
        const dpr = window.devicePixelRatio || 1;

        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;

        const ctx = canvas.getContext("2d");
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, width, height);

        if (!records || records.length === 0) {
            ctx.fillStyle = "#8B949E";
            ctx.font = "600 13px 'Pretendard', sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("선택한 기간에 기록된 체성분 데이터가 없습니다.", width / 2, height / 2);
            return;
        }

        const sidePad = width < 360 ? 24 : 36;
        const leftPad = sidePad;
        const rightPad = sidePad;
        const topPad = 28;
        const bottomPad = 36;
        const chartWidth = Math.max(1, width - leftPad - rightPad);
        const chartHeight = Math.max(1, height - topPad - bottomPad);

        // 배경 그리드 선
        ctx.strokeStyle = "#292E36";
        ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
            const y = topPad + (chartHeight / 4) * i;
            ctx.beginPath();
            ctx.moveTo(leftPad, y);
            ctx.lineTo(width - rightPad, y);
            ctx.stroke();
        }

        const xForIndex = idx => {
            if (records.length <= 1) return leftPad + chartWidth / 2;
            return leftPad + (chartWidth / (records.length - 1)) * idx;
        };

        // 1) 체중 스케일
        const weights = records.map(r => Number(r.weightKg));
        const minWeightAxis = Math.min(88.0, Number(profile.targetWeightKg) - 2, ...weights) - 1.2;
        const maxWeightAxis = Math.max(106.5, Number(profile.startWeightKg) + 1.2, ...weights) + 1.2;
        const yForWeight = w => {
            const ratio = Math.min(1, Math.max(0, (w - minWeightAxis) / (maxWeightAxis - minWeightAxis)));
            return topPad + chartHeight * (1 - ratio);
        };

        // 2) 골격근량 스케일
        const muscles = records.map(r => Number(r.skeletalMuscleMassKg));
        const minMuscleAxis = Math.min(39.5, Number(profile.minTargetSkeletalMuscleKg) - 1.5, ...muscles) - 0.8;
        const maxMuscleAxis = Math.max(45.0, Number(profile.startSkeletalMuscleKg) + 1.5, ...muscles) + 0.8;
        const yForMuscle = m => {
            const ratio = Math.min(1, Math.max(0, (m - minMuscleAxis) / (maxMuscleAxis - minMuscleAxis)));
            return topPad + chartHeight * (1 - ratio);
        };

        // 3) 체지방률 스케일
        const fats = records.map(r => Number(r.bodyFatPercentage));
        const minFatAxis = Math.min(17.0, Number(profile.targetBodyFatPercent) - 2, ...fats) - 1.2;
        const maxFatAxis = Math.max(31.0, Number(profile.startBodyFatPercent) + 1.5, ...fats) + 1.2;
        const yForFat = f => {
            const ratio = Math.min(1, Math.max(0, (f - minFatAxis) / (maxFatAxis - minFatAxis)));
            return topPad + chartHeight * (1 - ratio);
        };

        // --- A. 체중 라인 & 목표 90.0kg 점선 ---
        if (selectedTab === "OVERLAY" || selectedTab === "WEIGHT_ONLY") {
            const targetWeightY = yForWeight(Number(profile.targetWeightKg));
            ctx.save();
            ctx.setLineDash([6, 5]);
            ctx.strokeStyle = "#58A6FF";
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(leftPad, targetWeightY);
            ctx.lineTo(width - rightPad, targetWeightY);
            ctx.stroke();
            ctx.restore();

            ctx.fillStyle = "#58A6FF";
            ctx.font = "700 11px 'Pretendard', sans-serif";
            ctx.textAlign = "left";
            ctx.fillText(`목표 ${profile.targetWeightKg}kg`, leftPad + 4, targetWeightY - 6);

            // 그라데이션 채우기
            ctx.beginPath();
            records.forEach((r, idx) => {
                const px = xForIndex(idx);
                const py = yForWeight(r.weightKg);
                if (idx === 0) {
                    ctx.moveTo(px, topPad + chartHeight);
                    ctx.lineTo(px, py);
                } else {
                    ctx.lineTo(px, py);
                }
                if (idx === records.length - 1) {
                    ctx.lineTo(px, topPad + chartHeight);
                    ctx.closePath();
                }
            });
            const grad = ctx.createLinearGradient(0, topPad, 0, topPad + chartHeight);
            grad.addColorStop(0, "rgba(88, 166, 255, 0.25)");
            grad.addColorStop(1, "rgba(88, 166, 255, 0.0)");
            ctx.fillStyle = grad;
            ctx.fill();

            // 꺾은선
            ctx.beginPath();
            records.forEach((r, idx) => {
                const px = xForIndex(idx);
                const py = yForWeight(r.weightKg);
                if (idx === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            });
            ctx.strokeStyle = "#58A6FF";
            ctx.lineWidth = 3;
            ctx.lineJoin = "round";
            ctx.lineCap = "round";
            ctx.stroke();

            // 포인트 원
            records.forEach((r, idx) => {
                const px = xForIndex(idx);
                const py = yForWeight(r.weightKg);
                const isSel = idx === selectedIndex;
                ctx.beginPath();
                ctx.arc(px, py, isSel ? 6 : 4, 0, Math.PI * 2);
                ctx.fillStyle = "#161B22";
                ctx.fill();
                ctx.lineWidth = isSel ? 3 : 2;
                ctx.strokeStyle = "#58A6FF";
                ctx.stroke();
            });
        }

        // --- B. 골격근량 라인 & 41.0kg 방어 마지노선 점선 ---
        if (selectedTab === "OVERLAY" || selectedTab === "MUSCLE_ONLY") {
            const minDefenseY = yForMuscle(Number(profile.minTargetSkeletalMuscleKg));
            ctx.save();
            ctx.setLineDash([6, 5]);
            ctx.strokeStyle = "#39D353";
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(leftPad, minDefenseY);
            ctx.lineTo(width - rightPad, minDefenseY);
            ctx.stroke();
            ctx.restore();

            ctx.fillStyle = "#39D353";
            ctx.font = "700 11px 'Pretendard', sans-serif";
            ctx.textAlign = "right";
            ctx.fillText(`근손실 방어선 ${profile.minTargetSkeletalMuscleKg}kg`, width - rightPad - 4, minDefenseY - 6);

            ctx.beginPath();
            records.forEach((r, idx) => {
                const px = xForIndex(idx);
                const py = yForMuscle(r.skeletalMuscleMassKg);
                if (idx === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            });
            ctx.strokeStyle = "#39D353";
            ctx.lineWidth = 2.8;
            ctx.lineJoin = "round";
            ctx.lineCap = "round";
            ctx.stroke();

            records.forEach((r, idx) => {
                const px = xForIndex(idx);
                const py = yForMuscle(r.skeletalMuscleMassKg);
                const isSel = idx === selectedIndex;
                ctx.beginPath();
                ctx.arc(px, py, isSel ? 6 : 4, 0, Math.PI * 2);
                ctx.fillStyle = "#161B22";
                ctx.fill();
                ctx.lineWidth = isSel ? 3 : 2;
                ctx.strokeStyle = "#39D353";
                ctx.stroke();
            });
        }

        // --- C. 체지방률 라인 & 19.5% 목표 점선 ---
        if (selectedTab === "BODY_FAT_ONLY") {
            const targetFatY = yForFat(Number(profile.targetBodyFatPercent));
            ctx.save();
            ctx.setLineDash([6, 5]);
            ctx.strokeStyle = "#D29922";
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(leftPad, targetFatY);
            ctx.lineTo(width - rightPad, targetFatY);
            ctx.stroke();
            ctx.restore();

            ctx.fillStyle = "#D29922";
            ctx.font = "700 11px 'Pretendard', sans-serif";
            ctx.textAlign = "left";
            ctx.fillText(`목표 체지방 ${profile.targetBodyFatPercent}%`, leftPad + 4, targetFatY - 6);

            ctx.beginPath();
            records.forEach((r, idx) => {
                const px = xForIndex(idx);
                const py = yForFat(r.bodyFatPercentage);
                if (idx === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            });
            ctx.strokeStyle = "#D29922";
            ctx.lineWidth = 3;
            ctx.stroke();

            records.forEach((r, idx) => {
                const px = xForIndex(idx);
                const py = yForFat(r.bodyFatPercentage);
                const isSel = idx === selectedIndex;
                ctx.beginPath();
                ctx.arc(px, py, isSel ? 6 : 4, 0, Math.PI * 2);
                ctx.fillStyle = "#D29922";
                ctx.fill();
            });
        }

        // 선택된 인덱스 수직 가이드 점선
        if (selectedIndex != null && selectedIndex >= 0 && selectedIndex < records.length) {
            const selX = xForIndex(selectedIndex);
            ctx.save();
            ctx.setLineDash([4, 4]);
            ctx.strokeStyle = "rgba(255,255,255,0.4)";
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(selX, topPad);
            ctx.lineTo(selX, topPad + chartHeight);
            ctx.stroke();
            ctx.restore();
        }

        // 하단 X축 날짜 라벨
        ctx.fillStyle = "#8B949E";
        ctx.font = "600 11px 'Pretendard', sans-serif";
        ctx.textAlign = "center";
        const step = Math.max(1, Math.floor(records.length / 5));
        records.forEach((r, idx) => {
            if (idx % step === 0 || idx === records.length - 1) {
                const px = xForIndex(idx);
                const shortDate = r.recordDate.slice(5).replace("-", ".");
                ctx.fillText(shortDate, px, height - 10);
            }
        });

        // 클릭/터치 이벤트 핸들러 등록
        const handlePointer = clientX => {
            const bounds = canvas.getBoundingClientRect();
            const relX = clientX - bounds.left;
            if (records.length <= 1) {
                onSelectIndex(0);
            } else {
                const stepX = chartWidth / (records.length - 1);
                const nearest = Math.round((relX - leftPad) / stepX);
                const clamped = Math.max(0, Math.min(records.length - 1, nearest));
                onSelectIndex(clamped);
            }
        };

        canvas.onclick = e => handlePointer(e.clientX);
        canvas.ontouchstart = e => {
            if (e.touches && e.touches.length > 0) {
                handlePointer(e.touches[0].clientX);
            }
        };
        canvas.ontouchmove = e => {
            if (e.touches && e.touches.length > 0) {
                handlePointer(e.touches[0].clientX);
            }
        };
    }
}
