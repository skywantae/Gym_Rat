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
    programGoalType: "DIET",
    workoutIntensityCode: "MODERATE_HYPERTROPHY",
    trainingExperienceCode: "INTERMEDIATE",
    occupationCode: "OFFICE_IT",
    workPostureCode: "MOSTLY_SITTING",
    dailyWorkHours: 8.0,
    weeklyWorkDays: 5,
    weeklyWorkoutTargetDays: 4,
    customTargetDurationDays: null,
    onboardingCompleted: false,
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
            label: "[계란·과일·쉐이크] 계란 3개 + 사과 1개 + 단백질 쉐이크 1스쿱",
            detail: "훈제/삶은 계란 3알(210kcal) + 사과 1개(110kcal) + 단백질 쉐이크(160kcal)",
            caloriesKcal: 480,
            proteinG: 40,
            carbsG: 32,
            fatG: 18
        },
        {
            code: "BF_EGG3_APPLE1",
            label: "[계란·과일] 계란 3개 + 사과 1개 (쉐이크 제외)",
            detail: "훈제/삶은 계란 3알(210kcal) + 사과 1개(110kcal)",
            caloriesKcal: 320,
            proteinG: 19,
            carbsG: 30,
            fatG: 15
        },
        {
            code: "BF_EGG2_BANANA_SOY",
            label: "[계란·두유] 계란 2개 + 바나나 1개 + 무가당 두유",
            detail: "계란 2알(140kcal) + 바나나 1개(105kcal) + 두유 1팩(95kcal)",
            caloriesKcal: 340,
            proteinG: 21,
            carbsG: 34,
            fatG: 13
        },
        {
            code: "BF_GREEK_OAT",
            label: "[유제품·곡물] 그릭요거트 150g + 오트밀 40g + 베리·견과류",
            detail: "고단백 그릭요거트 + 오트밀 + 블루베리·아몬드 간편식",
            caloriesKcal: 360,
            proteinG: 22,
            carbsG: 38,
            fatG: 12
        },
        {
            code: "BF_OAT_PROTEIN_BANANA",
            label: "[오트밀·프로틴] 오버나이트 오트밀(귀리 50g + 우유 + 프로틴 1스쿱)",
            detail: "귀리 오트밀(190kcal) + 저지방 우유(90kcal) + 프로틴 1스쿱(140kcal)",
            caloriesKcal: 420,
            proteinG: 33,
            carbsG: 48,
            fatG: 9
        },
        {
            code: "BF_CHICKEN_SWEETPOTATO",
            label: "[클린 식단] 닭가슴살 100g + 고구마 150g + 방울토마토",
            detail: "닭가슴살 1팩(120kcal) + 군/찐고구마 1개(200kcal) + 채소(25kcal)",
            caloriesKcal: 345,
            proteinG: 31,
            carbsG: 46,
            fatG: 4
        },
        {
            code: "BF_TOAST_EGG_CHEESE",
            label: "[빵·토스트] 통밀/호밀 식빵 2장 + 계란프라이 2개 + 치즈 1장",
            detail: "통밀식빵 2장(210kcal) + 계란프라이 2개(160kcal) + 슬라이스치즈(60kcal)",
            caloriesKcal: 430,
            proteinG: 23,
            carbsG: 38,
            fatG: 20
        },
        {
            code: "BF_BAGEL_CREAMCHEESE",
            label: "[베이글·빵] 베이글 1개 + 크림치즈 + 삶은 계란 1개",
            detail: "플레인/통밀 베이글(280kcal) + 크림치즈(110kcal) + 계란 1알(70kcal)",
            caloriesKcal: 460,
            proteinG: 18,
            carbsG: 56,
            fatG: 17
        },
        {
            code: "BF_SANDWICH_CHICKEN_EGG",
            label: "[샌드위치] 닭가슴살·계란·햄치즈 샌드위치 1개",
            detail: "카페/편의점/서브웨이 모닝 샌드위치 1개 평균",
            caloriesKcal: 410,
            proteinG: 24,
            carbsG: 42,
            fatG: 16
        },
        {
            code: "BF_CONV_KIMBAP_EGG_PRO",
            label: "[편의점 간편식] 삼각김밥 1개 + 반숙란 2개 + 단백질 음료 1팩",
            detail: "삼각김밥(180kcal) + 감동란 2개(130kcal) + 더단백/셀렉스(145kcal)",
            caloriesKcal: 455,
            proteinG: 34,
            carbsG: 46,
            fatG: 14
        },
        {
            code: "BF_CEREAL_MILK",
            label: "[시리얼·우유] 단백질 시리얼/그래놀라 50g + 우유 200ml",
            detail: "시리얼 1회분(250kcal) + 일반/저지방 우유 1컵(130kcal)",
            caloriesKcal: 380,
            proteinG: 16,
            carbsG: 52,
            fatG: 12
        },
        {
            code: "BF_GRAIN_POWDER_EGG",
            label: "[선식·미숫가루] 식사대용 선식/미숫가루 라떼 1잔 + 계란 2개",
            detail: "곡물 선식+우유(210kcal) + 삶은 계란 2알(140kcal)",
            caloriesKcal: 350,
            proteinG: 20,
            carbsG: 38,
            fatG: 13
        },
        {
            code: "BF_KOREAN_HALF_RICE",
            label: "[한식 가정식] 잡곡밥 반 공기 + 국 + 계란말이·나물 반찬",
            detail: "가벼운 한식 아침 식사 평균 (밥 1/2공기 + 국 + 단백질 반찬)",
            caloriesKcal: 460,
            proteinG: 21,
            carbsG: 62,
            fatG: 14
        },
        {
            code: "BF_KOREAN_FULL_RICE",
            label: "[한식 든든식] 공기밥 1공기 + 찌개/국 + 구이·반찬 3종",
            detail: "정식 한식 아침 식사 평균 (밥 1공기 + 국/찌개 + 반찬)",
            caloriesKcal: 650,
            proteinG: 26,
            carbsG: 88,
            fatG: 20
        },
        {
            code: "BF_SALAD_FRUIT",
            label: "[샐러드·과일] 리코타/닭가슴살 모닝 샐러드 + 과일 1접시",
            detail: "가벼운 모닝 샐러드 볼 + 계절 과일",
            caloriesKcal: 330,
            proteinG: 20,
            carbsG: 34,
            fatG: 12
        },
        {
            code: "BF_SHAKE_ONLY",
            label: "[단백질 단독] 아침 단백질 쉐이크(WPI/WPC) 1.5스쿱 단독",
            detail: "기상 직후 빠른 단백질 보충용 프로틴 쉐이크",
            caloriesKcal: 180,
            proteinG: 36,
            carbsG: 5,
            fatG: 2
        },
        {
            code: "BF_SKIP",
            label: "[간헐적 단식] 아침 식사 생략 (물·블랙커피만 섭취)",
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
            label: "[구내식당·국밥] 구내식당 설렁탕·곰탕·국밥류 정식 (밥 1공기 포함)",
            detail: "설렁탕/곰탕/국밥 등 구내식당 국물 메뉴 평균 (약 1,100 kcal)",
            caloriesKcal: 1100,
            proteinG: 32,
            carbsG: 135,
            fatG: 46
        },
        {
            code: "LC_CAFETERIA_STANDARD",
            label: "[구내식당·백반] 구내식당 일반 한식 백반 (밥 + 국 + 반찬 3~4종)",
            detail: "표준 구내식당 한식 백반 평균 (약 950 kcal)",
            caloriesKcal: 950,
            proteinG: 28,
            carbsG: 125,
            fatG: 36
        },
        {
            code: "LC_CAFETERIA_SPECIAL",
            label: "[구내식당·특식] 구내식당 돈까스·제육·튀김류 특식 코너",
            detail: "튀김/볶음 위주 구내식당 고칼로리 메뉴 (약 1,200 kcal)",
            caloriesKcal: 1200,
            proteinG: 34,
            carbsG: 138,
            fatG: 56
        },
        {
            code: "LC_CAFETERIA_SALAD_BOX",
            label: "[구내식당·샐러드] 구내식당 샐러드팩·다이어트 코너 도시락",
            detail: "사내 식당 클린 샐러드팩 + 삶은계란/닭가슴살 (약 540 kcal)",
            caloriesKcal: 540,
            proteinG: 32,
            carbsG: 52,
            fatG: 20
        },
        {
            code: "LC_KR_KIMCHI_SOONDUBU",
            label: "[한식·찌개] 김치찌개 / 순두부찌개 / 부대찌개 + 공기밥 1공기",
            detail: "직장인 단골 한식 찌개류 + 공기밥 + 밑반찬 (약 860 kcal)",
            caloriesKcal: 860,
            proteinG: 31,
            carbsG: 108,
            fatG: 32
        },
        {
            code: "LC_KR_DOENJANG_CHEONGGUK",
            label: "[한식·찌개] 된장찌개 / 청국장 + 공기밥 + 계란후라이·나물",
            detail: "된장·청국장 백반 + 공기밥 1공기 평균 (약 780 kcal)",
            caloriesKcal: 780,
            proteinG: 28,
            carbsG: 105,
            fatG: 26
        },
        {
            code: "LC_KR_PORK_SOONDAE_GUKBAP",
            label: "[한식·국밥] 돼지국밥 / 순대국밥 / 소머리국밥 / 뼈해장국",
            detail: "진한 고기 국밥류 + 공기밥 1공기 완식 기준 (약 980 kcal)",
            caloriesKcal: 980,
            proteinG: 42,
            carbsG: 106,
            fatG: 42
        },
        {
            code: "LC_KR_GALBITANG_SAMGYETANG",
            label: "[한식·탕류] 갈비탕 / 삼계탕 / 반계탕 / 닭곰탕 (고단백 탕류)",
            detail: "살코기 비중이 높은 보양 국물 요리 + 밥 (약 940 kcal)",
            caloriesKcal: 940,
            proteinG: 48,
            carbsG: 98,
            fatG: 38
        },
        {
            code: "LC_KR_BIBIMBAP_YUKHOE",
            label: "[한식·비빔밥] 돌솥비빔밥 / 육회비빔밥 / 꼬막·강된장 비빔밥",
            detail: "나물·고기·고추장 양념 비빔밥 1인분 평균 (약 790 kcal)",
            caloriesKcal: 790,
            proteinG: 30,
            carbsG: 112,
            fatG: 24
        },
        {
            code: "LC_OUT_KOREAN",
            label: "[한식·외식평균] 일반 식당 외식 (찌개·비빔밥·덮밥 평균)",
            detail: "직장인 점심 일반 한식당 외식 평균 (약 900 kcal)",
            caloriesKcal: 900,
            proteinG: 26,
            carbsG: 118,
            fatG: 34
        },
        {
            code: "LC_KR_JEYUK_BULGOGI",
            label: "[한식·고기백반] 제육볶음 / 오징어볶음 / 소불고기 백반 정식",
            detail: "매콤/달콤 볶음 고기 반찬 + 공기밥 + 쌈채소 (약 920 kcal)",
            caloriesKcal: 920,
            proteinG: 38,
            carbsG: 108,
            fatG: 36
        },
        {
            code: "LC_KR_GRILLED_FISH",
            label: "[한식·생선구이] 고등어·삼치·갈치 생선구이 정식 + 된장국",
            detail: "오메가3 풍부한 생선구이 + 공기밥 1공기 정식 (약 790 kcal)",
            caloriesKcal: 790,
            proteinG: 41,
            carbsG: 92,
            fatG: 28
        },
        {
            code: "LC_KR_BOSSAM_SSAMBAP",
            label: "[한식·보쌈/쌈밥] 보쌈 정식 / 수육 쌈밥 정식 (수육 + 밥 + 쌈)",
            detail: "삶은 돼지수육 1인분 + 공기밥 + 쌈채소 정식 (약 960 kcal)",
            caloriesKcal: 960,
            proteinG: 44,
            carbsG: 94,
            fatG: 44
        },
        {
            code: "LC_KR_DAKGALBI_JJIMDAK",
            label: "[한식·닭요리] 춘천 닭갈비 / 안동 찜닭 (1인분 + 밥/사리)",
            detail: "닭다리살·가슴살 양념 요리 + 밥/면 사리 평균 (약 930 kcal)",
            caloriesKcal: 930,
            proteinG: 43,
            carbsG: 110,
            fatG: 34
        },
        {
            code: "LC_JP_TONKATSU",
            label: "[일식·돈까스] 등심·안심·치즈 돈까스 정식 (밥·미니우동 포함)",
            detail: "일식/경양식 돈까스 1인분 정식 평균 (약 1,020 kcal)",
            caloriesKcal: 1020,
            proteinG: 36,
            carbsG: 116,
            fatG: 45
        },
        {
            code: "LC_JP_SUSHI_HOEDEOPBAP",
            label: "[일식·초밥/회] 모둠 초밥(10~12피스) 또는 회덮밥 정식",
            detail: "생선초밥 1세트 또는 활어 회덮밥 1인분 (약 740 kcal)",
            caloriesKcal: 740,
            proteinG: 34,
            carbsG: 104,
            fatG: 18
        },
        {
            code: "LC_JP_DONBURI_RAMEN",
            label: "[일식·덮밥/라멘] 규동·가츠동·연어덮밥(사케동) 또는 돈코츠라멘",
            detail: "일식 덮밥류 또는 라멘 1그릇 평균 (약 860 kcal)",
            caloriesKcal: 860,
            proteinG: 33,
            carbsG: 108,
            fatG: 32
        },
        {
            code: "LC_CN_JJAJANG_JJAMPPONG",
            label: "[중식·면/밥] 짜장면 / 짬뽕 / 중화 볶음밥 (단품 1인분)",
            detail: "중식당 면·볶음밥 단품 1그릇 평균 (약 890 kcal)",
            caloriesKcal: 890,
            proteinG: 24,
            carbsG: 128,
            fatG: 31
        },
        {
            code: "LC_CN_TANGSUYUK_SET",
            label: "[중식·세트] 짜장·짬뽕 + 미니 탕수육/군만두 1인 세트",
            detail: "식사 1그릇 + 튀김 사이드 포함 중식 세트 (약 1,220 kcal)",
            caloriesKcal: 1220,
            proteinG: 36,
            carbsG: 154,
            fatG: 50
        },
        {
            code: "LC_CN_MALATANG",
            label: "[중식·마라] 마라탕 / 마라샹궈 (소고기·두부·채소 1인분)",
            detail: "소고기 추가·두부·청경채·버섯 위주 마라탕 1인분 (약 880 kcal)",
            caloriesKcal: 880,
            proteinG: 33,
            carbsG: 86,
            fatG: 44
        },
        {
            code: "LC_BUNSIK_KIMBAP_RAMYUN",
            label: "[분식·김밥/라면] 일반·참치·김치 김밥 1줄 + 라면 또는 떡볶이",
            detail: "분식집 김밥 1줄(460kcal) + 라면/떡볶이 반 인분(430kcal)",
            caloriesKcal: 890,
            proteinG: 23,
            carbsG: 136,
            fatG: 28
        },
        {
            code: "LC_NOODLE_KALGUKSU_NAENGMYEON",
            label: "[면류·국수] 칼국수 / 수제비 / 만둣국 / 물·비빔냉면",
            detail: "한식 면·만둣국류 1그릇 평균 (약 760 kcal)",
            caloriesKcal: 760,
            proteinG: 26,
            carbsG: 122,
            fatG: 18
        },
        {
            code: "LC_ASIAN_PHO_PADTHAI",
            label: "[아시안·쌀국수] 베트남 소고기 쌀국수 / 팟타이 / 나시고랭",
            detail: "양지·차돌 쌀국수 또는 동남아 볶음면/밥 1인분 (약 740 kcal)",
            caloriesKcal: 740,
            proteinG: 30,
            carbsG: 106,
            fatG: 20
        },
        {
            code: "LC_WEST_PASTA_RISOTTO",
            label: "[양식·이탈리안] 파스타(토마토·크림·오일) / 리조또 / 필라프",
            detail: "이탈리안 레스토랑 파스타·리조또 1인분 평균 (약 850 kcal)",
            caloriesKcal: 850,
            proteinG: 26,
            carbsG: 104,
            fatG: 36
        },
        {
            code: "LC_FAST_BURGER_SET",
            label: "[패스트푸드] 수제버거 / 치킨·불고기 버거 세트 (감자튀김 포함)",
            detail: "버거 단품(560kcal) + 감자튀김·음료 포함 세트 (약 960 kcal)",
            caloriesKcal: 960,
            proteinG: 33,
            carbsG: 112,
            fatG: 42
        },
        {
            code: "LC_DIET_BOX_SALAD",
            label: "[다이어트·포케/도시락] 닭가슴살·연어 포케 / 서브웨이 / 식단 도시락",
            detail: "탄수화물 절제형 클린 점심 식단 (약 550 kcal / 단백질 36g)",
            caloriesKcal: 550,
            proteinG: 36,
            carbsG: 55,
            fatG: 18
        }
    ],
    FIXED_DRINK_PRESETS: [
        {
            code: "DR_GS25_BARISTA_174",
            label: "[컵커피] GS25 바리스타 커피 (250ml 컵커피)",
            detail: "편의점 바리스타 로슈거/에스프레소 라떼 기준 (174 kcal)",
            caloriesKcal: 174,
            proteinG: 5,
            carbsG: 24,
            fatG: 6
        },
        {
            code: "DR_CUP_COFFEE_LARGE",
            label: "[컵커피] 대용량 편의점 컵커피 (300ml+ 라떼·모카류)",
            detail: "300ml 이상 대용량 컵커피 평균 (215 kcal)",
            caloriesKcal: 215,
            proteinG: 6,
            carbsG: 30,
            fatG: 7
        },
        {
            code: "DR_CAFE_LATTE",
            label: "[라떼] 일반 카페라떼 / 카푸치노 / 플랫화이트 (시럽 없음)",
            detail: "우유 + 에스프레소 카페라떼 1잔 (180 kcal)",
            caloriesKcal: 180,
            proteinG: 9,
            carbsG: 14,
            fatG: 9
        },
        {
            code: "DR_OAT_SOY_LATTE",
            label: "[대체유 라떼] 오트(귀리) 라떼 / 두유 라떼 (톨 사이즈)",
            detail: "귀리우유 또는 두유 베이스 라떼 1잔 (160 kcal)",
            caloriesKcal: 160,
            proteinG: 5,
            carbsG: 22,
            fatG: 5
        },
        {
            code: "DR_SWEET_LATTE",
            label: "[달콤 커피] 바닐라라떼 / 연유(돌체)라떼 / 카라멜마키아또 / 카페모카",
            detail: "시럽·연유·초콜릿 포함 달콤한 커피 음료 1잔 (270 kcal)",
            caloriesKcal: 270,
            proteinG: 8,
            carbsG: 38,
            fatG: 9
        },
        {
            code: "DR_MIX_COFFEE_1",
            label: "[믹스커피] 사무실 믹스커피(다방커피) 1봉",
            detail: "커피믹스 1스틱 기준 (55 kcal)",
            caloriesKcal: 55,
            proteinG: 0,
            carbsG: 9,
            fatG: 2
        },
        {
            code: "DR_MIX_COFFEE_2",
            label: "[믹스커피] 사무실 믹스커피(다방커피) 2봉",
            detail: "하루 커피믹스 2스틱 섭취 기준 (110 kcal)",
            caloriesKcal: 110,
            proteinG: 1,
            carbsG: 18,
            fatG: 4
        },
        {
            code: "DR_PROTEIN_RTD",
            label: "[단백질 음료] 편의점 단백질 음료 1팩 (더단백·셀렉스·하이뮨 등)",
            detail: "RTD 단백질 드링크 250ml 1팩 (145 kcal / 단백질 20g)",
            caloriesKcal: 145,
            proteinG: 20,
            carbsG: 6,
            fatG: 3
        },
        {
            code: "DR_WHEY_SHAKE_1SCOOP",
            label: "[프로틴 쉐이크] 유청 단백질 파우더(WPI/WPC) 1스쿱 + 물/우유",
            detail: "보충제 파우더 1스쿱 쉐이크 평균 (180 kcal / 단백질 27g)",
            caloriesKcal: 180,
            proteinG: 27,
            carbsG: 10,
            fatG: 3
        },
        {
            code: "DR_COFFEE_AND_PROBAR",
            label: "[커피+간식] 아메리카노 + 단백질바/견과류 1봉",
            detail: "블랙커피(10kcal) + 프로틴바/하루견과 1봉(195kcal)",
            caloriesKcal: 205,
            proteinG: 14,
            carbsG: 20,
            fatG: 8
        },
        {
            code: "DR_ICETEA_MILKTEA",
            label: "[티·라떼] 복숭아 아이스티 / 밀크티 / 말차(녹차)라떼",
            detail: "당류 포함 티·밀크티 음료 1잔 평균 (240 kcal)",
            caloriesKcal: 240,
            proteinG: 5,
            carbsG: 42,
            fatG: 6
        },
        {
            code: "DR_FRUIT_SMOOTHIE_ADE",
            label: "[과일·에이드] 과일 에이드 / 요거트 스무디 / 생과일 주스",
            detail: "과일청·시럽 베이스 음료 1잔 평균 (290 kcal)",
            caloriesKcal: 290,
            proteinG: 2,
            carbsG: 66,
            fatG: 2
        },
        {
            code: "DR_AMERICANO_ZERO",
            label: "[블랙·무칼로리] 아메리카노 / 제로 칼로리 탄산 / 녹차·물",
            detail: "당류·지방 없는 무칼로리 음료 (5 kcal)",
            caloriesKcal: 5,
            proteinG: 0,
            carbsG: 1,
            fatG: 0
        }
    ]
};

