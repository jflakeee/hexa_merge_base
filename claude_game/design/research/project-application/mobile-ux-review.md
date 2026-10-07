# Claude Game 모바일 최적화·사용자 경험 전면 재설계 검토

검토일: 2026-10-07 · 저장소: https://github.com/jflakeee/claude_game

기준 커밋: `4d091f516a71fee82568a63375822ac4c96eeba5` · 대상: `docs/`의 설계·구현 계획·연구·QA Markdown 45개, 관련 현재 소스와 기존 화면 증거.

## 1. 권장 결정

**모바일에서 과업별 화면을 분리하는 재설계를 권장한다.** 현재 하단 36~38% 패널에 장비, 제작, 스킬, 설정, 상자, NPC 상인, 경매가 함께 들어가 있다. 글자와 버튼을 키우는 수정만으로는 작은 화면의 관리 공간 부족을 해결하기 어렵다.

기존 권장 B안인 화면·표현 재설계를 모바일 중심으로 구체화한다. Phaser+DOM, 픽셀 캐릭터, 방치/능동 전투의 공유 성장, 로컬 저장, 1인용 NPC 거래는 재사용한다. 모바일 홈은 탐험과 다음 목표를 보여주고, 성장과 거래는 충분한 높이의 전용 관리 화면으로 이동한다. 전투에는 이동·위험·체력·일시정지만 남긴다.

이번 결과는 **검토와 제안 설계**다. 게임 코드를 수정하거나 배포하지 않았다. 사용자 실험, 새 브라우저 플레이, 실기기 성능 측정도 수행하지 않았다. 현재 저장소를 직접 가져와 문서·소스를 대조하고, 기존 소형 모바일·모바일 전투·보스 캡처 3장을 직접 확인했다. 과거 QA 통과는 해당 버전과 환경의 증거로만 해석했다.

## 2. 설계문서의 상태와 충돌

| 항목 | 이전 문서 | 현재 확인 | 권장 정리 |
|---|---|---|---|
| 전투 진입 | 최초 설계는 액션 영역 탭 | `IdleScene.create`는 생존/보스 버튼으로 즉시 진입 | 명시적 출전으로 통일하고 준비 요약 추가. 배경 탭 진입은 폐기된 결정으로 표시 |
| 화면 비율 | 최초 상단 60~70%, 하단 30~40% | CSS는 36%, 짧은 높이에서 38%; 데스크톱은 좌우 분리 | 고정 비율을 모바일 관리의 필수 요구에서 제거. 홈과 관리의 화면 역할 정의 |
| MVP 범위 | 4등급, 패시브 1~2개; 확장은 후순위 | 6등급, 8스킬, 제작, 세트, NPC 경매 구현 | 초기 사양은 역사 문서로 유지; 현행 제품 사양을 별도로 지정 |
| 상점 | 보완 계획 앞부분은 표시만 제공 | 같은 계획 Task 24는 가챠 추가; 최신 확장은 NPC 거래 | 계획 앞부분의 범위 결정을 현행 요구로 사용하지 않음 |
| 교체 장비 | Task 18은 가방 회수, Task 22는 스크랩북 | 현행 장비/스크랩북 경로 존재 | 교체 기록·가방·복원의 위치와 비용을 일관되게 설명 |
| 방치 | 문서 표현은 자동 진행·누적 | 업데이트 기반; 앱이 닫힌 동안의 보상 집계는 확인되지 않음 | 현재는 접속 중 자동 탐험으로 설명. 오프라인 보상은 별도 제품 결정 |
| 전면 재설계 완료 | 여러 과거 문서에 구현/배포 완료 표기 | 최신 `design-gap-review.md`는 대표 구간 구현, 실기기/사용자 평가 미완료 | 기능 완료·표현 완료·실기기 검증·사용자 이해를 각각 기록 |
| 전투 폭 | 데스크톱 확대 제안과 최대 520px 유지 결정 혼재 | 현재 전투 최대 520px, 리사이즈 시 좌표 변환 | 1차는 폭 정책 유지. 화면 크기별 난도는 별도 검증 |

문서의 날짜만으로 우선순위를 정하지 않는다. 확정 사양, 제안 연구, 구현 계획, QA 결과를 구분하고 현재 코드로 구현 여부를 확인한다. 초기 계획의 사각형 캐릭터·임시 피해 코드를 현재 구현처럼 취급하지 않는다. 연구의 효과 목록은 모두 추가해야 하는 제품 요구가 아니다.

## 3. 핵심 문제와 우선순위

여기서 P0는 재설계 착수 전에 정리할 우선 항목이다. 모두 재현된 운영 장애라는 뜻은 아니다. ‘소스 확인’, ‘기존 화면 관찰’, ‘위험 가설’을 구분했다.

