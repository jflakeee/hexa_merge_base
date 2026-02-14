# 03. 수익화 및 플랫폼 설계문서

> **프로젝트**: Hexa Merge Basic
> **참고 게임**: XUP - Brain Training Game (com.gamegos.viral.simple)
> **플랫폼**: 웹(HTML5) + 안드로이드
> **엔진**: Unity (WebGL + Android 빌드)
> **작성일**: 2026-02-13
> **문서 버전**: 1.0

---

## 목차

1. [광고 보상 시스템](#1-광고-보상-시스템)
2. [인앱 결제 시스템](#2-인앱-결제-시스템)
3. [데이터 저장 및 동기화](#3-데이터-저장-및-동기화)
4. [웹 배포 설계](#4-웹-배포-설계)
5. [안드로이드 배포 설계](#5-안드로이드-배포-설계)
6. [분석 및 추적](#6-분석-및-추적)
7. [보안](#7-보안)

---

## 핵심 원칙

- **강제 광고 없음**: 모든 광고는 사용자의 자발적 선택(보상형)으로만 노출
- **공정한 플레이**: 결제/광고 없이도 모든 핵심 콘텐츠 이용 가능
- **크로스 플랫폼 일관성**: 웹과 안드로이드에서 동일한 게임 경험 제공
- **데이터 안전성**: 사용자 진행 데이터의 안전한 저장과 동기화 보장

---

## 1. 광고 보상 시스템

### 1.1 기본 정책

| 항목 | 정책 |
|------|------|
| 광고 유형 | **보상형(Rewarded) 전용** |
| 강제 광고 | **사용하지 않음** (배너, 전면 광고 없음) |
| 광고 길이 | 15~30초 (SDK 기본값) |
| 일일 시청 제한 | 최대 20회/일 |
| 쿨다운 | 동일 트리거 포인트 기준 최소 3분 간격 |
| 최소 연령 | 13세 이상 (COPPA 준수) |

### 1.2 보상형 광고 트리거 포인트

게임 내에서 사용자가 자발적으로 광고를 시청할 수 있는 지점은 다음과 같다.

| # | 트리거 포인트 | 노출 조건 | 보상 내용 | 우선순위 |
|---|-------------|----------|----------|---------|
| T1 | 게임 오버 후 "이어하기" | 게임 오버 시 | 1회 이어하기 (보드 유지) | 높음 |
| T2 | 힌트 충전 | 힌트 0개일 때 | 힌트 3개 지급 | 높음 |
| T3 | 점수 부스터 활성화 | 스테이지 시작 전 | 60초간 점수 2배 | 중간 |
| T4 | 특수 아이템 획득 | 아이템 슬롯 비었을 때 | 랜덤 특수 아이템 1개 | 중간 |
| T5 | 일일 보너스 2배 | 일일 출석 보상 수령 시 | 출석 보상 2배 | 낮음 |
| T6 | 코인 보너스 | 메인 화면 보상 버튼 | 코인 100개 | 낮음 |

### 1.3 광고 시청 보상 상세

#### 1.3.1 힌트 보상
- **기본 힌트**: 최적의 배치 위치를 하이라이트로 표시
- **광고 시청 시**: 힌트 3개 즉시 지급
- **힌트 최대 보유량**: 10개
- **힌트 자연 회복**: 10분당 1개

#### 1.3.2 아이템 보상
- **셔플 아이템**: 대기 중인 헥사 블록 3개를 새로 교체
- **폭탄 아이템**: 선택한 셀 주변 7칸 제거
- **무지개 블록**: 어떤 색상과도 합체 가능한 와일드카드

#### 1.3.3 점수 부스터
- **2배 부스터**: 60초간 모든 점수 2배 적용
- **콤보 유지**: 30초간 콤보 타이머 일시정지

### 1.4 광고 쿨다운 및 빈도 제한

```
[광고 요청 흐름]

사용자가 광고 버튼 클릭
        |
        v
+------------------+     아니오     +------------------+
| 일일 한도 확인    |-------------->| "오늘 광고 한도  |
| (20회 미만?)     |               |  도달" 팝업 표시  |
+------------------+               +------------------+
        | 예
        v
+------------------+     아니오     +------------------+
| 쿨다운 확인       |-------------->| "잠시 후 다시    |
| (3분 경과?)      |               |  시도" 팝업 표시  |
+------------------+               +------------------+
        | 예
        v
+------------------+     실패      +------------------+
| 광고 SDK 호출     |-------------->| 폴백 처리        |
| (광고 로드/재생)  |               | (1.6 참조)       |
+------------------+               +------------------+
        | 성공
        v
+------------------+
| 광고 시청 완료    |
| 콜백 수신        |
+------------------+
        |
        v
+------------------+
| 보상 지급         |
| 카운터 증가       |
| 쿨다운 타이머 시작 |
+------------------+
```

**쿨다운 규칙 상세**:
- 동일 트리거: 3분
- 서로 다른 트리거: 1분
- 게임 오버 이어하기(T1): 쿨다운 없음 (게임당 1회 제한)
- 일일 리셋: UTC 기준 00:00

### 1.5 광고 SDK 연동 설계

#### 1.5.1 SDK 구성

| 플랫폼 | 1차 SDK | 2차 SDK (미디에이션) | 비고 |
|--------|---------|---------------------|------|
| Android | Google AdMob | Unity Ads | AdMob 미디에이션으로 통합 |
| WebGL | Unity Ads | 자체 광고 서버 | WebGL에서 AdMob 미지원 |

#### 1.5.2 SDK 초기화 흐름

```
[앱 시작]
    |
    v
+------------------------+
| 플랫폼 감지             |
| (WebGL / Android)      |
+------------------------+
    |
    +----- Android -----+------ WebGL ------+
    |                                        |
    v                                        v
+------------------+                +------------------+
| AdMob SDK 초기화  |                | Unity Ads 초기화  |
| (미디에이션 포함)  |                | (WebGL 플러그인)  |
+------------------+                +------------------+
    |                                        |
    v                                        v
+------------------+                +------------------+
| GDPR 동의 확인    |                | 쿠키 동의 확인    |
| (UMP SDK)        |                | (자체 구현)       |
+------------------+                +------------------+
    |                                        |
    v                                        v
+------------------+                +------------------+
| 보상형 광고 미리   |                | 보상형 광고 미리   |
| 로드 (Pre-load)  |                | 로드 (Pre-load)   |
+------------------+                +------------------+
    |                                        |
    +------------- 합류 -------------------- +
    |
    v
+------------------------+
| 광고 Ready 상태 설정     |
| UI에 광고 버튼 활성화    |
+------------------------+
```

#### 1.5.3 Unity 코드 구조 (인터페이스)

```
IAdsService (인터페이스)
├── Initialize()
├── LoadRewardedAd()
├── ShowRewardedAd(Action<bool> onComplete)
├── IsRewardedAdReady() : bool
└── SetUserConsent(bool consent)

구현체:
├── AdMobAdsService    (Android용)
├── UnityAdsService    (WebGL용)
└── EditorAdsService   (에디터 테스트용)
```

### 1.6 광고 실패 시 폴백 처리

```
[광고 재생 실패 시 폴백 흐름]

광고 로드/재생 실패
        |
        v
+------------------+
| 실패 원인 분류    |
+------------------+
        |
        +--- 네트워크 오류 ---+--- SDK 오류 ---+--- 광고 없음 ---+
        |                     |                |                 |
        v                     v                v                 v
+-------------+     +-------------+   +-------------+   +-------------+
| 재시도 안내   |     | 2차 SDK로    |   | 대체 보상    |   | 대체 보상    |
| (1회 재시도)  |     | 전환 시도    |   | 제안         |   | 제안         |
+-------------+     +-------------+   +-------------+   +-------------+
        |                     |                |                 |
        +---------------------+--------+-------+-----------------+
                                       |
                              (최종 실패 시)
                                       |
                                       v
                              +------------------+
                              | 대체 보상 제공     |
                              | - 코인 50개로     |
                              |   동일 보상 구매   |
                              | - "나중에 다시"    |
                              |   버튼 제공        |
                              +------------------+
```

**폴백 정책**:
- [ ] 1차 SDK 실패 시 2차 SDK로 자동 전환
- [ ] 2차 SDK도 실패 시 코인으로 대체 구매 옵션 제공
- [ ] 네트워크 오류 시 1회 자동 재시도 후 사용자에게 안내
- [ ] 광고 실패 로그를 Firebase Analytics에 기록
- [ ] 연속 3회 실패 시 해당 세션에서 광고 버튼 비활성화

### 1.7 오프라인 시 광고 처리

| 상황 | 처리 방식 |
|------|----------|
| 완전 오프라인 | 광고 버튼 숨김, "오프라인 상태" 툴팁 표시 |
| 네트워크 불안정 | 광고 버튼 표시하되, 실패 시 폴백 처리 |
| 오프라인 -> 온라인 복귀 | 자동으로 광고 미리 로드, 버튼 재활성화 |
| 비행기 모드 | 광고 버튼 완전 숨김 |

**오프라인 대체 보상**:
- 오프라인에서는 코인으로 보상 구매 가능 (가격 1.5배)
- 오프라인 힌트 자연 회복은 정상 작동

### 1.8 광고 시스템 체크리스트

- [ ] AdMob SDK 연동 (Android)
- [ ] Unity Ads SDK 연동 (WebGL)
- [ ] 보상형 광고 미리 로드 구현
- [ ] 광고 시청 완료 콜백 처리
- [ ] 쿨다운 타이머 구현
- [ ] 일일 시청 횟수 카운터 구현
- [ ] 폴백 로직 구현
- [ ] 오프라인 감지 및 UI 반영
- [ ] GDPR/개인정보 동의 UI 구현
- [ ] 광고 관련 이벤트 Analytics 전송
- [ ] 에디터 테스트용 Mock 광고 서비스 구현
- [ ] 광고 ID 단위별 설정 파일(ScriptableObject) 구성

---

## 2. 인앱 결제 시스템

### 2.1 상품 구성

#### 2.1.1 소비형 상품 (Consumable)

| 상품 ID | 상품명 | 설명 | 가격 (KRW) | 가격 (USD) |
|---------|--------|------|-----------|-----------|
| `coin_pack_s` | 코인 소형 팩 | 코인 500개 | 1,200원 | $0.99 |
| `coin_pack_m` | 코인 중형 팩 | 코인 1,500개 (+15% 보너스) | 3,300원 | $2.99 |
| `coin_pack_l` | 코인 대형 팩 | 코인 4,000개 (+33% 보너스) | 6,600원 | $5.99 |
| `coin_pack_xl` | 코인 특대 팩 | 코인 10,000개 (+50% 보너스) | 12,000원 | $9.99 |
| `item_hint_10` | 힌트 10개 팩 | 힌트 10개 즉시 지급 | 1,200원 | $0.99 |
| `item_bundle` | 아이템 번들 | 셔플 3개 + 폭탄 3개 + 무지개 3개 | 2,500원 | $1.99 |
| `starter_pack` | 스타터 팩 | 코인 2,000 + 힌트 10 + 아이템 번들 (1회 한정) | 3,300원 | $2.99 |

#### 2.1.2 비소비형 상품 (Non-Consumable)

| 상품 ID | 상품명 | 설명 | 가격 (KRW) | 가격 (USD) |
|---------|--------|------|-----------|-----------|
| `remove_ads` | 광고 제거 | 모든 광고 버튼 제거 + 코인 1,000개 보너스 | 4,400원 | $3.99 |
| `theme_ocean` | 오션 테마 | 바다 테마 배경 + 블록 스킨 | 2,500원 | $1.99 |
| `theme_forest` | 포레스트 테마 | 숲 테마 배경 + 블록 스킨 | 2,500원 | $1.99 |
| `theme_space` | 스페이스 테마 | 우주 테마 배경 + 블록 스킨 | 2,500원 | $1.99 |
| `theme_bundle` | 테마 전체 팩 | 모든 테마 일괄 구매 | 5,500원 | $4.99 |
| `premium_pass` | 프리미엄 패스 | 광고 제거 + 모든 테마 + 코인 5,000 | 12,000원 | $9.99 |

#### 2.1.3 구독형 상품 (Subscription) - 향후 확장 예약

| 상품 ID | 상품명 | 설명 | 가격 (KRW/월) | 비고 |
|---------|--------|------|-------------|------|
| `vip_monthly` | VIP 월간 구독 | 광고 제거 + 일일 코인 200 + 전용 테마 | 4,400원/월 | v2.0 예정 |

### 2.2 가격 정책

**기본 원칙**:
- 최소 결제 단위: $0.99 / 1,200원
- 대형 패키지일수록 보너스 비율 증가 (볼륨 디스카운트)
- 스타터 팩은 신규 사용자 1회 한정 (전환율 극대화)
- 프리미엄 패스는 개별 구매 대비 40% 할인 효과

**지역별 가격 조정**:
- Google Play: 자동 환율 적용 (기본 USD 기준)
- 웹: 원화(KRW) 직접 결제, 해외 사용자는 USD 적용
- 세일 이벤트: 분기별 1회, 최대 30% 할인

### 2.3 결제 프로세스 플로우

#### 2.3.1 Android (Google Play Billing)

```
[Android 인앱 결제 플로우]

사용자가 상점에서 상품 선택
        |
        v
+------------------------+
| BillingClient 연결 확인  |
+------------------------+
        |
        +--- 미연결 ---+--- 연결됨 ---+
        |                             |
        v                             |
+------------------+                  |
| BillingClient    |                  |
| 재연결 시도       |                  |
+------------------+                  |
        |                             |
        +-------- 합류 ---------------+
        |
        v
+------------------------+
| launchBillingFlow()    |
| Google Play 결제 UI    |
+------------------------+
        |
        +--- 취소 ---+--- 성공 ---+--- 오류 ---+
        |             |             |            |
        v             v             v            |
+----------+  +-------------+  +-----------+    |
| 취소 처리 |  | Purchase     |  | 오류 팝업  |    |
| (로그)   |  | 객체 수신    |  | (재시도)  |    |
+----------+  +-------------+  +-----------+    |
                      |                          |
                      v                          |
              +------------------+               |
              | 서버 영수증 검증   |               |
              | (purchaseToken)  |               |
              +------------------+               |
                      |                          |
              +--- 유효 ---+--- 무효 ---+        |
              |             |            |        |
              v             v            |        |
      +-------------+ +----------+      |        |
      | 아이템 지급   | | 구매 취소 |      |        |
      | acknowledge  | | 환불 처리 |      |        |
      +-------------+ +----------+      |        |
              |                          |        |
              v                          |        |
      +------------------+              |        |
      | 구매 완료 UI 표시  |              |        |
      | Analytics 이벤트  |              |        |
      +------------------+              |        |
```

#### 2.3.2 웹 (Stripe 결제)

```
[웹 결제 플로우]

사용자가 상점에서 상품 선택
        |
        v
+------------------------+
| 결제 요청 API 호출      |
| POST /api/checkout     |
+------------------------+
        |
        v
+------------------------+
| 서버: Stripe Checkout   |
| Session 생성            |
+------------------------+
        |
        v
+------------------------+
| Stripe 결제 페이지      |
| (카드/간편결제)         |
+------------------------+
        |
        +--- 취소 ---+--- 성공 ---+
        |             |            |
        v             v            |
+----------+  +-------------+     |
| 취소 URL  |  | 성공 URL     |     |
| 리다이렉트 |  | 리다이렉트   |     |
+----------+  +-------------+     |
                      |            |
                      v            |
              +------------------+ |
              | Stripe Webhook   | |
              | (payment_intent  | |
              |  .succeeded)     | |
              +------------------+ |
                      |            |
                      v            |
              +------------------+ |
              | 서버: 결제 검증    | |
              | 아이템 지급 처리   | |
              +------------------+ |
                      |            |
                      v            |
              +------------------+ |
              | 클라이언트에       | |
              | 지급 결과 전달    | |
              | (Polling/WS)     | |
              +------------------+ |
```

### 2.4 영수증 검증

#### 2.4.1 Android 영수증 검증

```
[Android 영수증 검증 흐름]

클라이언트                          서버                        Google Play API
    |                               |                               |
    |-- purchaseToken 전송 -------->|                               |
    |                               |-- purchases.products.get ---->|
    |                               |<-- 구매 정보 응답 -------------|
    |                               |                               |
    |                               |-- 검증 로직 수행:              |
    |                               |   1. orderId 확인             |
    |                               |   2. purchaseState == 0       |
    |                               |   3. packageName 일치         |
    |                               |   4. productId 일치           |
    |                               |   5. 중복 구매 확인            |
    |                               |                               |
    |<-- 검증 결과 + 아이템 지급 ----|                               |
    |                               |                               |
```

**검증 서버 요구사항**:
- Google Play Developer API 서비스 계정 설정
- 영수증 검증 전용 API 엔드포인트
- 중복 영수증 체크용 DB 테이블 (orderId 기반)
- 검증 실패 시 자동 알림 (Slack/Email)

#### 2.4.2 웹 결제 검증

- Stripe Webhook (`payment_intent.succeeded`) 수신
- Webhook Signature 검증 (HMAC-SHA256)
- 결제 금액/상품 일치 확인
- idempotency key를 통한 중복 처리 방지

### 2.5 Google Play Billing Library 연동

**사용 버전**: Google Play Billing Library 7.x

```
[초기화 순서]

1. BillingClient.newBuilder() 생성
2. BillingClient.startConnection()
3. 연결 성공 시:
   a. queryProductDetailsAsync() - 상품 정보 조회
   b. queryPurchasesAsync() - 미처리 구매 확인
   c. 미처리 구매가 있으면 acknowledge/consume 처리
4. 연결 실패 시:
   a. 지수 백오프로 재연결 시도 (최대 5회)
   b. 모든 재시도 실패 시 상점 비활성화
```

**핵심 구현 체크리스트**:
- [ ] BillingClient 생명주기 관리 (Activity 연동)
- [ ] 소비형 상품 consume 처리 구현
- [ ] 비소비형 상품 acknowledge 처리 구현
- [ ] 미처리 구매(pending purchases) 복구 로직
- [ ] 가격 표시를 ProductDetails에서 가져오기 (하드코딩 금지)
- [ ] BillingClient 연결 끊김 시 자동 재연결
- [ ] ProGuard/R8 규칙에 Billing 클래스 예외 추가

### 2.6 웹 결제 처리 (Stripe)

**Stripe 사용 이유**: 글로벌 결제 지원, PCI DSS 준수, 풍부한 SDK

| 구성 요소 | 기술 스택 |
|----------|----------|
| 프론트엔드 | Stripe.js + Unity WebGL jslib |
| 백엔드 | Node.js + Express (또는 Firebase Functions) |
| 결제 방식 | Stripe Checkout (호스팅 결제 페이지) |
| Webhook | Stripe Webhook + 서명 검증 |

**웹 결제 보안 원칙**:
- 결제 금액은 반드시 서버에서 설정 (클라이언트 금액 신뢰 금지)
- Stripe Secret Key는 서버에만 보관
- 모든 통신은 HTTPS 필수
- CSP(Content Security Policy) 헤더에 Stripe 도메인 허용

### 2.7 환불 정책

| 상품 유형 | 환불 가능 여부 | 조건 |
|----------|--------------|------|
| 소비형 (미사용) | 가능 | 구매 후 72시간 이내, 미사용 상태 |
| 소비형 (사용 완료) | 불가 | 이미 소비된 아이템은 환불 불가 |
| 비소비형 | 가능 | 구매 후 72시간 이내 |
| 광고 제거 | 가능 | 구매 후 48시간 이내 |
| 테마/스킨 | 가능 | 구매 후 72시간 이내 |

**환불 처리 흐름**:

```
[환불 처리 흐름]

Google Play 환불 발생 (RTDN)
        |
        v
+---------------------------+
| Real-Time Developer       |
| Notification 수신          |
| (Cloud Pub/Sub)           |
+---------------------------+
        |
        v
+---------------------------+
| 환불 유형 확인              |
| - SUBSCRIPTION_REVOKED    |
| - SUBSCRIPTION_CANCELED   |
| - ONE_TIME_PRODUCT_REFUND |
+---------------------------+
        |
        v
+---------------------------+
| 서버: 사용자 데이터 갱신    |
| - 소비형: 코인/아이템 차감  |
| - 비소비형: 권한 회수       |
+---------------------------+
        |
        v
+---------------------------+
| 클라이언트 동기화           |
| 다음 접속 시 변경사항 반영   |
+---------------------------+
```

### 2.8 인앱 결제 체크리스트

- [ ] Google Play Billing Library 7.x 통합
- [ ] Stripe Checkout 서버 구축
- [ ] 상품 목록 Google Play Console에 등록
- [ ] 서버 영수증 검증 API 구현
- [ ] Stripe Webhook 엔드포인트 구현
- [ ] 미처리 구매 복구 로직 구현
- [ ] 환불 RTDN 수신 및 처리 구현
- [ ] 상점 UI 구현 (상품 목록, 가격, 구매 버튼)
- [ ] 구매 확인 팝업 구현
- [ ] 구매 성공/실패 피드백 UI 구현
- [ ] 스타터 팩 1회 구매 제한 로직
- [ ] 결제 테스트 (Google Play 테스트 트랙)
- [ ] Stripe 테스트 모드 결제 확인
- [ ] 가격 현지화 표시 확인

---

## 3. 데이터 저장 및 동기화

### 3.1 데이터 구조

#### 3.1.1 저장 데이터 목록

| 카테고리 | 데이터 키 | 타입 | 설명 | 저장 위치 |
|---------|----------|------|------|----------|
| 진행 | `highScore` | int | 최고 점수 | 로컬 + 클라우드 |
| 진행 | `currentScore` | int | 현재 게임 점수 | 로컬 |
| 진행 | `boardState` | string(JSON) | 현재 보드 상태 | 로컬 |
| 진행 | `totalGamesPlayed` | int | 총 플레이 횟수 | 로컬 + 클라우드 |
| 진행 | `totalMerges` | int | 총 합체 횟수 | 로컬 + 클라우드 |
| 재화 | `coins` | int | 보유 코인 | 로컬 + 클라우드 |
| 재화 | `hints` | int | 보유 힌트 수 | 로컬 + 클라우드 |
| 재화 | `items` | string(JSON) | 보유 아이템 목록 | 로컬 + 클라우드 |
| 구매 | `purchasedProducts` | string(JSON) | 구매한 비소비형 상품 목록 | 로컬 + 클라우드 |
| 구매 | `adsRemoved` | bool | 광고 제거 여부 | 로컬 + 클라우드 |
| 설정 | `musicVolume` | float | 음악 볼륨 | 로컬 |
| 설정 | `sfxVolume` | float | 효과음 볼륨 | 로컬 |
| 설정 | `language` | string | 언어 설정 | 로컬 |
| 설정 | `selectedTheme` | string | 선택된 테마 | 로컬 + 클라우드 |
| 통계 | `dailyAdCount` | int | 오늘 광고 시청 횟수 | 로컬 |
| 통계 | `lastAdTimestamp` | long | 마지막 광고 시청 시각 | 로컬 |
| 통계 | `lastLoginDate` | string | 마지막 로그인 날짜 | 로컬 + 클라우드 |
| 통계 | `consecutiveLoginDays` | int | 연속 로그인 일수 | 로컬 + 클라우드 |

### 3.2 로컬 저장

#### 3.2.1 Android - PlayerPrefs + 암호화 파일

```
[Android 로컬 저장 구조]

PlayerPrefs (간단한 설정값)
├── musicVolume
├── sfxVolume
├── language
└── selectedTheme

암호화 파일 저장 (중요 데이터)
├── 경로: Application.persistentDataPath/save/
├── 파일: gamedata.sav (AES-256 암호화)
├── 내용: JSON 직렬화 데이터
│   ├── highScore
│   ├── coins
│   ├── hints
│   ├── items
│   ├── purchasedProducts
│   └── ...기타 진행 데이터
└── 백업: gamedata.sav.bak (이전 저장본)
```

**PlayerPrefs 사용 제한 사항**:
- 재화(코인, 아이템) 등 민감 데이터는 PlayerPrefs에 저장하지 않음
- PlayerPrefs는 설정값에만 사용
- 중요 데이터는 별도 암호화 파일로 관리

#### 3.2.2 WebGL - IndexedDB + LocalStorage

```
[WebGL 로컬 저장 구조]

LocalStorage (간단한 설정값)
├── hexa_musicVolume
├── hexa_sfxVolume
├── hexa_language
└── hexa_selectedTheme

IndexedDB (중요 데이터)
├── DB명: HexaMergeDB
├── Store명: GameData
├── 키: "saveData"
├── 값: AES 암호화된 JSON 문자열
│   ├── highScore
│   ├── coins
│   ├── hints
│   ├── items
│   ├── purchasedProducts
│   └── ...기타 진행 데이터
└── 버전 관리: DB 스키마 버전으로 마이그레이션 지원
```

**WebGL 저장 시 주의사항**:
- IndexedDB 비동기 API 사용 (jslib 플러그인으로 브릿지)
- 브라우저 시크릿 모드에서 IndexedDB 제한 감지 및 폴백
- 저장 용량 초과 시 안내 메시지 표시
- 사파리 ITP(Intelligent Tracking Prevention) 대응

### 3.3 클라우드 저장

#### 3.3.1 Android - Google Play Games Services (Saved Games)

```
[클라우드 저장 흐름 - Android]

저장 트리거 발생
(게임 오버, 스테이지 클리어, 구매 완료, 앱 백그라운드 전환)
        |
        v
+---------------------------+
| Google Play Games 로그인   |
| 상태 확인                  |
+---------------------------+
        |
        +--- 로그인됨 ---+--- 미로그인 ---+
        |                                 |
        v                                 v
+------------------+              +------------------+
| SnapshotClient   |              | 로컬에만 저장     |
| .open() 호출     |              | (다음 로그인 시   |
+------------------+              |  동기화 예약)     |
        |                         +------------------+
        v
+------------------+
| 스냅샷 데이터     |
| JSON 직렬화       |
| + 메타데이터 설정  |
| (타임스탬프,      |
|  플레이 시간)     |
+------------------+
        |
        v
+------------------+
| SnapshotClient   |
| .commitAndClose()|
+------------------+
        |
        v
+------------------+
| 저장 완료         |
| (자동 백업)       |
+------------------+
```

#### 3.3.2 WebGL - 자체 서버 저장 (Firebase Firestore)

```
[클라우드 저장 흐름 - WebGL]

저장 트리거 발생
        |
        v
+---------------------------+
| 사용자 인증 상태 확인       |
| (Firebase Auth             |
|  - 구글 로그인 / 익명 인증) |
+---------------------------+
        |
        +--- 인증됨 ---+--- 미인증 ---+
        |                              |
        v                              v
+------------------+           +------------------+
| Firestore 문서    |           | 로컬에만 저장     |
| 업데이트           |           | (로그인 유도 팝업)|
| users/{uid}/save  |           +------------------+
+------------------+
        |
        v
+------------------+
| 저장 완료         |
| 타임스탬프 기록    |
+------------------+
```

### 3.4 데이터 동기화 전략

```
[데이터 동기화 전체 흐름]

앱 시작 / 로그인 완료
        |
        v
+---------------------------+
| 로컬 데이터 로드            |
+---------------------------+
        |
        v
+---------------------------+
| 클라우드 데이터 로드         |
+---------------------------+
        |
        v
+---------------------------+
| 타임스탬프 비교              |
| 로컬 vs 클라우드            |
+---------------------------+
        |
        +--- 로컬 최신 ---+--- 클라우드 최신 ---+--- 동일 ---+
        |                  |                     |            |
        v                  v                     v            |
+-------------+    +-------------+       +-------------+     |
| 클라우드에    |    | 로컬에       |       | 동기화 완료  |     |
| 로컬 데이터   |    | 클라우드     |       | (변경 없음)  |     |
| 업로드       |    | 데이터 적용  |       +-------------+     |
+-------------+    +-------------+                            |
        |                  |                                   |
        +--- 충돌 발생? ---+                                   |
        |                                                      |
        +--- 아니오 ---+--- 예 ---+                            |
        |                         |                            |
        v                         v                            |
+-------------+          +------------------+                  |
| 동기화 완료  |          | 충돌 해결 정책    |                  |
+-------------+          | (3.5 참조)       |                  |
                         +------------------+                  |
```

**동기화 트리거 시점**:
1. 앱 시작 시 (최초 1회)
2. 게임 오버 후
3. 인앱 구매 완료 후 (즉시)
4. 수동 저장 버튼 클릭 시
5. 앱이 백그라운드로 전환될 때
6. 15분 주기 자동 동기화

### 3.5 충돌 해결 정책

| 데이터 유형 | 충돌 해결 방식 | 근거 |
|------------|--------------|------|
| 최고 점수 | **높은 값 우선** | 점수는 항상 증가하므로 높은 값이 최신 |
| 코인 | **서버(클라우드) 우선** | 결제와 연동되므로 서버 데이터가 신뢰할 수 있음 |
| 구매 기록 | **합집합(Union)** | 양쪽에서 구매한 항목 모두 인정 |
| 아이템 | **서버 우선** | 결제 검증 서버와 일치 보장 |
| 보드 상태 | **타임스탬프 최신 우선** | 가장 최근에 플레이한 상태 유지 |
| 통계 | **높은 값 우선** | 누적 통계는 항상 증가 |
| 설정 | **로컬 우선** | 사용자가 현재 기기에서 설정한 값 존중 |

**충돌 발생 시 사용자 알림**:
- 자동 해결 가능한 경우: 자동 처리 후 "데이터가 동기화되었습니다" 토스트 표시
- 자동 해결 불가능한 경우: "로컬 데이터" vs "클라우드 데이터" 선택 팝업 표시

### 3.6 데이터 저장 체크리스트

- [ ] Android PlayerPrefs 저장/로드 구현
- [ ] Android 암호화 파일 저장/로드 구현
- [ ] WebGL IndexedDB 저장/로드 jslib 플러그인 구현
- [ ] WebGL LocalStorage 저장/로드 구현
- [ ] Google Play Games Services Saved Games 연동
- [ ] Firebase Firestore 클라우드 저장 구현
- [ ] Firebase Auth (Google 로그인 + 익명 인증) 구현
- [ ] 데이터 동기화 로직 구현
- [ ] 충돌 해결 로직 구현
- [ ] 저장 데이터 마이그레이션 시스템 구현 (버전 관리)
- [ ] 데이터 암호화(AES-256) 구현
- [ ] 오프라인 큐(동기화 대기열) 구현
- [ ] 시크릿 모드 / IndexedDB 비활성 감지 구현
- [ ] 저장 실패 시 재시도 로직 구현

---

## 4. 웹 배포 설계

### 4.1 Unity WebGL 빌드 설정

#### 4.1.1 빌드 설정

| 설정 항목 | 값 | 설명 |
|----------|-----|------|
| Compression Format | Brotli | 가장 높은 압축률 (서버 지원 필요) |
| Decompression Fallback | 활성화 | Brotli 미지원 브라우저 대비 |
| Name Files As Hashes | 활성화 | 캐시 버스팅 |
| Data Caching | 활성화 | IndexedDB에 에셋 캐시 |
| Exception Handling | Explicitly Thrown Only | 성능 최적화 |
| Memory Size | 256MB | 헥사 퍼즐 기준 충분 |
| Code Optimization | Disk Size (LTO) | 파일 크기 최소화 |
| IL2CPP Code Generation | Faster (Smaller) Builds | 빌드 크기 최적화 |
| Texture Compression | ASTC + DXT 폴백 | 모바일/데스크톱 호환 |
| WebAssembly Arithmetic Exceptions | Ignore | 성능 최적화 |

#### 4.1.2 Unity Player Settings (WebGL)

```
[WebGL Player Settings]

Resolution and Presentation:
├── Default Canvas Width: 720
├── Default Canvas Height: 1280
├── Run In Background: true
└── WebGL Template: Custom (반응형)

Other Settings:
├── Color Space: Gamma (WebGL 호환성)
├── Auto Graphics API: true
├── Scripting Backend: IL2CPP
├── API Compatibility Level: .NET Standard 2.1
└── Strip Engine Code: true

Publishing Settings:
├── Compression Format: Brotli
├── Decompression Fallback: true
├── Name Files As Hashes: true
└── Data Caching: true
```

### 4.2 호스팅 환경

#### 4.2.1 아키텍처

```
[웹 배포 아키텍처]

사용자 브라우저
        |
        v
+---------------------------+
| Cloudflare CDN             |
| - DNS 관리                 |
| - SSL/TLS 인증서           |
| - DDoS 방어               |
| - Brotli 압축 지원         |
| - 캐시 규칙                |
+---------------------------+
        |
        v
+---------------------------+
| 오리진 서버                 |
| (Firebase Hosting 또는     |
|  AWS S3 + CloudFront)     |
+---------------------------+
        |
        +--- 정적 파일 ---+--- API 요청 ---+
        |                                   |
        v                                   v
+------------------+               +------------------+
| Unity WebGL 빌드  |               | Firebase Functions|
| 파일 서빙         |               | (또는 AWS Lambda) |
| - .wasm           |               | - 결제 API        |
| - .data            |               | - 영수증 검증     |
| - .js              |               | - 세이브 동기화   |
| - .html            |               +------------------+
+------------------+
```

#### 4.2.2 서버 설정 (MIME 타입 및 헤더)

| 파일 확장자 | MIME Type | Cache-Control |
|------------|-----------|---------------|
| `.wasm` | `application/wasm` | `public, max-age=31536000, immutable` |
| `.data.br` | `application/octet-stream` | `public, max-age=31536000, immutable` |
| `.js.br` | `application/javascript` | `public, max-age=31536000, immutable` |
| `.html` | `text/html` | `no-cache` |
| `.json` | `application/json` | `public, max-age=3600` |

**Content-Encoding 헤더**: `.br` 파일에 `Content-Encoding: br` 반드시 설정

### 4.3 로딩 최적화

```
[로딩 최적화 전략]

1단계: HTML 로드 (즉시)
├── 로딩 화면 즉시 표시
├── 프로그레스 바 표시
└── 게임 팁/힌트 텍스트 순환 표시

2단계: 엔진 코드 로드 (~30%)
├── .framework.js 로드
├── .wasm 로드 (가장 큰 파일)
└── 진행률 업데이트

3단계: 게임 데이터 로드 (~60%)
├── .data 파일 로드 (에셋 포함)
├── IndexedDB 캐시 확인
│   ├── 캐시 있음 → 캐시에서 로드 (빠름)
│   └── 캐시 없음 → 네트워크에서 로드 + 캐시 저장
└── 진행률 업데이트

4단계: 초기화 (~90%)
├── Unity 런타임 초기화
├── 첫 씬 로드
└── 에셋 번들 미리 로드

5단계: 게임 시작 (100%)
├── 로딩 화면 페이드 아웃
├── 메인 메뉴 표시
└── 광고 SDK 백그라운드 초기화
```

**최적화 기법**:
- [ ] Addressable Assets 사용으로 초기 로드 크기 축소
- [ ] 텍스처 아틀라스로 드로우 콜 최소화
- [ ] 오디오: Vorbis 압축, 모바일 품질 설정
- [ ] 폰트: 사용 문자만 포함 (한글 서브셋)
- [ ] 스프라이트 압축: WebP 포맷 활용
- [ ] 코드 스트리핑 활성화 (미사용 코드 제거)
- [ ] 목표 초기 로드 크기: 10MB 이하 (압축 후)

### 4.4 브라우저 호환성

| 브라우저 | 최소 버전 | WebGL 2.0 | WASM | 비고 |
|---------|----------|-----------|------|------|
| Chrome | 90+ | O | O | 주요 타깃 |
| Firefox | 90+ | O | O | |
| Safari | 15.4+ | O | O | iOS Safari 포함 |
| Edge | 90+ | O | O | Chromium 기반 |
| Samsung Internet | 15+ | O | O | 안드로이드 기본 |
| Opera | 76+ | O | O | |
| IE | 미지원 | X | X | 지원 중단 |

**비호환 브라우저 대응**:
```
[브라우저 호환성 체크 흐름]

페이지 로드
    |
    v
+---------------------------+
| 기능 감지 (Feature Detection)|
| - WebGL 2.0 지원?          |
| - WebAssembly 지원?        |
| - SharedArrayBuffer 지원?  |
+---------------------------+
    |
    +--- 모두 지원 ---+--- 미지원 항목 있음 ---+
    |                                          |
    v                                          v
+------------------+                   +------------------+
| 게임 정상 로드    |                   | 호환성 안내 페이지 |
+------------------+                   | "브라우저를 업데이트|
                                       |  해주세요" 표시    |
                                       | Chrome/Firefox    |
                                       | 다운로드 링크 제공  |
                                       +------------------+
```

### 4.5 PWA 지원

**PWA 지원 여부**: 제한적 지원 (오프라인 모드는 미지원)

| PWA 기능 | 지원 여부 | 설명 |
|---------|----------|------|
| manifest.json | O | 홈 화면 추가 지원 |
| Service Worker | 부분 | 정적 리소스 캐시만 (오프라인 게임 X) |
| 홈 화면 아이콘 | O | 192x192, 512x512 아이콘 제공 |
| 테마 색상 | O | 게임 브랜드 컬러 적용 |
| Splash Screen | O | 커스텀 스플래시 스크린 |
| 오프라인 모드 | X | WebGL 게임 특성상 오프라인 실행 어려움 |
| Push Notification | X | v2.0 검토 |

**manifest.json 핵심 설정**:
```json
{
  "name": "Hexa Merge Basic",
  "short_name": "HexaMerge",
  "start_url": "/",
  "display": "standalone",
  "orientation": "portrait",
  "theme_color": "#4A90D9",
  "background_color": "#1A1A2E",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

### 4.6 SEO 및 메타데이터

```html
<!-- 기본 메타 태그 -->
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
<title>Hexa Merge Basic - 헥사 머지 퍼즐 게임</title>
<meta name="description" content="육각형 블록을 합쳐서 최고 점수를 달성하세요! 두뇌 훈련에 최적화된 무료 퍼즐 게임.">
<meta name="keywords" content="헥사 머지, 퍼즐 게임, 두뇌 훈련, 무료 게임, HTML5 게임">
<meta name="author" content="Hexa Merge Team">

<!-- Open Graph (소셜 미디어 공유) -->
<meta property="og:title" content="Hexa Merge Basic">
<meta property="og:description" content="육각형 블록을 합쳐서 최고 점수를 달성하세요!">
<meta property="og:image" content="https://hexamerge.example.com/og-image.png">
<meta property="og:url" content="https://hexamerge.example.com">
<meta property="og:type" content="website">

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Hexa Merge Basic">
<meta name="twitter:description" content="육각형 블록을 합쳐서 최고 점수를 달성하세요!">
<meta name="twitter:image" content="https://hexamerge.example.com/twitter-image.png">

<!-- 구조화된 데이터 (JSON-LD) -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "VideoGame",
  "name": "Hexa Merge Basic",
  "description": "육각형 블록을 합쳐서 최고 점수를 달성하세요!",
  "genre": "Puzzle",
  "gamePlatform": ["Web", "Android"],
  "operatingSystem": "Any",
  "applicationCategory": "Game",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "KRW"
  }
}
</script>
```

**SEO 추가 전략**:
- [ ] robots.txt 설정 (게임 에셋 폴더 크롤링 제외)
- [ ] sitemap.xml 생성
- [ ] Canonical URL 설정
- [ ] 게임 로딩 전 검색엔진용 노스크립트 콘텐츠 제공
- [ ] 페이지 로드 속도 최적화 (Core Web Vitals 기준 충족)
- [ ] 다국어 지원 시 hreflang 태그 추가

### 4.7 웹 배포 체크리스트

- [ ] Unity WebGL 빌드 설정 최적화
- [ ] Brotli 압축 빌드 확인
- [ ] 호스팅 서버 MIME 타입 및 헤더 설정
- [ ] CDN 캐시 규칙 설정
- [ ] SSL/TLS 인증서 적용
- [ ] 로딩 화면 및 프로그레스 바 구현
- [ ] 커스텀 WebGL 템플릿 작성
- [ ] 브라우저 호환성 감지 스크립트 구현
- [ ] PWA manifest.json 작성
- [ ] Service Worker 구현 (정적 리소스 캐시)
- [ ] SEO 메타 태그 적용
- [ ] Open Graph / Twitter Card 이미지 생성
- [ ] robots.txt / sitemap.xml 생성
- [ ] 모바일 반응형 레이아웃 확인
- [ ] 성능 테스트 (Lighthouse 점수 80+ 목표)
- [ ] CORS 설정 확인
- [ ] CSP(Content Security Policy) 헤더 설정

---

## 5. 안드로이드 배포 설계

### 5.1 최소 SDK 버전

| 항목 | 버전 | 비고 |
|------|------|------|
| Minimum SDK | API 24 (Android 7.0 Nougat) | 시장 점유율 약 97% 커버 |
| Target SDK | API 35 (Android 15) | Google Play 최신 요구사항 충족 |
| Compile SDK | API 35 | |
| Unity Minimum | Unity 6 LTS | Unity WebGL + Android 동시 지원 |

### 5.2 권한 목록

| 권한 | 필수 여부 | 용도 | 런타임 요청 |
|------|----------|------|------------|
| `INTERNET` | 필수 | 광고, 결제, 클라우드 저장 | 불필요 (일반 권한) |
| `ACCESS_NETWORK_STATE` | 필수 | 네트워크 상태 확인 | 불필요 (일반 권한) |
| `com.android.vending.BILLING` | 필수 | 인앱 결제 | 불필요 |
| `VIBRATE` | 선택 | 햅틱 피드백 | 불필요 (일반 권한) |
| `WAKE_LOCK` | 선택 | 게임 중 화면 꺼짐 방지 | 불필요 (일반 권한) |
| `AD_ID` | 선택 | 광고 식별자 (AdMob) | API 33+ 런타임 |

**불필요 권한 제외 확인**:
- [ ] `READ_EXTERNAL_STORAGE` - 불필요 (내부 저장만 사용)
- [ ] `WRITE_EXTERNAL_STORAGE` - 불필요
- [ ] `CAMERA` - 불필요
- [ ] `RECORD_AUDIO` - 불필요
- [ ] `ACCESS_FINE_LOCATION` - 불필요

### 5.3 APK/AAB 빌드 설정

#### 5.3.1 빌드 타입

| 빌드 타입 | 포맷 | 용도 |
|----------|------|------|
| Debug | APK | 개발/테스트용 |
| Release (Internal) | AAB | 내부 테스트 트랙 |
| Release (Production) | AAB | Google Play 출시 |

#### 5.3.2 Unity Build Settings

```
[Android Build Settings]

Player Settings:
├── Company Name: HexaMerge
├── Product Name: Hexa Merge Basic
├── Package Name: com.hexamerge.basic
├── Version: 1.0.0
├── Bundle Version Code: 1
├── Minimum API Level: 24
├── Target API Level: 35
├── Scripting Backend: IL2CPP
├── Target Architectures: ARMv7 + ARM64
├── Install Location: Automatic
├── Internet Access: Required
└── Write Permission: Internal

Build Settings:
├── Build System: Gradle
├── Export Project: false (Unity 빌드)
├── Build App Bundle (AAB): true
├── Split Application Binary: false
├── Minify Release: ProGuard/R8 활성화
└── Custom Gradle Template: 활성화
```

#### 5.3.3 ProGuard/R8 규칙

```
# Google Play Billing
-keep class com.android.vending.billing.** { *; }

# AdMob
-keep class com.google.android.gms.ads.** { *; }

# Unity
-keep class com.unity3d.** { *; }

# Firebase
-keep class com.google.firebase.** { *; }

# 게임 데이터 직렬화 클래스
-keep class com.hexamerge.basic.data.** { *; }
```

### 5.4 Google Play Console 설정

#### 5.4.1 앱 설정

```
[Google Play Console 설정 항목]

앱 정보:
├── 앱 이름: Hexa Merge Basic
├── 기본 언어: 한국어 (ko)
├── 앱 유형: 게임
├── 카테고리: 퍼즐
├── 태그: 퍼즐, 두뇌 훈련, 헥사, 머지
├── 이메일: support@hexamerge.example.com
└── 개인정보처리방침 URL: https://hexamerge.example.com/privacy

콘텐츠 등급:
├── IARC 등급 설문 완료
├── 예상 등급: 전체 이용가
├── 폭력: 없음
├── 성적 콘텐츠: 없음
└── 인앱 구매: 있음 (표시 필요)

데이터 안전:
├── 수집 데이터: 광고 ID, 앱 활동 데이터
├── 공유 데이터: 광고 목적으로 광고 ID 공유
├── 암호화: 전송 중 암호화
└── 데이터 삭제 요청: 지원
```

#### 5.4.2 출시 트랙

```
[출시 트랙 전략]

내부 테스트 (Internal Testing)
├── 대상: 개발팀 (최대 100명)
├── 목적: 기능 검증, 크래시 확인
├── 기간: 상시
└── 업데이트 주기: 매 빌드

비공개 테스트 (Closed Testing)
├── 대상: QA팀 + 베타 테스터 (최대 2,000명)
├── 목적: 안정성 테스트, 밸런스 확인
├── 기간: 출시 2주 전
└── 피드백 수집: Google 그룹스/이메일

공개 테스트 (Open Testing)
├── 대상: 누구나 참여 가능
├── 목적: 대규모 안정성 테스트, 스토어 최적화
├── 기간: 출시 1주 전
└── 크래시율 기준: 1% 미만 확인

프로덕션 (Production)
├── 대상: 전체 사용자
├── 단계별 출시: 10% → 25% → 50% → 100%
├── 모니터링: 크래시율, ANR율, 평점
└── 롤백 기준: 크래시율 3% 이상 시
```

### 5.5 앱 서명

| 항목 | 설정 |
|------|------|
| 서명 방식 | Google Play 앱 서명 (Play App Signing) |
| 업로드 키 | 자체 관리 (별도 키스토어) |
| 키 알고리즘 | RSA 2048-bit |
| 키스토어 보관 | 암호화된 저장소 (팀 Vault) |
| 키 비밀번호 | 환경 변수 (CI/CD에서 주입) |

```
[앱 서명 흐름]

개발자 (업로드 키로 서명)
        |
        v
+---------------------------+
| AAB 업로드                 |
| (업로드 키로 서명됨)        |
+---------------------------+
        |
        v
+---------------------------+
| Google Play Console        |
| - 업로드 키 서명 검증       |
| - 업로드 키 서명 제거       |
| - 앱 서명 키로 재서명       |
+---------------------------+
        |
        v
+---------------------------+
| 사용자에게 배포             |
| (Google 앱 서명 키 적용됨)  |
+---------------------------+
```

**키 관리 체크리스트**:
- [ ] 업로드 키 생성 (keytool)
- [ ] 키스토어 파일 안전 보관 (최소 2곳 백업)
- [ ] 키스토어 비밀번호 보안 저장 (Vault/KMS)
- [ ] Google Play 앱 서명 등록
- [ ] 업로드 키 분실 시 복구 프로세스 문서화
- [ ] CI/CD 환경변수에 키스토어 정보 설정

### 5.6 스토어 등록 정보

#### 5.6.1 그래픽 에셋

| 에셋 | 사양 | 수량 |
|------|------|------|
| 앱 아이콘 | 512 x 512 PNG | 1개 |
| 기능 그래픽 | 1024 x 500 PNG/JPG | 1개 |
| 스크린샷 (폰) | 16:9 비율, 최소 1080px | 4~8장 |
| 스크린샷 (태블릿) | 16:9 비율, 최소 1080px | 4~8장 |
| 프로모션 동영상 | YouTube URL (30초~2분) | 1개 (선택) |

#### 5.6.2 스토어 설명 (한국어)

```
[간단한 설명 (80자)]
육각형 블록을 합쳐서 최고 점수를 달성하세요! 쉽지만 중독성 있는 두뇌 퍼즐 게임

[자세한 설명 (4000자)]
Hexa Merge Basic - 두뇌를 자극하는 헥사 머지 퍼즐!

게임 방법:
- 헥사곤 보드에 블록을 배치하세요
- 같은 숫자의 블록이 인접하면 자동으로 합쳐집니다
- 더 높은 숫자를 만들어 최고 점수에 도전하세요

특징:
- 심플하고 직관적인 조작
- 광고 강제 재생 없음 (선택형 광고만)
- 다양한 테마와 스킨
- 오프라인 플레이 지원
- Google Play 게임 연동 (클라우드 저장)

지금 무료로 다운로드하세요!
```

### 5.7 안드로이드 배포 체크리스트

- [ ] Package Name 확정 (com.hexamerge.basic)
- [ ] 앱 아이콘 제작 (512x512)
- [ ] 기능 그래픽 제작 (1024x500)
- [ ] 스크린샷 제작 (폰 + 태블릿)
- [ ] 스토어 설명 작성 (한국어 + 영어)
- [ ] 개인정보처리방침 페이지 작성 및 호스팅
- [ ] 키스토어 생성 및 백업
- [ ] Google Play 앱 서명 등록
- [ ] AAB 빌드 생성
- [ ] 내부 테스트 트랙 배포
- [ ] IARC 콘텐츠 등급 설문 완료
- [ ] 데이터 안전 섹션 작성
- [ ] 비공개 테스트 → 공개 테스트 → 프로덕션 순차 출시
- [ ] 단계별 출시(Staged Rollout) 설정
- [ ] 크래시/ANR 모니터링 설정
- [ ] 스토어 등록 정보 최적화(ASO)

---

## 6. 분석 및 추적

### 6.1 Firebase Analytics 연동

#### 6.1.1 SDK 구성

| 플랫폼 | SDK | 비고 |
|--------|-----|------|
| Android | Firebase Android SDK | 네이티브 통합 |
| WebGL | Firebase JS SDK (9.x modular) | jslib 플러그인으로 브릿지 |

#### 6.1.2 초기화 흐름

```
[Firebase Analytics 초기화]

앱 시작
    |
    v
+---------------------------+
| Firebase 초기화             |
| FirebaseApp.Create()       |
+---------------------------+
    |
    v
+---------------------------+
| Analytics 수집 동의 확인    |
| (GDPR/개인정보 동의)       |
+---------------------------+
    |
    +--- 동의 ---+--- 거부 ---+
    |                          |
    v                          v
+------------------+   +------------------+
| Analytics 활성화  |   | Analytics 비활성화 |
| 이벤트 수집 시작  |   | 이벤트 수집 중단  |
+------------------+   +------------------+
    |
    v
+------------------+
| 사용자 속성 설정  |
| - platform       |
| - app_version    |
| - user_tier      |
+------------------+
```

### 6.2 핵심 이벤트 추적 목록

#### 6.2.1 게임플레이 이벤트

| 이벤트명 | 트리거 시점 | 파라미터 | 설명 |
|---------|-----------|---------|------|
| `game_start` | 게임 시작 | `mode`, `theme` | 새 게임 시작 |
| `game_over` | 게임 오버 | `score`, `max_number`, `duration_sec`, `total_merges` | 게임 종료 |
| `merge_block` | 블록 합체 | `from_number`, `to_number`, `combo_count` | 블록 합체 발생 |
| `high_score` | 최고 점수 갱신 | `previous_score`, `new_score` | 최고 점수 달성 |
| `use_hint` | 힌트 사용 | `remaining_hints`, `source` | 힌트 사용 |
| `use_item` | 아이템 사용 | `item_type`, `remaining_count` | 아이템 사용 |
| `continue_game` | 광고 이어하기 | `score_at_continue` | 광고 시청 후 이어하기 |
| `level_milestone` | 숫자 달성 | `number_reached`, `time_to_reach` | 특정 숫자 최초 달성 |

#### 6.2.2 수익화 이벤트

| 이벤트명 | 트리거 시점 | 파라미터 | 설명 |
|---------|-----------|---------|------|
| `ad_impression` | 광고 표시 완료 | `ad_type`, `trigger_point`, `network` | 광고 노출 |
| `ad_click` | 광고 클릭 | `ad_type`, `trigger_point` | 광고 클릭 |
| `ad_reward_claimed` | 광고 보상 수령 | `reward_type`, `reward_amount`, `trigger_point` | 보상 수령 |
| `ad_failed` | 광고 로드 실패 | `error_code`, `network`, `trigger_point` | 광고 실패 |
| `purchase_initiated` | 구매 시작 | `product_id`, `price`, `currency` | 구매 플로우 시작 |
| `purchase_completed` | 구매 완료 | `product_id`, `price`, `currency`, `transaction_id` | 구매 성공 |
| `purchase_failed` | 구매 실패 | `product_id`, `error_code`, `error_message` | 구매 실패 |
| `purchase_refunded` | 환불 처리 | `product_id`, `transaction_id` | 환불 발생 |

#### 6.2.3 사용자 행동 이벤트

| 이벤트명 | 트리거 시점 | 파라미터 | 설명 |
|---------|-----------|---------|------|
| `session_start` | 앱 시작 | `platform`, `version` | 세션 시작 |
| `session_end` | 앱 종료 | `duration_sec`, `games_played` | 세션 종료 |
| `tutorial_start` | 튜토리얼 시작 | `step` | 튜토리얼 진입 |
| `tutorial_complete` | 튜토리얼 완료 | `duration_sec` | 튜토리얼 완료 |
| `tutorial_skip` | 튜토리얼 스킵 | `skipped_at_step` | 튜토리얼 건너뛰기 |
| `shop_opened` | 상점 열기 | `from_screen` | 상점 UI 열기 |
| `theme_changed` | 테마 변경 | `theme_id` | 테마 변경 |
| `settings_changed` | 설정 변경 | `setting_key`, `new_value` | 설정 값 변경 |
| `daily_login` | 일일 접속 | `consecutive_days`, `reward_type` | 일일 출석 |
| `share_score` | 점수 공유 | `score`, `platform` | SNS 공유 |

#### 6.2.4 사용자 속성 (User Properties)

| 속성명 | 타입 | 설명 |
|--------|------|------|
| `user_tier` | string | free / premium (광고 제거 구매 여부) |
| `total_spend` | float | 총 결제 금액 (USD) |
| `days_since_install` | int | 설치 후 경과일 |
| `games_played_total` | int | 총 플레이 횟수 |
| `highest_number` | int | 달성한 최대 숫자 |
| `preferred_theme` | string | 가장 많이 사용한 테마 |

### 6.3 A/B 테스트 설계

#### 6.3.1 Firebase Remote Config 기반

```
[A/B 테스트 실행 흐름]

Firebase Console에서 A/B 테스트 생성
        |
        v
+---------------------------+
| 테스트 조건 설정            |
| - 대상 사용자 비율 (50/50) |
| - 타깃 사용자 속성          |
| - 기간 설정                |
+---------------------------+
        |
        v
+---------------------------+
| Remote Config 값 분기      |
| - 대조군(A): 기존 값       |
| - 실험군(B): 변경 값       |
+---------------------------+
        |
        v
+---------------------------+
| 클라이언트에서 값 적용      |
| fetchAndActivate()        |
+---------------------------+
        |
        v
+---------------------------+
| 사용자 행동 데이터 수집     |
| (Analytics 이벤트)        |
+---------------------------+
        |
        v
+---------------------------+
| 결과 분석                  |
| - 목표 지표 비교           |
| - 통계적 유의성 확인        |
| - 승자 결정 및 전체 적용    |
+---------------------------+
```

#### 6.3.2 예정 A/B 테스트 목록

| # | 테스트명 | 변수 | 대조군(A) | 실험군(B) | 목표 지표 |
|---|---------|------|----------|----------|----------|
| 1 | 이어하기 보상 | 이어하기 광고 노출 타이밍 | 즉시 팝업 | 3초 지연 | 광고 시청률 |
| 2 | 상점 진입점 | 코인 부족 시 상점 유도 | 토스트만 | 상점 바로가기 팝업 | 구매 전환율 |
| 3 | 힌트 회복 시간 | 자연 힌트 회복 시간 | 10분 | 15분 | 광고 시청률 |
| 4 | 스타터 팩 가격 | 스타터 팩 가격 | $2.99 | $1.99 | 매출 (ARPU) |
| 5 | 일일 보상 | 일일 접속 보상 유형 | 코인 50 | 랜덤 박스 | Day7 리텐션 |

### 6.4 크래시 리포팅 (Firebase Crashlytics)

#### 6.4.1 설정

```
[Crashlytics 연동 구성]

Android:
├── Firebase Crashlytics SDK 추가
├── gradle 플러그인 적용
├── NDK 크래시 심볼 업로드 (IL2CPP용)
└── ProGuard 매핑 파일 자동 업로드

WebGL:
├── window.onerror 핸들러 등록
├── 커스텀 에러 리포팅 (Firebase Functions로 전송)
└── Source Map 업로드 (심볼리케이션)
```

#### 6.4.2 커스텀 키 설정

| 키 | 값 예시 | 용도 |
|----|--------|------|
| `last_screen` | "GamePlay" | 마지막 활성 화면 |
| `game_score` | "1234" | 크래시 시 점수 |
| `board_state` | "hash:abc123" | 보드 상태 해시 |
| `memory_usage` | "128MB" | 메모리 사용량 |
| `session_duration` | "300s" | 세션 지속 시간 |
| `ad_network` | "admob" | 사용 중인 광고 네트워크 |

#### 6.4.3 비치명적 오류 기록

- 광고 로드 실패
- 결제 프로세스 오류
- 클라우드 저장 동기화 실패
- 네트워크 요청 타임아웃
- JSON 파싱 오류

### 6.5 사용자 행동 분석

#### 6.5.1 핵심 KPI 대시보드

```
[KPI 대시보드 구성]

리텐션:
├── Day 1 리텐션 (목표: 40%+)
├── Day 7 리텐션 (목표: 20%+)
├── Day 30 리텐션 (목표: 10%+)
└── DAU / MAU 비율

수익화:
├── ARPU (사용자당 평균 수익)
├── ARPPU (결제 사용자당 평균 수익)
├── 광고 eCPM
├── 광고 시청률 (광고 가능 사용자 중 시청 비율)
├── 전환율 (무료 → 결제 사용자)
└── LTV (사용자 생애 가치)

참여도:
├── 일평균 세션 수
├── 평균 세션 길이
├── 일평균 게임 플레이 횟수
├── 평균 게임 플레이 시간
└── 기능별 사용률 (힌트, 아이템, 테마)

퍼널:
├── 설치 → 튜토리얼 시작 → 튜토리얼 완료
├── 첫 게임 → 두 번째 게임 → 세 번째 게임
├── 상점 방문 → 상품 조회 → 구매 완료
└── 광고 버튼 노출 → 클릭 → 시청 완료
```

#### 6.5.2 퍼널 분석 플로우

```
[사용자 전환 퍼널]

앱 설치 / 첫 방문
        |  (100%)
        v
튜토리얼 시작
        |  (목표: 90%)
        v
튜토리얼 완료
        |  (목표: 70%)
        v
첫 번째 게임 완료
        |  (목표: 80%)
        v
두 번째 게임 시작
        |  (목표: 60%)
        v
첫 광고 시청 (보상형)
        |  (목표: 30%)
        v
Day 1 재방문
        |  (목표: 40%)
        v
첫 구매
        |  (목표: 3~5%)
        v
반복 구매
        |  (목표: 1~2%)
```

### 6.6 분석 및 추적 체크리스트

- [ ] Firebase 프로젝트 생성 및 앱 등록
- [ ] Firebase Analytics SDK 연동 (Android)
- [ ] Firebase Analytics JS SDK 연동 (WebGL)
- [ ] 모든 커스텀 이벤트 구현 및 태깅
- [ ] 사용자 속성 설정 구현
- [ ] Firebase Crashlytics 연동 (Android)
- [ ] WebGL 에러 리포팅 시스템 구현
- [ ] NDK 심볼 파일 업로드 설정
- [ ] Firebase Remote Config 설정
- [ ] A/B 테스트 첫 번째 실험 설정
- [ ] Firebase Console 대시보드 구성
- [ ] BigQuery Export 설정 (선택)
- [ ] 디버그 모드 이벤트 검증 (DebugView)
- [ ] GDPR 동의 관리 구현
- [ ] 이벤트 파라미터 네이밍 컨벤션 문서화

---

## 7. 보안

### 7.1 결제 보안

#### 7.1.1 결제 보안 원칙

1. **서버 사이드 검증 필수**: 모든 결제는 서버에서 검증 (클라이언트 검증 결과를 신뢰하지 않음)
2. **결제 금액 서버 결정**: 상품 가격은 서버에서 결정/검증 (클라이언트 금액 변조 방지)
3. **중복 결제 방지**: orderId/transactionId 기반 중복 체크
4. **통신 암호화**: 모든 결제 관련 API는 HTTPS/TLS 1.3 필수

```
[결제 보안 검증 흐름]

클라이언트                     검증 서버                    결제 서버
    |                           |                          (Google/Stripe)
    |                           |                              |
    |-- 구매 요청 ------------->|                              |
    |   (productId, token)     |                              |
    |                           |-- 영수증 검증 요청 --------->|
    |                           |<-- 검증 결과 응답 ------------|
    |                           |                              |
    |                           |-- 검증 로직:                 |
    |                           |   1. 서명 검증               |
    |                           |   2. 상품 ID 일치 확인       |
    |                           |   3. 금액 일치 확인          |
    |                           |   4. 중복 거래 확인          |
    |                           |   5. 타임스탬프 유효성       |
    |                           |                              |
    |<-- 검증 성공 + 아이템 ---|                              |
    |    데이터 (서명된 응답)   |                              |
    |                           |                              |
    |-- 아이템 적용 확인 ----->|                              |
    |                           |-- DB에 거래 기록 저장        |
    |<-- 최종 확인 ------------|                              |
```

#### 7.1.2 결제 관련 보안 체크리스트

- [ ] 서버 영수증 검증 API 구현
- [ ] Google Play 서비스 계정 키 안전 보관 (환경변수/KMS)
- [ ] Stripe Secret Key 서버에만 보관 (클라이언트 노출 금지)
- [ ] Stripe Webhook Signature 검증 구현
- [ ] 중복 거래 방지 로직 (orderId DB 저장)
- [ ] 결제 로그 감사 추적(Audit Trail) 구현
- [ ] 비정상 결제 패턴 탐지 알림 설정
- [ ] PCI DSS 준수 (카드 정보 직접 처리 안 함 - Stripe 위임)
- [ ] 결제 API Rate Limiting 적용
- [ ] 결제 관련 에러 로그 모니터링

### 7.2 점수 변조 방지

#### 7.2.1 방어 전략

```
[점수 변조 방지 다계층 방어]

계층 1: 클라이언트 보호
├── IL2CPP 빌드 (C# 코드 네이티브 변환)
├── 메모리 값 암호화 (XOR + 솔트)
├── PlayerPrefs 암호화 저장
└── 코드 난독화

계층 2: 무결성 검증
├── 점수 계산 로직 이중화 (실시간 + 검증용)
├── 게임 리플레이 데이터 기록
├── 점수 변화 이력 추적 (매 합체마다)
└── 체크섬/해시 검증

계층 3: 서버 검증 (리더보드 등록 시)
├── 점수 합리성 검증 (시간 대비 최대 가능 점수)
├── 리플레이 데이터 서버 검증
├── 통계적 이상 탐지
└── 신고 시스템
```

#### 7.2.2 메모리 값 보호

```
[메모리 값 암호화 방식]

일반적인 점수 저장:
score = 1234  (메모리 스캐너로 쉽게 검색 가능)

암호화된 점수 저장:
encryptedScore = score XOR randomKey
randomKey = 랜덤 생성 (세션마다 변경)
checksum = HMAC(score, secretKey)

점수 읽기:
actualScore = encryptedScore XOR randomKey
if HMAC(actualScore, secretKey) != checksum:
    변조 감지 → 게임 리셋 또는 경고
```

#### 7.2.3 점수 합리성 검증 규칙

| 규칙 | 조건 | 처리 |
|------|------|------|
| 최대 점수 속도 | 초당 최대 가능 점수 초과 | 의심 플래그 |
| 플레이 시간 | 10초 미만에 고점수 | 무효 처리 |
| 합체 횟수 | 합체 횟수 대비 점수 비정상 | 의심 플래그 |
| 최대 숫자 | 이론적 최대 숫자 초과 | 즉시 무효 |
| 점수 점프 | 비연속적인 점수 증가 | 의심 플래그 |

### 7.3 서버 통신 암호화

#### 7.3.1 통신 보안 구성

```
[서버 통신 보안 아키텍처]

클라이언트                          서버
    |                               |
    |===== HTTPS/TLS 1.3 =========|
    |                               |
    |-- 요청 헤더:                  |
    |   Authorization: Bearer JWT   |
    |   X-Request-ID: uuid          |
    |   X-Timestamp: unix_ms        |
    |   X-Signature: HMAC           |
    |                               |
    |-- 요청 바디:                  |
    |   JSON (민감 데이터 추가 암호화)|
    |                               |
    |<-- 응답:                      |
    |   JSON (서명 포함)             |
    |   X-Response-Signature        |
    |                               |
```

#### 7.3.2 API 보안 적용 사항

| 보안 항목 | 적용 방식 | 대상 |
|----------|----------|------|
| 전송 암호화 | TLS 1.3 | 모든 API |
| 인증 | JWT (Firebase Auth) | 인증 필요 API |
| 요청 서명 | HMAC-SHA256 | 결제/점수 API |
| 타임스탬프 검증 | 5분 이내 요청만 허용 | 모든 API |
| Rate Limiting | IP/사용자별 제한 | 모든 API |
| CORS | 허용 도메인 제한 | 웹 API |
| Input Validation | 서버 사이드 검증 | 모든 API |

#### 7.3.3 Certificate Pinning (Android)

```
[Certificate Pinning 설정]

network_security_config.xml:
├── 도메인: api.hexamerge.example.com
├── 핀: SHA-256 해시 (기본 + 백업)
├── 만료일 설정: 인증서 갱신 대비
└── 디버그 오버라이드: 개발 환경만 허용
```

**주의사항**:
- 인증서 핀 업데이트 없이 인증서 갱신 시 앱 통신 불가
- 반드시 백업 핀 포함
- Remote Config로 핀 업데이트 가능하게 설계 (선택)

### 7.4 난독화 및 Anti-Cheat

#### 7.4.1 코드 난독화

| 플랫폼 | 방어 수단 | 설명 |
|--------|----------|------|
| Android | IL2CPP | C# 코드를 C++로 변환 후 네이티브 컴파일 |
| Android | ProGuard/R8 | Java/Kotlin 코드 난독화 |
| Android | Obfuscator (선택) | IL2CPP 메타데이터 암호화 |
| WebGL | WASM | 네이티브 바이너리 형태로 배포 |
| WebGL | JS 난독화 | 로더/브릿지 JS 코드 난독화 |
| 공통 | 문자열 암호화 | 핵심 문자열(키, URL) 런타임 복호화 |

#### 7.4.2 Anti-Cheat 시스템

```
[Anti-Cheat 다계층 방어 체계]

계층 1: 탐지 (Detection)
├── 루트/탈옥 감지 (Android)
├── 에뮬레이터 감지
├── 스피드핵 감지 (Time.deltaTime 검증)
├── 메모리 변조 도구 감지 (GameGuardian 등)
└── 디버거 연결 감지

계층 2: 방지 (Prevention)
├── 메모리 값 암호화 (7.2.2 참조)
├── 중요 로직 서버 사이드 실행
├── 세이브 파일 암호화 + 무결성 검증
└── 통신 데이터 암호화 + 서명

계층 3: 대응 (Response)
├── 경고 (1차: 경고 메시지)
├── 제한 (2차: 리더보드 등록 차단)
├── 차단 (3차: 계정 제재)
└── 로깅 (모든 탐지 이벤트 서버 기록)
```

#### 7.4.3 치트 탐지 시 대응 정책

```
[치트 탐지 대응 흐름]

치트 행위 탐지
        |
        v
+---------------------------+
| 탐지 이벤트 서버 전송       |
| (탐지 유형, 기기 정보,     |
|  사용자 ID, 타임스탬프)    |
+---------------------------+
        |
        v
+---------------------------+
| 서버: 위반 카운터 증가      |
+---------------------------+
        |
        +--- 1회 ---+--- 2~3회 ---+--- 4회+ ---+
        |            |              |            |
        v            v              v            |
+----------+ +------------+ +------------+      |
| 무시      | | 경고 팝업   | | 리더보드   |      |
| (로그만)  | | "비정상적   | | 등록 차단  |      |
|          | |  활동 감지" | | 30일간    |      |
+----------+ +------------+ +------------+      |
                                                 |
                                                 v
                                         +------------+
                                         | 계정 영구   |
                                         | 리더보드    |
                                         | 차단       |
                                         +------------+
```

**주의사항**:
- 오탐(False Positive) 최소화가 핵심
- 루트/에뮬레이터 감지는 경고만 (게임 차단하지 않음)
- 치트 대응은 게임 접근 차단이 아닌 리더보드/랭킹 제한에 집중
- 결제 사용자에 대한 치트 처리는 신중하게 (CS 비용 고려)

### 7.5 보안 체크리스트

- [ ] 서버 영수증 검증 구현 (Google Play + Stripe)
- [ ] JWT 인증 시스템 구현
- [ ] API HMAC 서명 검증 구현
- [ ] TLS 1.3 적용 확인
- [ ] Certificate Pinning 구현 (Android)
- [ ] CORS 정책 설정 (웹 서버)
- [ ] CSP 헤더 설정
- [ ] Rate Limiting 구현
- [ ] IL2CPP 빌드 확인
- [ ] ProGuard/R8 규칙 설정
- [ ] 메모리 값 암호화 구현 (점수, 코인, 아이템)
- [ ] 세이브 파일 암호화 (AES-256) 구현
- [ ] 스피드핵 감지 로직 구현
- [ ] 루트/에뮬레이터 감지 구현
- [ ] 점수 합리성 검증 로직 구현
- [ ] 치트 탐지 이벤트 로깅 구현
- [ ] 민감 문자열 암호화 (API 키, URL 등)
- [ ] 보안 취약점 점검 (OWASP Mobile Top 10)
- [ ] 난독화 적용 확인 (빌드 후 디컴파일 테스트)
- [ ] 웹 빌드 DevTools 콘솔 보호 (프로덕션)

---

## 부록

### A. 기술 스택 요약

| 영역 | 기술 |
|------|------|
| 게임 엔진 | Unity 6 LTS |
| 스크립팅 | C# (.NET Standard 2.1) |
| 빌드 | IL2CPP (Android + WebGL) |
| 광고 (Android) | Google AdMob + Unity Ads (미디에이션) |
| 광고 (WebGL) | Unity Ads |
| 결제 (Android) | Google Play Billing Library 7.x |
| 결제 (WebGL) | Stripe Checkout |
| 인증 | Firebase Authentication |
| 데이터베이스 | Firebase Firestore |
| 분석 | Firebase Analytics |
| 크래시 | Firebase Crashlytics |
| A/B 테스트 | Firebase Remote Config |
| 호스팅 | Firebase Hosting + Cloudflare CDN |
| CI/CD | GitHub Actions (빌드 자동화) |

### B. 환경별 설정 비교

| 설정 항목 | Android | WebGL |
|----------|---------|-------|
| 광고 SDK | AdMob + Unity Ads | Unity Ads |
| 결제 | Google Play Billing | Stripe |
| 로컬 저장 | PlayerPrefs + 암호화 파일 | LocalStorage + IndexedDB |
| 클라우드 저장 | Google Play Games Saved Games | Firebase Firestore |
| 인증 | Google Play Games + Firebase | Firebase (Google/익명) |
| 크래시 리포팅 | Crashlytics (네이티브) | 커스텀 에러 핸들러 |
| 앱 서명 | Google Play App Signing | N/A |
| 배포 | Google Play Console | Firebase Hosting |

### C. 우선순위 로드맵

| 단계 | 항목 | 우선순위 | 예상 기간 |
|------|------|---------|----------|
| 1 | 핵심 게임플레이 완성 | 최우선 | 4주 |
| 2 | 로컬 데이터 저장 | 높음 | 1주 |
| 3 | 광고 보상 시스템 (Android) | 높음 | 2주 |
| 4 | 인앱 결제 (Android) | 높음 | 2주 |
| 5 | Firebase Analytics 연동 | 중간 | 1주 |
| 6 | Crashlytics 연동 | 중간 | 3일 |
| 7 | 클라우드 저장 / 동기화 | 중간 | 2주 |
| 8 | Android 빌드 및 스토어 배포 | 높음 | 1주 |
| 9 | WebGL 빌드 최적화 | 중간 | 2주 |
| 10 | 웹 결제 (Stripe) | 중간 | 2주 |
| 11 | 웹 광고 시스템 | 중간 | 1주 |
| 12 | 보안 강화 | 중간 | 2주 |
| 13 | A/B 테스트 설정 | 낮음 | 1주 |
| 14 | PWA 지원 | 낮음 | 3일 |
| 15 | ASO/SEO 최적화 | 낮음 | 1주 |

### D. 참고 자료

- [Google Play Billing Library 문서](https://developer.android.com/google/play/billing)
- [AdMob Unity 플러그인](https://developers.google.com/admob/unity/quick-start)
- [Unity Ads 문서](https://docs.unity.com/ads/en-us/manual/UnityAdsHome)
- [Firebase Unity SDK](https://firebase.google.com/docs/unity/setup)
- [Stripe Checkout 문서](https://stripe.com/docs/payments/checkout)
- [Unity WebGL 빌드 가이드](https://docs.unity3d.com/Manual/webgl-building.html)
- [Google Play Console 도움말](https://support.google.com/googleplay/android-developer)
- [OWASP Mobile Security Testing Guide](https://owasp.org/www-project-mobile-security-testing-guide/)

---

> **문서 이력**
> | 버전 | 날짜 | 작성자 | 변경 내용 |
> |------|------|--------|----------|
> | 1.0 | 2026-02-13 | - | 최초 작성 |