/**
 * 사용자가 직접 입력한 음식명/식단 텍스트(예: "계란 2개, 사과 반쪽, 우유" 또는 "육회비빔밥", "순대국밥, 만두 3개")를
 * 분석하여 평균적인 칼로리(kcal)와 단백질·탄수화물·지방(g)을 자동 추정하는 영양 사전 및 파서
 */
export class SmartFoodCalorieEstimator {
    static FOOD_DB = [
        // 1. 계란 · 닭가슴살 · 두부 · 단백질 단품
        { keys: ["프로틴쉐이크", "단백질쉐이크", "단백질보충제", "프로틴", "쉐이크", "wpi", "wpc"], name: "단백질 쉐이크", unit: "스쿱", kcal: 150, pro: 25, carb: 6, fat: 2 },
        { keys: ["더단백", "셀렉스", "하이뮨", "단백질음료", "프로틴음료"], name: "단백질 음료(RTD)", unit: "팩", kcal: 145, pro: 20, carb: 6, fat: 3 },
        { keys: ["단백질바", "프로틴바", "에너지바"], name: "단백질바", unit: "개", kcal: 195, pro: 14, carb: 20, fat: 7 },
        { keys: ["계란프라이", "계란후라이", "달걀프라이", "달걀후라이"], name: "계란프라이", unit: "개", kcal: 85, pro: 6, carb: 1, fat: 6 },
        { keys: ["계란말이", "달걀말이", "계란찜"], name: "계란말이/찜(1인분)", unit: "인분", kcal: 170, pro: 13, carb: 4, fat: 11 },
        { keys: ["삶은계란", "구운계란", "훈제란", "감동란", "반숙란", "계란", "달걀"], name: "계란", unit: "개", kcal: 70, pro: 6, carb: 1, fat: 5 },
        { keys: ["닭가슴살소시지", "닭가슴살볼", "닭가슴살스테이크"], name: "닭가슴살 가공품(1팩)", unit: "팩", kcal: 155, pro: 22, carb: 8, fat: 4 },
        { keys: ["닭가슴살샐러드"], name: "닭가슴살 샐러드", unit: "그릇", kcal: 360, pro: 30, carb: 26, fat: 14 },
        { keys: ["닭가슴살"], name: "닭가슴살(100g 1팩)", unit: "팩", kcal: 120, pro: 25, carb: 2, fat: 2 },
        { keys: ["두부부침", "두부김치"], name: "두부요리", unit: "인분", kcal: 320, pro: 20, carb: 16, fat: 18 },
        { keys: ["연두부", "순두부", "두부"], name: "두부(1/2모 기준)", unit: "모", kcal: 130, pro: 12, carb: 4, fat: 7 },
        { keys: ["낫또", "나또"], name: "낫또", unit: "팩", kcal: 100, pro: 8, carb: 6, fat: 5 },

        // 2. 과일 · 구황작물 · 곡물 · 시리얼 · 빵 · 떡
        { keys: ["군고구마", "찐고구마", "고구마"], name: "고구마(중 1개 150g)", unit: "개", kcal: 195, pro: 3, carb: 45, fat: 0 },
        { keys: ["감자", "찐감자", "구운감자"], name: "감자(중 1개)", unit: "개", kcal: 110, pro: 3, carb: 25, fat: 0 },
        { keys: ["단호박", "미니단호박"], name: "단호박(150g)", unit: "개", kcal: 105, pro: 2, carb: 24, fat: 0 },
        { keys: ["사과"], name: "사과", unit: "개", kcal: 110, pro: 1, carb: 28, fat: 0 },
        { keys: ["바나나"], name: "바나나", unit: "개", kcal: 105, pro: 1, carb: 27, fat: 0 },
        { keys: ["방울토마토", "토마토"], name: "토마토(1회분)", unit: "접시", kcal: 35, pro: 1, carb: 8, fat: 0 },
        { keys: ["귤", "오렌지", "천혜향", "한라봉"], name: "감귤/오렌지", unit: "개", kcal: 65, pro: 1, carb: 16, fat: 0 },
        { keys: ["블루베리", "딸기", "포도", "키위", "배", "복숭아", "과일"], name: "과일(1인분)", unit: "회", kcal: 85, pro: 1, carb: 21, fat: 0 },
        { keys: ["오트밀", "귀리"], name: "오트밀(1회분 45g)", unit: "회", kcal: 175, pro: 6, carb: 30, fat: 3 },
        { keys: ["그래놀라", "시리얼", "콘푸라이트", "첵스"], name: "시리얼/그래놀라(1회분)", unit: "회", kcal: 230, pro: 5, carb: 42, fat: 5 },
        { keys: ["그릭요거트"], name: "그릭요거트(120g)", unit: "개", kcal: 140, pro: 12, carb: 8, fat: 6 },
        { keys: ["요거트", "요플레", "비요뜨"], name: "일반 요거트", unit: "개", kcal: 135, pro: 5, carb: 21, fat: 4 },
        { keys: ["무가당두유", "약콩두유", "두유"], name: "두유(190ml)", unit: "팩", kcal: 105, pro: 7, carb: 8, fat: 5 },
        { keys: ["저지방우유", "우유"], name: "우유(200ml)", unit: "컵", kcal: 125, pro: 6, carb: 10, fat: 7 },
        { keys: ["아몬드브리즈", "오트사이드", "귀리우유"], name: "식물성 음료(190ml)", unit: "팩", kcal: 65, pro: 2, carb: 9, fat: 2 },
        { keys: ["견과류", "하루견과", "아몬드", "호두", "땅콩"], name: "견과류(1봉 25g)", unit: "봉", kcal: 145, pro: 5, carb: 5, fat: 13 },
        { keys: ["땅콩버터", "피넛버터"], name: "땅콩버터(1큰술)", unit: "스푼", kcal: 95, pro: 4, carb: 3, fat: 8 },
        { keys: ["베이글"], name: "베이글", unit: "개", kcal: 280, pro: 9, carb: 54, fat: 3 },
        { keys: ["크림치즈"], name: "크림치즈(1회분)", unit: "회", kcal: 100, pro: 2, carb: 2, fat: 10 },
        { keys: ["식빵", "토스트", "호밀빵", "통밀빵", "모닝빵"], name: "식빵/통밀빵(1장)", unit: "장", kcal: 110, pro: 4, carb: 20, fat: 2 },
        { keys: ["크루아상", "소금빵", "단팥빵", "소보로빵", "크림빵", "빵"], name: "베이커리 빵", unit: "개", kcal: 290, pro: 6, carb: 42, fat: 11 },
        { keys: ["서브웨이"], name: "서브웨이 샌드위치(15cm)", unit: "개", kcal: 420, pro: 28, carb: 44, fat: 14 },
        { keys: ["샌드위치", "에그드랍", "이삭토스트"], name: "샌드위치/토스트", unit: "개", kcal: 410, pro: 20, carb: 44, fat: 17 },
        { keys: ["삼각김밥"], name: "삼각김밥", unit: "개", kcal: 185, pro: 4, carb: 34, fat: 3 },
        { keys: ["김밥", "참치김밥", "키토김밥"], name: "김밥(1줄)", unit: "줄", kcal: 460, pro: 14, carb: 72, fat: 13 },
        { keys: ["떡", "백설기", "인절미", "절편", "가래떡"], name: "떡(1인분)", unit: "회", kcal: 260, pro: 5, carb: 56, fat: 2 },
        { keys: ["선식", "미숫가루"], name: "미숫가루/선식(1잔)", unit: "잔", kcal: 210, pro: 7, carb: 36, fat: 4 },

        // 3. 한식 밥 · 국밥 · 탕 · 찌개 · 백반 · 고기 · 생선
        { keys: ["현미밥", "잡곡밥", "오곡밥", "곤약밥"], name: "잡곡/현미밥(1공기)", unit: "공기", kcal: 290, pro: 6, carb: 63, fat: 2 },
        { keys: ["공기밥", "흰쌀밥", "쌀밥", "햇반", "밥"], name: "쌀밥(1공기)", unit: "공기", kcal: 300, pro: 5, carb: 66, fat: 1 },
        { keys: ["설렁탕", "곰탕", "도가니탕", "꼬리곰탕"], name: "설렁탕/곰탕(밥 포함)", unit: "그릇", kcal: 880, pro: 34, carb: 96, fat: 38 },
        { keys: ["갈비탕", "왕갈비탕"], name: "갈비탕(밥 포함)", unit: "그릇", kcal: 920, pro: 42, carb: 94, fat: 40 },
        { keys: ["삼계탕", "반계탕", "닭곰탕", "닭한마리"], name: "삼계탕/닭곰탕", unit: "그릇", kcal: 910, pro: 52, carb: 86, fat: 38 },
        { keys: ["돼지국밥", "순대국밥", "순댓국", "내장탕", "소머리국밥", "국밥"], name: "국밥(밥 포함)", unit: "그릇", kcal: 960, pro: 42, carb: 102, fat: 42 },
        { keys: ["뼈해장국", "감자탕", "선지해장국", "해장국", "육개장", "추어탕", "매운탕", "동태탕"], name: "해장국/육개장(밥 포함)", unit: "그릇", kcal: 890, pro: 38, carb: 96, fat: 36 },
        { keys: ["부대찌개"], name: "부대찌개 정식(밥 포함)", unit: "인분", kcal: 920, pro: 32, carb: 110, fat: 38 },
        { keys: ["김치찌개", "참치김치찌개", "돼지김치찌개"], name: "김치찌개 정식(밥 포함)", unit: "인분", kcal: 840, pro: 30, carb: 102, fat: 32 },
        { keys: ["순두부찌개", "차돌순두부", "해물순두부"], name: "순두부찌개 정식(밥 포함)", unit: "인분", kcal: 810, pro: 31, carb: 98, fat: 30 },
        { keys: ["된장찌개", "청국장", "차돌된장"], name: "된장/청국장 정식(밥 포함)", unit: "인분", kcal: 760, pro: 27, carb: 100, fat: 25 },
        { keys: ["육회비빔밥"], name: "육회비빔밥", unit: "그릇", kcal: 780, pro: 34, carb: 106, fat: 23 },
        { keys: ["돌솥비빔밥", "비빔밥", "보리밥", "열무비빔밥", "꼬막비빔밥"], name: "비빔밥", unit: "그릇", kcal: 760, pro: 25, carb: 112, fat: 22 },
        { keys: ["제육덮밥", "제육볶음", "돼지불백", "불백"], name: "제육볶음/불백 정식", unit: "인분", kcal: 920, pro: 38, carb: 106, fat: 36 },
        { keys: ["오징어볶음", "낙지볶음", "쭈꾸미볶음", "쭈꾸미"], name: "낙지/쭈꾸미/오징어볶음 정식", unit: "인분", kcal: 830, pro: 34, carb: 108, fat: 26 },
        { keys: ["불고기", "소불고기", "뚝배기불고기"], name: "소불고기 정식", unit: "인분", kcal: 860, pro: 38, carb: 98, fat: 32 },
        { keys: ["보쌈", "수육", "족발"], name: "보쌈/수육/족발 정식", unit: "인분", kcal: 960, pro: 45, carb: 88, fat: 46 },
        { keys: ["삼겹살", "목살", "갈비", "소고기구이"], name: "고기구이 식사(1인분)", unit: "인분", kcal: 980, pro: 42, carb: 70, fat: 58 },
        { keys: ["생선구이", "고등어구이", "삼치구이", "갈치구이", "임연수"], name: "생선구이 백반 정식", unit: "인분", kcal: 780, pro: 40, carb: 90, fat: 27 },
        { keys: ["닭갈비", "찜닭"], name: "닭갈비/찜닭 식사", unit: "인분", kcal: 920, pro: 43, carb: 108, fat: 33 },
        { keys: ["백반", "한식뷔페", "구내식당"], name: "구내식당/한식 백반 정식", unit: "인분", kcal: 940, pro: 30, carb: 120, fat: 36 },

        // 4. 일식 · 중식 · 면류 · 분식 · 양식 · 패스트푸드 · 포케
        { keys: ["치즈돈까스", "왕돈까스", "돈까스", "돈가스", "생선까스"], name: "돈까스 정식", unit: "인분", kcal: 1010, pro: 35, carb: 114, fat: 45 },
        { keys: ["초밥", "스시"], name: "모둠 초밥(10~12피스)", unit: "세트", kcal: 720, pro: 33, carb: 105, fat: 16 },
        { keys: ["회덮밥", "연어덮밥", "사케동", "카이센동"], name: "회덮밥/연어덮밥", unit: "그릇", kcal: 760, pro: 34, carb: 98, fat: 22 },
        { keys: ["규동", "가츠동", "텐동", "차슈동", "덮밥"], name: "일식 덮밥", unit: "그릇", kcal: 860, pro: 32, carb: 112, fat: 30 },
        { keys: ["라멘", "돈코츠라멘", "우동", "메밀소바", "소바"], name: "일식 라멘/우동/소바", unit: "그릇", kcal: 790, pro: 26, carb: 106, fat: 28 },
        { keys: ["짜장면", "간짜장"], name: "짜장면", unit: "그릇", kcal: 860, pro: 22, carb: 132, fat: 27 },
        { keys: ["짬뽕", "차돌짬뽕"], name: "짬뽕", unit: "그릇", kcal: 840, pro: 28, carb: 112, fat: 29 },
        { keys: ["중국집볶음밥", "새우볶음밥", "김치볶음밥", "볶음밥"], name: "볶음밥", unit: "그릇", kcal: 880, pro: 24, carb: 122, fat: 32 },
        { keys: ["탕수육", "꿔바로우", "유린기", "깐풍기"], name: "탕수육/중식튀김(1인 곁들임)", unit: "인분", kcal: 480, pro: 18, carb: 52, fat: 22 },
        { keys: ["마라탕", "마라샹궈"], name: "마라탕/마라샹궈(1인분)", unit: "그릇", kcal: 880, pro: 33, carb: 86, fat: 44 },
        { keys: ["쌀국수", "베트남쌀국수", "팟타이"], name: "베트남 쌀국수/팟타이", unit: "그릇", kcal: 720, pro: 29, carb: 102, fat: 19 },
        { keys: ["칼국수", "수제비", "잔치국수", "비빔국수", "막국수", "콩국수", "냉면", "물냉면", "비빔냉면"], name: "국수/칼국수/냉면", unit: "그릇", kcal: 750, pro: 24, carb: 124, fat: 16 },
        { keys: ["떡만둣국", "만둣국", "떡국"], name: "떡만둣국", unit: "그릇", kcal: 780, pro: 26, carb: 118, fat: 22 },
        { keys: ["군만두", "찐만두", "고기만두", "김치만두", "만두"], name: "만두(1알 기준, 기본 4알 시 수량 입력)", unit: "개", kcal: 65, pro: 3, carb: 7, fat: 3 },
        { keys: ["라면", "컵라면", "신라면"], name: "라면", unit: "개", kcal: 500, pro: 10, carb: 78, fat: 16 },
        { keys: ["떡볶이", "로제떡볶이", "순대"], name: "떡볶이/순대(1인분)", unit: "인분", kcal: 620, pro: 15, carb: 108, fat: 14 },
        { keys: ["파스타", "스파게티", "크림파스타", "토마토파스타", "오일파스타", "리조또"], name: "파스타/리조또", unit: "접시", kcal: 850, pro: 26, carb: 104, fat: 36 },
        { keys: ["피자"], name: "피자(2조각 기준)", unit: "회", kcal: 640, pro: 26, carb: 72, fat: 28 },
        { keys: ["치킨", "양념치킨", "후라이드치킨", "구운치킨"], name: "치킨(반 마리 기준)", unit: "회", kcal: 890, pro: 52, carb: 48, fat: 54 },
        { keys: ["햄버거세트", "버거세트"], name: "햄버거 세트", unit: "세트", kcal: 960, pro: 33, carb: 112, fat: 42 },
        { keys: ["햄버거", "수제버거", "싸이버거", "불고기버거", "치즈버거", "버거"], name: "햄버거 단품", unit: "개", kcal: 560, pro: 26, carb: 52, fat: 27 },
        { keys: ["포케", "연어포케", "닭가슴살포케", "샐러드볼", "샐러드", "다이어트도시락"], name: "포케/다이어트 샐러드 도시락", unit: "그릇", kcal: 520, pro: 35, carb: 52, fat: 18 },

        // 5. 커피 · 음료 · 간식
        { keys: ["바리스타", "컵커피", "프렌치카페", "매일카페라떼"], name: "편의점 컵커피", unit: "개", kcal: 174, pro: 5, carb: 24, fat: 6 },
        { keys: ["바닐라라떼", "돌체라떼", "연유라떼", "카라멜마키아또", "카페모카", "모카"], name: "바닐라/돌체/모카 라떼", unit: "잔", kcal: 275, pro: 8, carb: 38, fat: 9 },
        { keys: ["오트라떼", "귀리라떼", "두유라떼", "소이라떼"], name: "오트/두유 라떼", unit: "잔", kcal: 160, pro: 5, carb: 22, fat: 5 },
        { keys: ["카페라떼", "카푸치노", "플랫화이트", "라떼"], name: "카페라떼", unit: "잔", kcal: 180, pro: 9, carb: 14, fat: 9 },
        { keys: ["믹스커피", "커피믹스", "다방커피"], name: "믹스커피", unit: "잔", kcal: 55, pro: 0, carb: 9, fat: 2 },
        { keys: ["아메리카노", "아아", "뜨아", "블랙커피", "콜드브루", "에스프레소"], name: "아메리카노/블랙커피", unit: "잔", kcal: 10, pro: 0, carb: 2, fat: 0 },
        { keys: ["밀크티", "버블티", "공차", "말차라떼", "녹차라떼", "고구마라떼", "초코라떼"], name: "밀크티/논커피 라떼", unit: "잔", kcal: 280, pro: 6, carb: 46, fat: 8 },
        { keys: ["아이스티", "복숭아아이스티", "에이드", "레몬에이드", "자몽에이드", "스무디", "주스", "과일주스"], name: "에이드/아이스티/스무디", unit: "잔", kcal: 250, pro: 1, carb: 58, fat: 1 },
        { keys: ["제로콜라", "제로사이다", "제로음료", "탄산수", "녹차", "보리차"], name: "제로 음료/차", unit: "잔", kcal: 0, pro: 0, carb: 0, fat: 0 },
        { keys: ["콜라", "사이다", "환타", "탄산음료"], name: "일반 탄산음료(1캔)", unit: "캔", kcal: 140, pro: 0, carb: 35, fat: 0 }
    ];