| ID | 우선 | 근거·현재 상태 | 사용자 영향/가설 | 제안 및 완료 조건 |
|---|---|---|---|---|
| U01 | P0 | `style.css`: 기본 버튼 최소 34px, 장비 버튼 32px, 핸들 24px/짧은 화면 20px | 반복 탭과 작은 핸들의 정밀 조작 부담 | 제품 목표 48px 주요 버튼, 44px 보조 대상. 실제 클릭 사각형·간격 검증 |
| U02 | P0 | 본문/안내/제작·경매 버튼에 10~12px 다수 | 비용·조건을 읽기 어려울 가능성 | 본문 16px, 보조 14px부터 비교. 실제 기기와 확대에서 확인 |
| U03 | P0 | 고정 비율 패널·핸들·1차/2차 메뉴가 관리 영역을 소비; 소형 캡처에서도 확인 | 핵심 장비 선택 전에 안내와 메뉴만 보일 수 있음 | 모바일 관리 전용 화면, 한 개의 주 스크롤. 기본 패널을 더 늘리는 방식만으로 종료하지 않음 |
| U04 | P0 | `index.html`에 `viewport-fit=cover` 없음, CSS safe-area 처리 없음 | 노치·홈바·브라우저 UI와 겹칠 위험 | 상하좌우 안전 여백, `100dvh` 유지, iframe 내부/외부 실제 기기 확인 |
| U05 | P0 | `CombatScene.update`는 `document.hidden`이면 반환, `main.js`는 숨김 시 저장 | 숨김 중 진행은 막지만 복귀 후 준비 없이 자동 재개. 전용 일시정지·재개 UI 없음 | 앱 복귀 시 정지 화면 유지, 재개/귀환 선택; 입력 초기화 |
| U06 | P0 | 드래그 원점은 포인터 누른 위치; up/gameout/resize 정리. cancel·pointer ID 소유 정책은 명시적이지 않음 | 다중 터치·OS 취소에서 입력 잔존 가능성, 손가락이 전장 가림 | 이동 포인터 1개 추적, 취소 시 벡터 0, 좌우 손 설정; 실기기 재현 검증 |
| U07 | P0 | `saveState`는 저장 실패를 catch 후 무통지 | 저장되는 것으로 오해한 채 진행할 수 있음 | 저장 결과 반환·상태 안내·재시도/백업. 일시 오류로 새 게임 초기화 금지 |
| U08 | P1 | 명시적 출전 버튼은 있지만 곧바로 Scene 전환 | 첫 사용자에게 목적·승리 조건·보상 차이가 충분히 설명되지 않음 | 생존 3분/보스 처치 목표, 중도 보상 유지, 현재 빌드 표시 후 시작 |
| U09 | P1 | 장비 비교·유지 잠금 구현. 자동 판단은 `statTotal` 합계 | 세트/룬/치명 교환 관계를 단순 ‘좋은 장비’로 오해할 위험 | 비교 정보 유지, 빌드 보호 기본안 실험, 자동 변경 이유와 기록 |
| U10 | P1 | 제작은 공통 장비 select 이후 감정/분해/재추첨/룬/합성. 룬 삽입 되돌림 불가 | 대상·비용·결과를 한눈에 확인하기 어려운 과업 | 장비 상세에서 가능한 작업만 제공. 파괴/영구 변경은 구체적 대상·비용 확인 |
| U11 | P1 | 결과에 장비·비교는 있으나 기본 CTA는 ‘탐험 계속’; 닫으면 `lastResult=null` | 보상 활용·다음 준비로 연결이 약하고 재열람 불가 | 결과→장비 상세/성장/재도전 연결. 최근 결과를 제한 저장 |
| U12 | P1 | `BottomPanel`은 변경 HTML 전체 교체. 포인터/select/포커스/스크롤 보호는 있음 | 자동 드롭 중 선택 위치 이동·DOM 교체 부담; 실제 오탭은 미재현 | item ID 기반 부분 갱신, 신규 획득 묶음, 선택 중 정렬 고정 |
| U13 | P1 | 최신 성능 QA에 전투 약 18fps, 4배 제한 약 17fps. 호스트 영향 미분리 | 모바일 최적화 완료를 입증하지 못함 | 실기기 병목 측정 후 DOM/HUD/Graphics 비용 개선 |
| U14 | P2 | 기존 보상 분포는 계산 완료, 실제 수입/시간 측정 미완료 | 능동 전투를 할 이유가 흐릴 수 있음 | 방치/생존/보스의 시간당 유용 보상과 위험을 실측 후 조정 |

44/48px와 14/16px는 이번 프로젝트의 비교 시작 목표다. WCAG AA가 모든 버튼에 44px를 요구한다는 의미가 아니다. W3C SC 2.5.8의 기본 대상 기준은 24×24 CSS px이며 간격 등 예외가 있다. 실제 표준 준수 판정에는 크기 외 조건을 검사해야 한다.

## 4. 모바일 정보 구조

권장 하단 내비게이션은 **탐험 / 성장 / 거래** 3개로 시작한다. 설정은 상단의 충분한 터치 대상에서 연다. 기존 기능은 성장·거래 내부에 모두 연결하고, 기능이 있는지 모른 채 숨겨지지 않도록 목표 카드와 조건 안내를 제공한다.

| 화면 | 사용자가 답할 질문 | 기본 내용 | 주요 행동 |
|---|---|---|---|
| 탐험 홈 | 지금 무엇이 진행되고 다음에 무엇을 할까? | 접속 중 탐험 상태, 현재 지역, 한 개의 다음 목표, 새 획득 요약 | 전투 준비, 새 장비 확인 |
| 성장 | 무엇을 바꾸면 내 캐릭터가 어떻게 달라질까? | 장비 3슬롯, 가방, 스킬 포인트, 활성 오라/저주 | 비교→장착/감정, 스킬 투자 |
| 장비 상세 | 이 장비를 쓸 이유와 비용은? | 현재/후보 변화, 세트·룬 효과, 감정·소켓 상태 | 장착 또는 감정. 제작 작업은 관련 항목만 표시 |
| 제작 | 무엇을 소비하고 무엇을 얻을까? | 선택 재료의 실물 카드, 총비용, 결과, 되돌림 여부 | 명시적 재료 선택→확인→제작 |
| 거래 | 무엇을 사고팔고 받을까? | NPC 상인 기본, 상자·경매 별도 메뉴, 수령함 배지 | 구매, 수령, 판매/되사기 |
| 출전 준비 | 어떤 목표의 전투이며 준비됐을까? | 생존/보스 목표, 제한시간, 핵심 빌드, 보상 정책 | 시작, 장비 변경 |
| 전투 | 어디로 움직여야 안전할까? | HP, 목표/타이머, 우선 위험 경고, 정지 버튼 | 이동, 일시정지 |
| 결과 | 무엇을 얻었고 다음에 무엇을 바꿀까? | 결과 이유, 실제 보상/보관 위치, 핵심 장비 변화 | 장비 확인, 재도전, 탐험 복귀 |

모바일 홈에서는 탐험 시각 영역을 중심으로 유지하되 고정 60/40 비율을 요구하지 않는다. 성장·거래를 열면 큰 관리 화면을 쓰고 탐험은 뒤에서 계속된다. 필요하면 작은 ‘탐험 중’ 요약만 유지한다. 관리 화면의 확대/축소 때문에 탐험 판정 공간까지 계속 리사이즈하는 구조를 피한다.

작은 화면에서 목표·안내를 단순 숨기는 현재 높이 조건 대신 중요한 문장 한 줄과 자세히 보기로 바꾼다. 홈에 목표 카드, 자원 목록, 획득 로그, 보스 버튼을 같은 강조로 쌓지 않는다. 저장 실패는 별도의 지속 상태이며 일반 드롭 알림이 덮어쓰지 않는다.

## 5. 핵심 이용 흐름

### 첫 플레이

접속하면 자동 탐험이 시작되고 ‘이동과 공격은 자동입니다’ 한 줄을 보여준다. 첫 유용 장비를 얻으면 보관/자동 장착 위치와 실제 변화만 안내한다. 자동으로 이미 장착된 장비를 다시 장착시키는 과업은 만들지 않는다. 첫 스킬 포인트가 생기면 사용 가능한 스킬과 투자 전후 효과를 연결한다.

첫 생존 도전은 준비 화면에서 이동만 조작한다는 점과 3분 생존 목표, 중도 귀환 시 획득분 유지 정책을 설명한다. 제작과 경매는 관련 장비/재료/목표가 생길 때 문맥에서 소개한다. 기존 숙련 사용자에게는 빠른 접근과 안내 건너뛰기를 제공한다. 기능 해금 조건은 기존 기능 접근을 강제로 차단하는 규칙 변경과 구분한다.

### 장비 성장

획득 요약→가방의 해당 ID→상세 비교→장착→변화 요약으로 연결한다. 장착 후 공격·방어·치명·회복·세트 변화 중 실제 달라진 것만 보여준다. 미감정 장비는 비교 불가 이유와 정확한 감정 비용을 보여주고 감정 후 같은 상세 화면에서 비교한다.

‘자동 장착 최소 등급’은 모든 등급을 차례로 순환해야 하는 버튼에서 직접 선택 가능한 메뉴로 변경한다. 유지 잠금 기능은 보존한다. 새 기본 정책 후보는 세트/룬 효과 손실 시 자동 변경을 보류하는 방식이며, 단순 공격+방어 합계를 승률 보장으로 표현하지 않는다. 기본값 변경은 기존 저장본을 강제로 교체하거나 재평가하지 않는다.

### 제작과 거래

가방 상세에서 감정/룬 새기기/분해 등의 가능한 행동을 연다. 합성은 현재의 ‘목록 첫 3개’ 대신 사용자가 3개를 선택하고 재료·결과 슬롯을 확인하는 안을 권장한다. 이는 UI만 바꾸는 작업이 아니라 `cubeUpgrade`의 입력 계약과 테스트를 함께 바꾸는 범위다. 장착품·미감정품·소켓품의 기존 보호 규칙을 유지한다.

분해, 룬 삽입, 고가 구매처럼 손실이 큰 동작의 확인창에는 ‘계속할까요?’ 대신 장비명·소비·되돌림 가능성을 표시한다. 일반 장착과 화면 이동에는 반복 확인을 붙이지 않는다. 판매는 되사기 가능 범위/비용을 설명하고, 경매에는 NPC 거래·예치·환불·수령 위치를 유지한다. 가방이 가득 차면 구매 전 안내하고 낙찰품은 기존 대기 보관 정책을 따른다.

### 전투·정지·복귀

출전 준비→전투→일시정지→재개 또는 귀환→한 번 정산→결과로 설계한다. 앱 숨김·포커스 상실·큰 방향 전환에서는 진행을 정지하고 드래그 상태를 비운다. 복귀하면 전장을 볼 수 있는 정지 화면에서 사용자가 ‘계속’을 눌러 재개한다. 페이지 재로딩은 현행 중단 정산을 유지하고 진행 중 전투 재개와 혼동하지 않는다.

생존은 시간 생존이 승리 조건이며 보스는 처치가 승리 조건이다. 보스 HUD는 ‘남은 시간’보다 보스 HP와 목표를 먼저 읽게 한다. 정지 메뉴에서 귀환 시 현재 획득분이 유지되고 클리어 추가 보상은 지급되지 않음을 설명한다. HP 0/제한시간/보스 처치가 겹치는 종료 경계는 규칙의 단일 정산 계약으로 처리한다.

### 결과와 재도전

결과 이유→골드/XP/재료→핵심 장비→다음 행동 순서로 구성한다. 나가기/패배/시간 초과/앱 재로딩을 같은 모호한 실패 문구로 합치지 않는다. 피해 원인을 기록하지 않은 현재 데이터로 ‘방어력이 부족해서 졌다’고 단정하지 않는다. 실패 진단을 도입하면 최근 피격 원인·패턴 등 근거 필드를 추가한다.