    /**
     * 사용자가 입력한 자유 텍스트(예: "계란 3개, 사과 반개, 프로틴 1스쿱" 또는 "육회비빔밥")를 파싱하여
     * 항목별 분석 내역과 총 평균 칼로리·단백질·탄수화물·지방을 반환합니다.
     */
    static estimateFromText(rawText, categoryHint = "LUNCH") {
        const cleaned = String(rawText || "").trim();
        if (!cleaned) {
            return null;
        }

        // 쉼표(,), 플러스(+), 슬래시(/), '그리고', '랑', '와', '과' 또는 줄바꿈 기준으로 분리
        const segments = cleaned
            .split(/[,+/\n]+|(?:\s+그리고\s+)|(?:\s+및\s+)/)
            .map(s => s.trim())
            .filter(Boolean);

        const matchedItems = [];
        let totalKcal = 0;
        let totalPro = 0;
        let totalCarb = 0;
        let totalFat = 0;

        for (const seg of segments) {
            const normSeg = seg.replace(/\s+/g, "").toLowerCase();
            if (!normSeg) continue;

            // 수량 추출: "반개/반공기/반줄" -> 0.5, "2개/3알/1.5스쿱/200g" 등
            let multiplier = 1.0;
            if (/반\s*(개|알|공기|그릇|줄|쪽|잔|모|팩|인분)/.test(seg) || normSeg.includes("반공기") || normSeg.includes("반개")) {
                multiplier = 0.5;
            } else if (normSeg.includes("곱빼기") || normSeg.includes("특대") || normSeg.includes("대짜")) {
                multiplier = 1.35;
            } else {
                const gMatch = seg.match(/(\d+(?:\.\d+)?)\s*(?:g|그램|ml|미리)/i);
                const countMatch = seg.match(/(\d+(?:\.\d+)?)\s*(?:개|알|스쿱|스푼|봉|팩|잔|컵|병|캔|공기|그릇|줄|장|조각|마리|인분|접시|세트|모)?/);
                if (gMatch) {
                    const grams = parseFloat(gMatch[1]);
                    if (grams >= 30 && grams <= 1000) {
                        multiplier = Math.max(0.3, Math.min(4.0, grams / 120));
                    }
                } else if (countMatch) {
                    const num = parseFloat(countMatch[1]);
                    if (num > 0 && num <= 15) {
                        multiplier = num;
                    }
                }
            }

            let foundEntry = null;
            let bestKeyLen = 0;
            for (const entry of this.FOOD_DB) {
                for (const k of entry.keys) {
                    if (normSeg.includes(k) && k.length > bestKeyLen) {
                        foundEntry = entry;
                        bestKeyLen = k.length;
                    }
                }
            }

            if (foundEntry) {
                // 만두 단품인데 수량 지정이 없으면 기본 4개(1인분 사이드)로 보정
                if (foundEntry.name.startsWith("만두") && multiplier === 1.0 && !/\d/.test(seg)) {
                    multiplier = 4;
                }
                const itemKcal = Math.round(foundEntry.kcal * multiplier);
                const itemPro = Math.round(foundEntry.pro * multiplier);
                const itemCarb = Math.round(foundEntry.carb * multiplier);
                const itemFat = Math.round(foundEntry.fat * multiplier);

                totalKcal += itemKcal;
                totalPro += itemPro;
                totalCarb += itemCarb;
                totalFat += itemFat;

                const multText = multiplier !== 1 ? ` × ${multiplier}${foundEntry.unit}` : "";
                matchedItems.push(`${foundEntry.name}${multText}(${itemKcal}kcal, 단백질 ${itemPro}g)`);
            } else {
                // 사전에 정확히 일치하지 않는 신메뉴/외식 메뉴일 경우 키워드 특징 기반 지능형 평균 추정
                let estKcal = categoryHint === "BREAKFAST" ? 380 : categoryHint === "DRINK" ? 160 : 820;
                let estPro = categoryHint === "BREAKFAST" ? 18 : categoryHint === "DRINK" ? 4 : 30;
                let estCarb = categoryHint === "BREAKFAST" ? 42 : categoryHint === "DRINK" ? 24 : 98;
                let estFat = categoryHint === "BREAKFAST" ? 14 : categoryHint === "DRINK" ? 5 : 28;

                if (/튀김|까스|치킨|버거|피자|탕수육|마라|삼겹/.test(normSeg)) {
                    estKcal = 960; estPro = 34; estCarb = 104; estFat = 44;
                } else if (/국밥|탕|전골|찌개|백반|정식|볶음|덮밥|비빔밥/.test(normSeg)) {
                    estKcal = 860; estPro = 33; estCarb = 102; estFat = 32;
                } else if (/면|국수|파스타|라멘|우동|짜장|짬뽕/.test(normSeg)) {
                    estKcal = 810; estPro = 24; estCarb = 116; estFat = 26;
                } else if (/샐러드|포케|다이어트|식단|클린/.test(normSeg)) {
                    estKcal = 480; estPro = 32; estCarb = 46; estFat = 16;
                } else if (/라떼|스무디|프라푸치노|쉐이크|주스|에이드/.test(normSeg)) {
                    estKcal = 220; estPro = 6; estCarb = 32; estFat = 6;
                }

                const itemKcal = Math.round(estKcal * multiplier);
                const itemPro = Math.round(estPro * multiplier);
                const itemCarb = Math.round(estCarb * multiplier);
                const itemFat = Math.round(estFat * multiplier);

                totalKcal += itemKcal;
                totalPro += itemPro;
                totalCarb += itemCarb;
                totalFat += itemFat;

                matchedItems.push(`${seg.trim()} 평균 추정(${itemKcal}kcal, 단백질 ${itemPro}g)`);
            }
        }

        if (matchedItems.length === 0) return null;

        return {
            rawText: cleaned,
            summaryTitle: cleaned,
            breakdownText: matchedItems.join(" + "),
            caloriesKcal: totalKcal,
            proteinG: totalPro,
            carbsG: totalCarb,
            fatG: totalFat
        };
    }
}

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

    /**
     * 특정 계정(syncKey)의 로컬 슬롯 백업을 저장하여 한 브라우저에서 여러 아이디 전환 시에도 데이터를 안전하게 격리합니다.
     */
    static saveSlotSnapshot(syncKey) {
        if (!syncKey) return;
        const snapshot = this.exportUserDataJson();
        localStorage.setItem(`gymrat_slot_${syncKey}`, JSON.stringify(snapshot));
    }

    static getSlotSnapshot(syncKey) {
        if (!syncKey) return null;
        return safeParseObject(localStorage.getItem(`gymrat_slot_${syncKey}`));
    }

    /**
     * 다른 사용자의 아이디+PIN으로 신규 계정을 생성하거나 전환할 때, 이전 사용자의 기록이 섞이지 않도록 활성 작업 공간을 초기화합니다.
     */
    static resetToCleanUserWorkspace() {
        const defaultProfStr = JSON.stringify(DEFAULT_USER_PROFILE);
        localStorage.setItem(STORAGE_KEYS.PROFILE, defaultProfStr);
        localStorage.setItem(STORAGE_KEYS.PROFILE_BACKUP, defaultProfStr);

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

        localStorage.setItem(STORAGE_KEYS.WEIGHT_RECORDS, JSON.stringify([]));
        localStorage.setItem(STORAGE_KEYS.WEIGHT_RECORDS_BACKUP, JSON.stringify([]));
        localStorage.setItem(STORAGE_KEYS.DIET_RECORDS, JSON.stringify([]));
        localStorage.setItem(STORAGE_KEYS.WORKOUT_RECORDS, JSON.stringify([]));
        localStorage.setItem(STORAGE_KEYS.DAILY_CHECKLISTS, JSON.stringify({}));
    }

    /**
     * 특정 계정의 데이터 스냅샷을 활성 로컬 스토리지에 정확히 로드합니다.
     */
    static replaceUserDataJson(incomingData) {
        this.resetToCleanUserWorkspace();
        if (!incomingData || typeof incomingData !== "object") {
            return this.exportUserDataJson();
        }
        return this.importUserDataJson(incomingData);
    }
}