닫기는 보상 회수와 별개이며 현재처럼 정산이 먼저 끝나야 한다. 최근 결과는 예를 들어 10건 제한으로 저장하고 해당 장비가 이미 분해/판매되었으면 현재 위치를 다시 조회한다. 자동 장착된 여러 보상을 각각 시작 장비와 비교한 값을 최종 빌드 변화처럼 합산하지 않는다. 최종 캐릭터의 전후 비교와 개별 물품 비교를 구분한다.

## 6. 화면·입력·접근성 규칙

| 대상 | 제안 시작값/정책 | 검증 |
|---|---|---|
| 주요 버튼 | 높이 48px, 보조 44px, 인접 간격 8px부터 비교 | 실제 히트 영역과 작은 화면 밀도 확인 |
| 문자 | 본문 16px, 보조 14px, 한국어 줄높이 1.5~1.6 | 긴 장비명·큰 재화·글자 확대에서 줄바꿈 |
| 안전 여백 | viewport와 CSS env 안전 여백 적용 | 노치·홈바·주소창 표시/숨김·iframe |
| 스크롤 | 관리 화면별 한 개 주 스크롤, CTA는 공간을 예약 | 결과 장비 안의 스크롤과 화면 스크롤 중첩 최소화 |
| 내비게이션 | 하단 3개 항목 고정, 상세에는 닫기/뒤로 | 뒤로 이동 시 필터·선택·스크롤 복원 |
| 포인터 | 이동 포인터 1개, cancel/up/lost/숨김/resize 때 해제 | 두 손가락, HUD 버튼 동시 입력, 경계 이탈 |
| 조이스틱 | 현재 드래그 방식 유지 후보 + 좌/우 하단 고정 방식 비교 | 엄지로 캐릭터·예고를 가리는 정도와 회피 이해 |
| 전장 경계 | HUD·안전 여백의 실측 사각형에서 arena bounds 계산 | 본문 확대·보스 경고 줄바꿈에도 가림 없음 |
| 색/모션 | 위험은 형태+색, 모션 감소와 섬광 완화 분리 | 위험·피격 정보가 낮은 품질에서도 동일 |
| 포커스 | dialog 열기/닫기와 이전 버튼 복귀, tab 연결/키보드 탐색 | VoiceOver/TalkBack 메뉴 접근, 외부 키보드 |

전투의 ‘어디서나 드래그’와 모바일 한 손 메뉴 사용을 같은 경험으로 취급하지 않는다. 전투는 엄지 가림과 화면 가장자리 제스처를 별도로 평가해야 한다. 작은 화면에서는 조이스틱 전용 넓은 하단 구역이 전투 가능 공간을 줄일 수 있어 두 입력 시안을 비교한 뒤 선택한다.

현재 `arenaBounds`는 생존 140px/보스 210px 상단 여백을 계산한다. HUD 문자만 키우면 고정 값과 실제 HUD 높이가 어긋날 수 있다. HUD 수정과 전장 경계 수정은 같은 작업으로 묶는다. 안전 여백/조이스틱을 더해도 기존 리사이즈 좌표 변환이 유지되는지 검사한다.

## 7. 모바일 성능과 경제의 검토

### 성능

기존 headless 측정은 병목 조사 신호다. 실제 모바일 FPS라고 환산하거나 개선율을 약속하지 않는다. 대표 중간급 Android·저사양 Android·iPhone Safari에서 같은 버전과 초기 상태를 기록하고 정상 전투·밀집 전투·보스·10분 반복을 측정한다.

후보 순서는 DOM 패널 전체 재생성, 매 프레임 HUD querySelector/문자/스타일 쓰기, Graphics 재그리기, Text/스프라이트 생성, 투명 레이어 순으로 **실측 비용에 따라** 정한다. 현재는 숨겨진 관리 UI도 store 구독을 유지하므로 전투 중 불필요한 렌더를 보류하는 후보가 있다. 이를 확인된 주요 병목으로 단정하지 않는다.

화면 노드 캐시, 변경된 HUD 값만 갱신, 중요하지 않은 숫자 갱신 빈도 제한, item ID 부분 갱신, 반복 객체 재사용을 작은 단위로 적용한다. 위험 표시·실제 HP·입력 반응은 장식 감산과 별도로 보존한다. renderer 해상도·DPR 정책은 고 DPI 기기에서 픽셀 선명도와 부하를 함께 비교한다. 엔진 교체는 최초 해결책으로 채택하지 않는다.

제안 성능 목표는 중간급 기기 60fps, 저사양 기기 안정적 30fps부터 협의 가능한 기준으로 둔다. 프레임 간격 p50/p95, 긴 프레임, 입력→표시 지연, 10분 뒤 메모리/발열을 함께 기록한다. 실험 전에 대상 기기·브라우저·품질·목표를 확정하고 프레임 시간 하나로 원인을 단정하지 않는다.

### 능동 전투를 할 이유

기존 분포 문서에 따르면 방치 처치는 장비 롤 1회, 아레나 처치는 25% 확률 롤이며 보스 승리는 영웅 장비와 룬 확정 보상을 준다. 따라서 능동 전투가 언제나 더 좋은 시간당 파밍이라고 주장할 근거는 부족하다. 실제 처치 속도와 유용 장비/재화의 순수입, 실패·준비 시간을 측정해야 한다.

역할 후보는 방치=안정적 성장, 생존=짧은 조작 도전과 밀도 있는 경험, 보스=빌드 시험과 확정 보상이다. 먼저 이 차이를 UI로 설명하고 실측으로 보상 매력을 확인한다. 확률·클리어 보상·세션 길이를 동시에 바꾸지 않는다. ‘3분보다 짧은 도전’은 필요가 관찰될 때 별도 밸런스 실험으로 추가하고 기존 3분 승리 규칙에 CSS 변경으로 섞지 않는다.

오프라인 보상을 추가한다면 마지막 시간·최대 누적·자원 종류·중복 계산·기기 시각 역행·전투 중 이탈과의 관계를 설계해야 한다. 서버 없는 현재 구조에서는 로컬 시각의 신뢰 한계도 남는다. 이번 재설계의 자동 포함 항목은 아니다.

## 8. 구현 경계와 저장 이행

| 현재 파일/영역 | 재사용 | 변경 후보 |
|---|---|---|
| `src/main.js` | 부트·저장 복구·결과 정산 연결 | 탐험/성장/거래 화면 전이, 결과 기록, 저장 상태 안내 |
| `src/ui/BottomPanel.js` | 장비 비교·잠금·액션·필드 복원 | 모바일 관리 화면으로 분리, ID 부분 갱신, 항목 정렬 안정성 |
| `src/ui/ExpansionPanel.js` | 제작·시장·스킬 계산 연결 | 과업별 렌더, 정확한 비용과 대상, 재료 선택 |
| `src/style.css`, `index.html` | dvh·픽셀 렌더·모션 감소 | 안전 여백·터치·본문·관리 스크롤·반응형 역할 |
| `src/scenes/IdleScene.js` | 자동 탐험·상태 효과·명시적 출전 | 다음 목표와 준비 요약, 화면 전환 시 렌더 수명 |
| `src/scenes/CombatScene.js` | 입력/전투/위험 표현·단일 종료 | 일시정지/복귀, 포인터 소유, HUD 캐시와 경계 실측 |
| `src/systems/arenaLayout.js` | 전장 좌표/크기 변경 개념 | 실측 HUD/안전 여백 전달 |
| `src/state/persistence.js` | 구형 저장 hydrate·중단 정산 복구 | 저장 성공/실패 반환, 새 필드 기본값·마이그레이션 |
| `src/systems/combatLifecycle.js` | 결과 확정·보상 1회·시작 스냅샷 | 이유/최근 기록용 최소 필드 |
| `src/systems/autoEquip.js`, `crafting.js` | 기존 보호와 소비 규칙 | 빌드 보류 정책·명시적 합성 재료 ID는 별도 규칙 변경 |

새 후보 필드는 UI 안내 진행, 입력 손잡이/위치, 품질 설정, 최근 결과, 스키마 버전이다. 정확한 필드명은 구현 시 계약으로 확정한다. 현재 키 `claude_game_save_v1`를 바꿔 진행을 초기화하지 않는다. 기존 장비·룬·경매 예치·대기 수령함·유지 잠금을 보존한다. 기존 이용자에게 재설계 튜토리얼을 강제로 처음부터 요구하지 않는다.

로컬 화면은 게임 상태와 별도로 관리한다. 전투 중 관리 진입·결과 중 출전 등 허용하지 않을 조합을 명시한다. 저장된 UI 상태 때문에 새로고침 시 진행 불가능한 화면으로 복구되지 않도록 한다. 결과 표시와 보상 적용, 안내 완료와 실제 장착은 분리한다.

## 9. 실행 순서와 통과 기준

| 단계 | 범위 | 주요 산출물 | 통과 조건 |
|---|---|---|---|
| 0 | 문서 기준 정리·현재 기기 측정 | 현행 제품 사양, 문서 상태, 기준 장면/기기 | 오래된 미구현 표와 현재 구현이 구분됨; 성능 기준 확보 |
| 1 | P0 모바일 기반 | 버튼·문자·안전 여백, 정지/재개, 저장 상태 | 320px/짧은 높이, 앱 전환, 입력 취소, 저장 실패 통과 |
| 2 | 탐험/성장 대표 구간 | 홈→가방→장비 상세→장착→준비 | 첫 사용자에게 획득 위치·선택 이유·다음 목표가 이해됨 |
| 3 | 전투/결과 연결 | 준비→전투→귀환/승패→결과→장비 | 모든 종료에서 보상 1회, 결과 닫기/복귀 안전 |
| 4 | 제작/거래 정비 | 장비별 제작, 재료 선택, 거래/수령함 | 비용·실물 재료·되돌림 여부 확인, 부족/연타/포화 안전 |
| 5 | 전체 기기·부하·경제 검증 | 실기기 측정, 사용자 관찰, 단위/통합 회귀 | 가독성·입력·저장·성능이 기준 통과 후 배포 판단 |

비용 판단: 안전 여백/기본 버튼은 낮음~중간, 관리 화면·상태 전이는 중간~높음, 입력/중단 정책은 중간, 자동 장착·합성 변경과 경제 조정은 별도 중간~높음이다. 작업 일수는 아트·대상 기기·구현 선택이 정해지기 전 확정하지 않는다.

기존 R01~R16과는 다음처럼 연결한다: U01~04는 R04/05/07, U05~07은 R03/09, U08~11은 R02/06/07/13, U12~13은 R03/08/09, U14는 R14/15. R10/11/12의 대표 동작·배경·픽셀 스타일은 유지한다. R16 히트스톱이나 추가 카메라/셰이더는 낮은 우선순위로 남긴다.

## 10. 검증 계획

| 축 | 조건 | 확인할 것 |
|---|---|---|
| 작은 화면 | 320×568, 360×640 | CTA와 비용 접근, 긴 한국어 이름, 주요 대상 크기 |
| 보통 세로 | 390×844, 430×932 | 엄지 가림, HUD·조이스틱·안전 여백 |
| 방향 전환 | 세로↔가로, 낮은 높이 | 정지/좌표 변환, 보스/탄/돌진 목표·HUD 가림 |
| 실제 브라우저 | iPhone Safari, Android Chrome | 홈바, 브라우저 툴바, 오디오·앱 전환·OS 취소 |
| 포털 | iframe와 직접 URL | 이중 스크롤·뒤로·포커스·저장 접근·크기 전달 |
| UI 접근 | 글자 확대, 키보드, VoiceOver/TalkBack 메뉴 | 비용/행동 설명·포커스 복귀·단일 스크롤 |
| 설정 | 모션 감소, 섬광 완화, 음소거, 저품질 | 핵심 HP/위험 정보 동일 |
| 저장 | 이전 세이브, 실패, 손상, 중단 재로딩 | 기존 진행 유지, 실패 안내, 정산/경매 중복 없음 |
| 부하 | 밀집 전투, 보스 경고 겹침, 10분 반복 | 느린 프레임·메모리·효과 수명·발열 |

자동 테스트는 저장·소비·정산·상태 전이를 담당한다. 화면 검사는 잘림·대상 크기·좌표·포커스를 확인한다. 실기기 플레이는 엄지 가림·입력·프레임을 확인한다. 신규/기존 사용자의 관찰은 다음 목표·장비 선택·실패 이유 이해를 확인한다. 서로의 검증을 대신하지 않는다.

첫 사용자 과업은 ‘다음 목표 설명’, ‘획득 장비 찾기’, ‘교체의 장단점 설명’, ‘생존/보스 승리 조건 구분’, ‘앱 복귀 후 안전하게 재개’, ‘분해 대상과 비용 확인’으로 둔다. 과업 성공/도움 요청/오선택/소요시간과 발언을 기록한다. 소수 관찰에서 발견한 문제를 전체 사용자 유지율 개선으로 환산하지 않는다.

## 11. 문서 관리 제안

현행 제품 사양 1개를 기준으로 지정하고, 초기 사양/계획에는 역사 문서 표시와 현행 링크를 추가한다. 기존 연구 자료는 유지하면서 ‘제안 당시 코드’와 ‘후속 구현 반영’을 구분한다. QA에는 소스 커밋·실행 URL·기기·브라우저·상태 주입 여부·실시간 플레이 여부를 기록한다.

이번 검토서를 실행 사양으로 채택할 때는 U01~U14에 상태(제안/채택/구현/자동 검증/실기기/사용자 관찰)를 붙인다. ‘대표 구간 완료’와 ‘모바일 최적화 완료’를 같은 완료 표기로 사용하지 않는다.

## 12. 직접 확인한 외부 기술 근거

- [W3C SC 2.5.8 대상 최소 크기](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html): 24×24 CSS px 및 간격/동등 수단 등 예외. 본 검토의 44/48px 제품 목표와 구분한다.
- [MDN CSS env()](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/env): safe-area 환경값을 이용한 화면 가림 방지. 현재 코드에는 해당 처리가 없다.

저장소 내 연구의 외부 논문·영상·API 링크 전체를 이번에 재열람한 것은 아니다. 해당 연구의 범위와 한계를 함께 검토했으며 원 영상·논문 전체를 새로 검증했다고 주장하지 않는다. 공개 운영 사이트의 현재 동작은 재실행하지 않았다.

## 부록 A. 검토 문서 전수 목록

아래 목록은 기준 커밋의 문서별 검토 초점이다. 구현 계획은 요구사항·태스크·후속 변경의 설계적 의미를 중심으로 검토했고 과거 코드 조각을 다시 구현하거나 실행하지 않았다.

| 문서 | 검토 초점 |
|---|---|
| [docs/qa/2026-10-03/completion-review.md](https://github.com/jflakeee/claude_game/blob/4d091f516a71fee82568a63375822ac4c96eeba5/docs/qa/2026-10-03/completion-review.md) | 당시 기능 완료와 모바일 에뮬레이션 범위 확인 |
| [docs/qa/2026-10-03/visual-review.md](https://github.com/jflakeee/claude_game/blob/4d091f516a71fee82568a63375822ac4c96eeba5/docs/qa/2026-10-03/visual-review.md) | 수정 전 결함 기록; 이미 해결된 전투/UI 결함 재주장 방지 |
| [docs/qa/2026-10-04/completion-review.md](https://github.com/jflakeee/claude_game/blob/4d091f516a71fee82568a63375822ac4c96eeba5/docs/qa/2026-10-04/completion-review.md) | 당시 기능 완료와 모바일 에뮬레이션 범위 확인 |
| [docs/qa/2026-10-04/reaudit/review.md](https://github.com/jflakeee/claude_game/blob/4d091f516a71fee82568a63375822ac4c96eeba5/docs/qa/2026-10-04/reaudit/review.md) | 확장 연결 누락의 수정; 제작/회전/정산 보호 규칙 |
| [docs/qa/2026-10-05/deployment/review.md](https://github.com/jflakeee/claude_game/blob/4d091f516a71fee82568a63375822ac4c96eeba5/docs/qa/2026-10-05/deployment/review.md) | 배포본/포털 검증 증거; 실기기 성능 완료와 구분 |
| [docs/qa/2026-10-05/motion/review.md](https://github.com/jflakeee/claude_game/blob/4d091f516a71fee82568a63375822ac4c96eeba5/docs/qa/2026-10-05/motion/review.md) | 프레임·소개·스킵·감소 모드와 후속 갱신 |
| [docs/qa/2026-10-05/presentation/review.md](https://github.com/jflakeee/claude_game/blob/4d091f516a71fee82568a63375822ac4c96eeba5/docs/qa/2026-10-05/presentation/review.md) | 피격/체력/보상/정산·연출 수명과 과거 실행 조건 |
| [docs/qa/2026-10-05/redesign/review.md](https://github.com/jflakeee/claude_game/blob/4d091f516a71fee82568a63375822ac4c96eeba5/docs/qa/2026-10-05/redesign/review.md) | 데스크톱 확대·명시적 출전·비교/잠금 대표 구간 |
| [docs/qa/2026-10-06/deployment/review.md](https://github.com/jflakeee/claude_game/blob/4d091f516a71fee82568a63375822ac4c96eeba5/docs/qa/2026-10-06/deployment/review.md) | 배포본/포털 검증 증거; 실기기 성능 완료와 구분 |
| [docs/qa/2026-10-06/design-gap-review.md](https://github.com/jflakeee/claude_game/blob/4d091f516a71fee82568a63375822ac4c96eeba5/docs/qa/2026-10-06/design-gap-review.md) | 대표 구간 완료와 전면 완료의 구분; 실기기/첫 성장 격차 |
| [docs/qa/2026-10-06/implementation-progress.md](https://github.com/jflakeee/claude_game/blob/4d091f516a71fee82568a63375822ac4c96eeba5/docs/qa/2026-10-06/implementation-progress.md) | 위험 기하·적 프레임·결과·저장·시차의 후속 구현 반영 |
| [docs/research/README.md](https://github.com/jflakeee/claude_game/blob/4d091f516a71fee82568a63375822ac4c96eeba5/docs/research/README.md) | 문서 구성·연구/구현 상태·중복/한계 확인 |
| [docs/research/animation-effects-25olpo56QT4/README.md](https://github.com/jflakeee/claude_game/blob/4d091f516a71fee82568a63375822ac4c96eeba5/docs/research/animation-effects-25olpo56QT4/README.md) | 문서 구성·연구/구현 상태·중복/한계 확인 |
| [docs/research/animation-effects-25olpo56QT4/analysis.md](https://github.com/jflakeee/claude_game/blob/4d091f516a71fee82568a63375822ac4c96eeba5/docs/research/animation-effects-25olpo56QT4/analysis.md) | 기존 30효과의 목적·반복 피로; 추가 기능 필수화 배제 |
| [docs/research/animation-effects-25olpo56QT4/game-development-research.md](https://github.com/jflakeee/claude_game/blob/4d091f516a71fee82568a63375822ac4c96eeba5/docs/research/animation-effects-25olpo56QT4/game-development-research.md) | 사건·판정·보상·연출의 분리 및 예산/수명 |
| [docs/research/animation-effects-beyond-30/README.md](https://github.com/jflakeee/claude_game/blob/4d091f516a71fee82568a63375822ac4c96eeba5/docs/research/animation-effects-beyond-30/README.md) | 문서 구성·연구/구현 상태·중복/한계 확인 |
| [docs/research/animation-effects-beyond-30/implementation.md](https://github.com/jflakeee/claude_game/blob/4d091f516a71fee82568a63375822ac4c96eeba5/docs/research/animation-effects-beyond-30/implementation.md) | Phaser 지원/대체 표현·취소·개수 및 화면 점유 예산 |
| [docs/research/animation-effects-beyond-30/research.md](https://github.com/jflakeee/claude_game/blob/4d091f516a71fee82568a63375822ac4c96eeba5/docs/research/animation-effects-beyond-30/research.md) | 추가 24효과·변형/기법 구분; 모바일 장식 감산 우선 |
| [docs/research/cinematic-animation-toon/README.md](https://github.com/jflakeee/claude_game/blob/4d091f516a71fee82568a63375822ac4c96eeba5/docs/research/cinematic-animation-toon/README.md) | 문서 구성·연구/구현 상태·중복/한계 확인 |
| [docs/research/cinematic-animation-toon/cinematography.md](https://github.com/jflakeee/claude_game/blob/4d091f516a71fee82568a63375822ac4c96eeba5/docs/research/cinematic-animation-toon/cinematography.md) | 전환/구도/시간을 플레이 정보에 종속 |
| [docs/research/cinematic-animation-toon/game-application.md](https://github.com/jflakeee/claude_game/blob/4d091f516a71fee82568a63375822ac4c96eeba5/docs/research/cinematic-animation-toon/game-application.md) | 보스 소개 스킵·타이머 정지·결과 연결; 반복 연출 제한 |
| [docs/research/cinematic-animation-toon/toon-rendering.md](https://github.com/jflakeee/claude_game/blob/4d091f516a71fee82568a63375822ac4c96eeba5/docs/research/cinematic-animation-toon/toon-rendering.md) | 수작업 픽셀 우선, 전체 후처리/3D 전환 보류 |
| [docs/research/game-development-theory/README.md](https://github.com/jflakeee/claude_game/blob/4d091f516a71fee82568a63375822ac4c96eeba5/docs/research/game-development-theory/README.md) | 문서 구성·연구/구현 상태·중복/한계 확인 |
| [docs/research/game-development-theory/architecture.md](https://github.com/jflakeee/claude_game/blob/4d091f516a71fee82568a63375822ac4c96eeba5/docs/research/game-development-theory/architecture.md) | 상태 전이·시간 소유·저장/재현·측정 후 최적화 |
| [docs/research/game-development-theory/design-experience.md](https://github.com/jflakeee/claude_game/blob/4d091f516a71fee82568a63375822ac4c96eeba5/docs/research/game-development-theory/design-experience.md) | 첫 성장·자율 선택·유능감·페이싱을 과업에 연결 |
| [docs/research/game-development-theory/project-roadmap.md](https://github.com/jflakeee/claude_game/blob/4d091f516a71fee82568a63375822ac4c96eeba5/docs/research/game-development-theory/project-roadmap.md) | 장착·분포·학습·페이싱·수명 검증 순서 |
| [docs/research/game-development-theory/sources.md](https://github.com/jflakeee/claude_game/blob/4d091f516a71fee82568a63375822ac4c96eeba5/docs/research/game-development-theory/sources.md) | 원문/초록/접근 제한과 프로젝트 추론의 근거 수준 구분 |
| [docs/research/game-development-theory/systems-math.md](https://github.com/jflakeee/claude_game/blob/4d091f516a71fee82568a63375822ac4c96eeba5/docs/research/game-development-theory/systems-math.md) | 경제/확률·자동 추천 교환 관계; 평균을 보장으로 오인하지 않음 |
| [docs/research/game-development-theory/validation-production.md](https://github.com/jflakeee/claude_game/blob/4d091f516a71fee82568a63375822ac4c96eeba5/docs/research/game-development-theory/validation-production.md) | 규칙/영상/사용자/운영 검증의 역할 구분 |
| [docs/research/project-application/README.md](https://github.com/jflakeee/claude_game/blob/4d091f516a71fee82568a63375822ac4c96eeba5/docs/research/project-application/README.md) | 문서 구성·연구/구현 상태·중복/한계 확인 |
| [docs/research/project-application/coverage.md](https://github.com/jflakeee/claude_game/blob/4d091f516a71fee82568a63375822ac4c96eeba5/docs/research/project-application/coverage.md) | 전체 효과/이론의 적용·보류 매핑; 효과 수 합산 배제 |
| [docs/research/project-application/current-state.md](https://github.com/jflakeee/claude_game/blob/4d091f516a71fee82568a63375822ac4c96eeba5/docs/research/project-application/current-state.md) | 과거 자동 장착 반례·DOM 교체·표현 수명; 최신 코드와 구분 |
| [docs/research/project-application/pixel-style-guide.md](https://github.com/jflakeee/claude_game/blob/4d091f516a71fee82568a63375822ac4c96eeba5/docs/research/project-application/pixel-style-guide.md) | 16px 격자·윤곽·위험 문법을 모바일 표시 조건으로 검증 |
| [docs/research/project-application/redesign-feasibility.md](https://github.com/jflakeee/claude_game/blob/4d091f516a71fee82568a63375822ac4c96eeba5/docs/research/project-application/redesign-feasibility.md) | 권장 B안을 모바일 과업별 화면으로 구체화 |
| [docs/research/project-application/reward-distribution.md](https://github.com/jflakeee/claude_game/blob/4d091f516a71fee82568a63375822ac4c96eeba5/docs/research/project-application/reward-distribution.md) | 방치/아레나/상자/보스/합성 확률과 실시간 수익의 차이 |
| [docs/research/project-application/roadmap.md](https://github.com/jflakeee/claude_game/blob/4d091f516a71fee82568a63375822ac4c96eeba5/docs/research/project-application/roadmap.md) | R01~R16을 모바일 작업 U01~U14와 연결 |
| [docs/research/visual-experience-methodology/README.md](https://github.com/jflakeee/claude_game/blob/4d091f516a71fee82568a63375822ac4c96eeba5/docs/research/visual-experience-methodology/README.md) | 문서 구성·연구/구현 상태·중복/한계 확인 |
| [docs/research/visual-experience-methodology/evaluation.md](https://github.com/jflakeee/claude_game/blob/4d091f516a71fee82568a63375822ac4c96eeba5/docs/research/visual-experience-methodology/evaluation.md) | 같은 장면/설정의 비교·기기/수명 검증 행렬 |
| [docs/research/visual-experience-methodology/methods.md](https://github.com/jflakeee/claude_game/blob/4d091f516a71fee82568a63375822ac4c96eeba5/docs/research/visual-experience-methodology/methods.md) | M01~M16 정보 계층·문자·대비·모션·성능 조건 |
| [docs/research/visual-experience-methodology/project-study.md](https://github.com/jflakeee/claude_game/blob/4d091f516a71fee82568a63375822ac4c96eeba5/docs/research/visual-experience-methodology/project-study.md) | 옛 캡처 기반 가설을 최신 위험/결과 구현과 대조 |
| [docs/research/visual-experience-methodology/sources.md](https://github.com/jflakeee/claude_game/blob/4d091f516a71fee82568a63375822ac4c96eeba5/docs/research/visual-experience-methodology/sources.md) | 원문/초록/접근 제한과 프로젝트 추론의 근거 수준 구분 |
| [docs/superpowers/plans/2026-10-02-idle-vampire-hybrid-game-fixes.md](https://github.com/jflakeee/claude_game/blob/4d091f516a71fee82568a63375822ac4c96eeba5/docs/superpowers/plans/2026-10-02-idle-vampire-hybrid-game-fixes.md) | Task 15~29·스크랩북/가챠/스킬/저장/렌더 안정화 후속 결정 |
| [docs/superpowers/plans/2026-10-02-idle-vampire-hybrid-game.md](https://github.com/jflakeee/claude_game/blob/4d091f516a71fee82568a63375822ac4c96eeba5/docs/superpowers/plans/2026-10-02-idle-vampire-hybrid-game.md) | 초기 Task 1~14·임시 구현과 제품 설계 충족의 차이 |
| [docs/superpowers/specs/2026-10-02-idle-vampire-hybrid-game-design.md](https://github.com/jflakeee/claude_game/blob/4d091f516a71fee82568a63375822ac4c96eeba5/docs/superpowers/specs/2026-10-02-idle-vampire-hybrid-game-design.md) | 원래 모바일 비율·탭 진입·공유 재화·저장 정책; 현행 결정과 충돌 표시 |
| [docs/superpowers/specs/2026-10-04-expansion-design.md](https://github.com/jflakeee/claude_game/blob/4d091f516a71fee82568a63375822ac4c96eeba5/docs/superpowers/specs/2026-10-04-expansion-design.md) | 6등급·제작·스킬·보스·NPC 거래와 보호 규칙 보존 |
