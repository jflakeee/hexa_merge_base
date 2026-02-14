# Test Bridge API Requirements

> 테스트 스펙 5개에서 요구하는 Unity 측 API 요구사항 정리
> 생성일: 2026-02-13

---

## 1. TestBridge (ui-components.spec.ts) -- 72 TC

### 1.1 대상 GameObject: `TestBridge`

ui-components.spec.ts에서 `SendMessage('TestBridge', ...)` 형태로 호출하는 모든 메서드.

### 1.2 필요 메서드 (SendMessage)

| 메서드명 | 파라미터(string) | 설명 | 사용 TC |
|---|---|---|---|
| `Query` | queryPath (string) | 내부 상태 조회. 결과를 `window.__unityQueryCallback(result)` 콜백으로 반환 | 거의 모든 TC |
| `NavigateTo` | screenName (string) | 특정 화면으로 직접 이동 | TC-UI-009~043 |
| `SetScore` | score (string, 정수) | 현재 점수를 강제 설정 | TC-UI-031 |
| `SetBestScore` | score (string, 정수) | 최고 점수를 강제 설정 | TC-UI-031, TC-UI-019 |
| `SetGems` | count (string, 정수) | 보유 젬 수를 강제 설정 | TC-UI-027, TC-UI-028 |
| `SetHints` | count (string, 정수) | 보유 힌트 수를 강제 설정 | TC-UI-027 |
| `ClearSaveData` | (빈 문자열) | 저장 데이터 전체 초기화 | TC-UI-003, TC-UI-019 |
| `TriggerToast` | message (string) | 토스트 메시지 표시 | TC-UI-042, TC-UI-043 |

### 1.3 Query 경로 목록

`TestBridge.Query(queryPath)` 호출 시 사용되는 경로와 기대 반환값:

| queryPath | 기대 반환값(string) | 설명 |
|---|---|---|
| `CurrentScreen` | `"Gameplay"`, `"Pause"`, `"GameOver"`, `"Shop"`, `"Leaderboard"`, `"Settings"`, `"MainMenu"` | 현재 활성 화면 |
| `Game.TimeScale` | `"1"` 등 | Time.timeScale 값 |
| `Currency.Gems` | 정수 문자열 (예: `"100"`) | 보유 젬 수 |
| `Shop.CurrentTab` | `"Items"`, `"Coins"`, `"NoAds"` | 상점 현재 탭 |
| `Items.HintCount` | 정수 문자열 | 보유 힌트 수 |
| `Leaderboard.CurrentTab` | `"All"`, `"Weekly"`, `"Friends"` | 리더보드 현재 탭 |
| `ResponsiveLayout.CurrentBreakpoint` | `"Mobile"`, `"Tablet"`, `"Desktop"` | 현재 브레이크포인트 |
| `ResponsiveLayout.SidebarVisible` | `"true"` / `"false"` | 사이드바 표시 여부 |
| `Settings.MuteEnabled` | `"true"` / `"false"` | 음소거 상태 |
| `Settings.BGMVolume` | `"0.7"` 등 (0.0~1.0) | BGM 볼륨 |
| `Settings.SFXVolume` | `"1.0"` 등 (0.0~1.0) | SFX 볼륨 |
| `Settings.LanguageIndex` | `"0"` (한국어), `"1"` (English) | 언어 인덱스 |
| `MainMenu.PlayButton.Active` | `"true"` / `"false"` | PLAY 버튼 활성 상태 |
| `MainMenu.BestScoreText` | `"Best: 1,234"` 형태 | 최고 점수 텍스트 |
| `MainMenu.ContinueButton.Active` | `"true"` / `"false"` | CONTINUE 버튼 활성 상태 |

### 1.4 콜백 메커니즘

```
JS -> SendMessage('TestBridge', 'Query', queryPath)
Unity -> WebGLBridge.CallJSCallback("__unityQueryCallback", resultString)
JS <- window.__unityQueryCallback(result) 호출됨
```

### 1.5 NavigateTo 지원 화면 목록

- `"GameOver"` - 게임 오버 화면
- `"Shop"` - 상점 화면
- `"Leaderboard"` - 리더보드 화면
- `"Settings"` - 설정 화면
- `"MainMenu"` - 메인 메뉴

---

## 2. HexaTestBridge (animation.spec.ts) -- 37 TC

### 2.1 대상 GameObject: `HexaTestBridge`

animation.spec.ts에서 `window.HexaTest.*` JS API를 통해 호출.
jslib의 `RegisterHexaTestAPI()`가 JS 측 래퍼를 등록하며, 내부적으로 `SendMessage('HexaTestBridge', ...)` 호출.

### 2.2 window.HexaTest JS API (이미 jslib에 정의됨)

| JS 메서드 | 내부 호출 | 파라미터 | 반환 | 설명 |
|---|---|---|---|---|
| `triggerSpawnAnimation(count)` | `HexaTestBridge.TriggerSpawnAnimation` | count (number→string) | void | 블록 생성 애니메이션 트리거 |
| `triggerMerge(q1,r1,q2,r2)` | `HexaTestBridge.TriggerMerge` | `"q1,r1,q2,r2"` | void | 머지 애니메이션 트리거 |
| `triggerCombo(count)` | `HexaTestBridge.TriggerCombo` | count (number→string) | void | 콤보 이펙트 트리거 |
| `triggerWaveAnimation(direction)` | `HexaTestBridge.TriggerWaveAnimation` | `"BottomToTop"` / `"LeftToRight"` / `"OuterToCenter"` / `"auto"` | void | 파도 웨이브 트리거 |
| `triggerScreenTransition(from, to)` | `HexaTestBridge.TriggerScreenTransition` | `"from,to"` | void | 화면 전환 트리거 |
| `isAnimationPlaying()` | `HexaTestBridge.IsAnimationPlaying` | `"callbackId\|"` | Promise\<boolean\> | 현재 애니메이션 재생 중 여부 |
| `getBlockScale(q, r)` | `HexaTestBridge.GetBlockScale` | `"callbackId\|q,r"` | Promise\<number\> | 특정 블록의 현재 스케일 |
| `getBlockAlpha(q, r)` | `HexaTestBridge.GetBlockAlpha` | `"callbackId\|q,r"` | Promise\<number\> | 특정 블록의 현재 알파 |
| `getAnimationState()` | `HexaTestBridge.GetAnimationState` | `"callbackId\|"` | Promise\<AnimState\> | 전체 애니메이션 상태 객체 |
| `getFPS()` | `HexaTestBridge.GetFPS` | `"callbackId\|"` | Promise\<number\> | 현재 FPS |
| `setBoardState(stateJson)` | `HexaTestBridge.SetBoardState` | JSON string | void | 보드 상태 강제 설정 |

### 2.3 HexaTestBridge C# 메서드 (구현 필요)

SendMessage 파라미터 형식: `"callbackId|param"` (void 함수는 param만)

**Void 메서드 (callUnityVoid):**

| 메서드명 | 파라미터 파싱 | 동작 |
|---|---|---|
| `TriggerSpawnAnimation` | `int count` | count개 블록 생성 애니메이션 시작. Scale(0->1.1->1.0) + Fade(0->1), 250ms, 0.03초 순차 딜레이 |
| `TriggerMerge` | `"q1,r1,q2,r2"` 파싱 | 두 셀 간 머지 시퀀스 실행 (이동→크로스페이드→팽창→정착, 500ms) |
| `TriggerCombo` | `int count` | 콤보 x{count} 이펙트 (x2:텍스트, x3:흔들림, x4:글로우+파티클, x5+:플래시+대형파티클) |
| `TriggerWaveAnimation` | `string direction` | 파도 웨이브 (`BottomToTop`/`LeftToRight`/`OuterToCenter`/`auto`) |
| `TriggerScreenTransition` | `"from,to"` 파싱 | 화면 전환 애니메이션 (CircleWipe/OverlayFade/Slide, 0.3~0.5초) |
| `SetBoardState` | JSON `{"blocks":[{"q":0,"r":0,"value":32},...]}` | 보드 타일 강제 설정 |

**콜백 메서드 (callUnity -> Promise):**

| 메서드명 | 파라미터 파싱 | 콜백 반환 형식 |
|---|---|---|
| `IsAnimationPlaying` | `"callbackId\|"` | `{"__hexaTestCallback":true,"id":"ht_1","result":true/false}` |
| `GetBlockScale` | `"callbackId\|q,r"` | `{"__hexaTestCallback":true,"id":"ht_2","result":1.0}` |
| `GetBlockAlpha` | `"callbackId\|q,r"` | `{"__hexaTestCallback":true,"id":"ht_3","result":1.0}` |
| `GetAnimationState` | `"callbackId\|"` | `{"__hexaTestCallback":true,"id":"ht_4","result":{...}}` |
| `GetFPS` | `"callbackId\|"` | `{"__hexaTestCallback":true,"id":"ht_5","result":60}` |

### 2.4 AnimationState 객체 구조

`getAnimationState()` 반환값 (테스트에서 참조하는 프로퍼티):

```json
{
  "phase": "moving" | "merging" | "expanding" | "settling" | "idle",
  "shaking": true | false,
  "comboVisible": true | false,
  "waveDirection": "BottomToTop" | "LeftToRight" | "OuterToCenter"
}
```

### 2.5 콜백 메커니즘 (jslib에서 정의)

```
JS -> window.HexaTest.getBlockScale(q, r)
  -> callUnity('GetBlockScale', 'q,r')
  -> SendMessage('HexaTestBridge', 'GetBlockScale', 'ht_1|q,r')
Unity -> WebGLBridge.SendToJS('{"__hexaTestCallback":true,"id":"ht_1","result":1.0}')
  -> CustomEvent('unityMessage') 발송
JS <- pendingCallbacks["ht_1"](result) -> Promise resolve
```

---

## 3. AdManager CustomEvent (ad-reward.spec.ts) -- 35 TC

### 3.1 대상 GameObject: `AdManager`

### 3.2 기존 SendMessage 메서드 (이미 구현됨)

| 메서드명 | 파라미터 | 설명 | 현재 상태 |
|---|---|---|---|
| `InitializeAds` | `""` | 광고 시스템 초기화 | 구현됨 |
| `ShowBanner` | `""` | 배너 표시 | 구현됨 |
| `HideBanner` | `""` | 배너 숨김 | 구현됨 |
| `LoadRewardedAd` | `""` | 보상형 광고 로드 | 구현됨 |
| `ShowRewardedAd` | rewardType (`""`, `"Continue"`, `"RemoveTile"`, `"UndoMove"`, `"InvalidType"`) | 보상형 광고 표시 | 구현됨 |
| `ResetAllCooldowns` | `""` | 쿨다운 초기화 | 구현됨 |
| `SetMockAdResult` | `"success"` / `"cancel"` / `"fail"` | Mock 결과 설정 | 구현됨 |
| `SetMockAdDelay` | seconds (string) | Mock 딜레이 설정 | 구현됨 |
| `SetAdsRemoved` | `"true"` / `"false"` | 광고 제거 상태 | 구현됨 |
| `SetDailyAdCount` | count (string, 정수) | 일일 광고 카운트 | 구현됨 |
| `ResetDailyAdCount` | `""` | 일일 카운트 리셋 | 구현됨 |
| `SimulateUTCMidnight` | `""` | UTC 자정 시뮬레이션 | 구현됨 |
| `SetConsecutiveFailures` | count (string, 정수) | 연속 실패 횟수 | 구현됨 |
| `AdvanceTime` | seconds (string) | 시간 전진 | 구현됨 |
| `CheckGDPRConsent` | `""` | GDPR 동의 확인 | 구현됨 |

### 3.3 필요 CustomEvent 목록

테스트에서 `waitForAdEvent(bridge, eventName)`으로 대기하는 이벤트들.
`CustomEvent('unityMessage', { detail: {...} })` 형태로 디스패치 필요.

| event 이름 | detail 필드 | 현재 디스패치 여부 | 미구현 항목 |
|---|---|---|---|
| `adInitialized` | `{event, stubMode:true, adsRemoved:bool}` | 구현됨 | -- |
| `bannerShown` | `{event, adUnitId:string}` | 구현됨 | -- |
| `bannerHidden` | `{event}` | 구현됨 | -- |
| `rewardAdLoaded` | `{event, adUnitId:string}` | 구현됨 | -- |
| `rewardAdFailed` | `{event, reason:string}` | 구현됨 | -- |
| `rewardGranted` | `{event, rewardType:string}` | 구현됨 | -- |
| `rewardAdCancelled` | `{event, rewardType:string}` | 구현됨 | -- |
| `rewardAdClosed` | `{event, rewardType:string}` | 구현됨 | -- |
| `rewardAdCooldown` | `{event, remainingSeconds:number}` | **미구현** | ShowRewardedAd 쿨다운 시 이벤트명이 다름 |
| `dailyLimitReached` | `{event}` | **미구현** | 일일 한도 20회 초과 시 디스패치 필요 |
| `adsDisabledByFailure` | `{event}` | **미구현** | 연속 3회 실패 후 디스패치 필요 |
| `adsRemovedBlocked` | `{event, adType:string}` | **미구현** | AdsRemoved 상태에서 ShowBanner 시 디스패치 필요 |
| `gdprConsentRequired` | `{event}` | **미구현** | GDPR 동의가 필요할 때 디스패치 필요 |
| `gdprConsentUpdated` | `{event, consented:bool}` | **미구현** | GDPR 동의 상태 변경 시 디스패치 필요 |

### 3.4 추가 필요 SendMessage 대상 (GDPR)

| GameObject | 메서드명 | 파라미터 | 설명 |
|---|---|---|---|
| `GDPRConsentManager` | `ResetConsent` | `""` | 동의 상태 초기화 |
| `GDPRConsentManager` | `SetConsent` | `"true"` / `"false"` | GDPR 동의 설정 |

### 3.5 AdManager 수정 필요사항 요약

1. **ShowRewardedAd 쿨다운 이벤트**: 현재 `rewardAdFailed` + `reason:cooldown`으로 보내지만, 테스트는 `rewardAdCooldown` + `remainingSeconds` 필드 기대
2. **일일 한도 체크**: dailyAdCount >= 20일 때 `dailyLimitReached` 이벤트 디스패치 + 광고 차단
3. **연속 실패 체크**: consecutiveFailures >= 3일 때 `adsDisabledByFailure` 이벤트 디스패치
4. **AdsRemoved 차단 이벤트**: AdsRemoved=true 상태에서 ShowBanner시 `adsRemovedBlocked` (adType 포함)
5. **쿨다운 cancel 면제**: 현재 SimulateRewardAd에서 cancel 시에도 `lastRewardAdTime` 기록됨 -> cancel 시에는 쿨다운 시작하지 않도록 수정
6. **GDPRConsentManager** GameObject + 스크립트 신규 필요 (또는 AdManager에 통합)

---

## 4. IAPManager (iap.spec.ts) -- 36 TC

### 4.1 대상 GameObject: `IAPManager`

### 4.2 기존 SendMessage 메서드 (이미 구현됨)

| 메서드명 | 파라미터 | 설명 | 현재 상태 |
|---|---|---|---|
| `JS_GetIAPState` | callbackId (string) | IAP 전체 상태를 CustomEvent로 반환 | 구현됨 |
| `PurchaseProduct` | productId (string, enum이름) | 구매 시뮬레이션 | 구현됨 |
| `SetMockPurchaseResult` | result (string) | Mock 결과 설정 | 구현됨 |
| `ResetAllPurchases` | `""` | 모든 구매 초기화 | 구현됨 |
| `SimulateRestorePurchases` | productIds (쉼표 구분) | 구매 복원 시뮬레이션 | 구현됨 |

### 4.3 JS_GetIAPState 반환 데이터 구조

테스트에서 기대하는 CustomEvent detail:

```json
{
  "callbackId": "iap_xxx_abc123",
  "isInitialized": true,
  "products": [
    {
      "productId": "RemoveAds",
      "type": "non-consumable",
      "price": "$2.99",
      "isAvailable": true
    },
    {
      "productId": "GemPack_Small",
      "type": "consumable",
      "price": "$0.99",
      "isAvailable": true
    },
    {
      "productId": "GemPack_Large",
      "type": "consumable",
      "price": "$4.99",
      "isAvailable": true
    },
    {
      "productId": "UndoPack",
      "type": "consumable",
      "price": "$1.99",
      "isAvailable": true
    }
  ],
  "purchasedNonConsumables": [],
  "isAdsRemoved": false,
  "lastPurchaseResult": null | {
    "productId": "GemPack_Small",
    "isSuccess": true,
    "failureReason": ""
  }
}
```

### 4.4 IAPManager 수정 필요사항

1. **purchaseComplete 이벤트**: 테스트는 `waitForIAPEvent(page, 'purchaseComplete')` 기대 -> 현재는 `purchaseSuccess` / `purchaseFailed`로 분리 발송. **이벤트명 통일 필요**:
   - 성공 시: `{event:"purchaseComplete", productId, isSuccess:true, failureReason:""}`
   - 실패 시: `{event:"purchaseComplete", productId, isSuccess:false, failureReason:"..."}`

2. **restoreComplete 이벤트**: 테스트는 `waitForIAPEvent(page, 'restoreComplete')` + `restoredProducts[]` 기대 -> 현재는 `purchasesRestored` 이벤트. **이벤트 구조 수정 필요**:
   - `{event:"restoreComplete", restoredProducts:["RemoveAds"]}`

3. **SimulateRestorePurchases 파라미터 파싱**: 테스트에서 `simulateRestorePurchases(page, ['RemoveAds'])` -> 쉼표 구분 문자열로 전달. 현재 구현은 파라미터를 무시하고 PlayerPrefs 기반으로만 복원 -> **전달된 productIds를 기반으로 복원하도록 수정 필요**

4. **gamebridge.isAdsRemoved()**: iap.spec.ts에서 `window.gamebridge?.isAdsRemoved?.()` 호출 -> window.gamebridge 객체에 isAdsRemoved 함수 등록 필요

5. **JS_OpenShop / JS_CloseShop**: 현재 WebGLBridge에 구현됨 -> `GameManager` 대상이므로 OK

### 4.5 추가 필요 SendMessage (GameManager 경유)

| 대상 | 메서드 | 설명 | 현재 상태 |
|---|---|---|---|
| `GameManager` | `JS_OpenShop` | 상점 화면 열기 | WebGLBridge에 구현됨 |
| `GameManager` | `JS_CloseShop` | 상점 화면 닫기 | WebGLBridge에 구현됨 |

---

## 5. AudioManager (audio.spec.ts) -- 52 TC (2 TC 미통과)

### 5.1 대상 GameObject: `AudioManager`

### 5.2 기존 SendMessage 메서드

| 메서드명 | 파라미터 | 설명 | 현재 상태 |
|---|---|---|---|
| `QueryAudioState` | `""` (무시) | 오디오 상태를 `window.__unityAudioState`에 기록 | **부분 구현** |
| `PlaySFXByName` | sfxName (string) | 이름으로 SFX 재생 | **미구현** |
| `SetMasterVolume` | volume (float→string) | 마스터 볼륨 설정 | **부분 구현** (float만 지원) |
| `SetBGMVolume` | volume (float→string) | BGM 볼륨 설정 | **미구현** |
| `SetSFXVolume` | volume (float→string) | SFX 볼륨 설정 | **미구현** |
| `ToggleMute` | (파라미터 없음) | 음소거 토글 | 구현됨 |
| `SaveAudioSettings` | (파라미터 없음) | 설정 저장 | **미구현** |

### 5.3 QueryAudioState가 설정해야 할 window.__unityAudioState 구조

테스트에서 참조하는 모든 프로퍼티:

```json
{
  "isInitialized": true,
  "isMuted": false,
  "masterVolume": 1.0,
  "bgmVolume": 0.7,
  "sfxVolume": 1.0,
  "sfxPoolSize": 8,
  "registeredSFXCount": 12,
  "registeredSFXNames": ["TapSelect", "MergeBasic", ...],
  "lastPlayedSFX": "TapSelect",
  "recentSFXHistory": ["GameStart", "TapSelect", ...],
  "activeSFXChannels": 3,
  "effectiveBGMVolume": 0.56,
  "effectiveSFXVolume": 0.4,
  "masterDecibelValue": -80,
  "isDontDestroyOnLoad": true
}
```

### 5.4 AudioManager 수정 필요사항

1. **bgmVolume, sfxVolume 필드 추가**: 현재 masterVolume만 있음. bgm/sfx 분리 볼륨 필요
2. **PlaySFXByName(string name)**: 문자열로 SFXType enum을 파싱하여 PlaySFX 호출하는 SendMessage 래퍼
3. **SetMasterVolume(string vol)**: 현재 `SetMasterVolume(float)` -> SendMessage는 string만 지원하므로 float.TryParse 래퍼 필요
4. **SetBGMVolume(string vol)**: BGM 볼륨 설정 + 저장
5. **SetSFXVolume(string vol)**: SFX 볼륨 설정 + 저장
6. **SaveAudioSettings(string _unused)**: PlayerPrefs에 모든 볼륨/음소거 저장
7. **QueryAudioState 확장**: 위 5.3의 모든 필드를 포함하도록 JSON 출력 확장
8. **lastPlayedSFX 트래킹**: PlaySFX 호출 시 마지막 재생 SFX 이름 기록
9. **recentSFXHistory 트래킹**: 최근 재생 SFX 히스토리 배열
10. **activeSFXChannels 계산**: 현재 재생 중인 AudioSource 수 세기
11. **effectiveBGMVolume/effectiveSFXVolume**: master * channel * clipBase 계산
12. **masterDecibelValue**: 음소거 시 -80 dB

---

## 6. 신규 스크립트/GameObject 필요 목록

### 6.1 신규 C# 스크립트

| 스크립트 | 경로 | 역할 |
|---|---|---|
| `TestBridge.cs` | `Assets/Scripts/Game/` | ui-components 72 TC용 쿼리/조작 브릿지 |
| `HexaTestBridge.cs` | `Assets/Scripts/Game/` | animation 37 TC용 애니메이션 테스트 브릿지 |
| `GDPRConsentManager.cs` | `Assets/Scripts/Game/` | ad-reward GDPR 3 TC용 (또는 AdManager에 통합) |

### 6.2 신규 GameObject (씬에 배치)

| GameObject 이름 | 컴포넌트 | 용도 |
|---|---|---|
| `TestBridge` | `TestBridge.cs` | ui-components 테스트 쿼리 수신 |
| `HexaTestBridge` | `HexaTestBridge.cs` | animation 테스트 명령 수신 |
| `GDPRConsentManager` | `GDPRConsentManager.cs` | GDPR 동의 관리 |

### 6.3 기존 코드 수정

| 파일 | 수정 내용 |
|---|---|
| `AdManager.cs` | rewardAdCooldown 이벤트명 변경, dailyLimit/adsDisabled/adsRemovedBlocked/gdpr 이벤트 추가, cancel 시 쿨다운 면제 |
| `IAPManager.cs` | purchaseComplete 이벤트명 통일, restoreComplete 이벤트 구조 변경, SimulateRestorePurchases 파라미터 기반 복원 |
| `AudioManager.cs` | bgm/sfx 볼륨 분리, PlaySFXByName, SetBGMVolume, SetSFXVolume, SaveAudioSettings, QueryAudioState 확장 |
| `SceneSetup.cs` | TestBridge, HexaTestBridge, GDPRConsentManager GameObject 생성 |

---

## 7. 기존 구현 vs 테스트 기대 차이 (Gap 분석)

### 7.1 AdManager Gap

| 항목 | 현재 구현 | 테스트 기대 | 필요 수정 |
|---|---|---|---|
| 쿨다운 이벤트명 | `rewardAdFailed` + `reason:cooldown` | `rewardAdCooldown` + `remainingSeconds` | 이벤트명 + 필드 변경 |
| 일일 한도 | 카운트만 관리, 차단 없음 | 20회 초과 시 `dailyLimitReached` + 차단 | 로직 + 이벤트 추가 |
| 연속 실패 | 카운트만 관리 | 3회 후 `adsDisabledByFailure` + 광고 비활성화 | 로직 + 이벤트 추가 |
| AdsRemoved 차단 | banner만 skip, 이벤트 없음 | `adsRemovedBlocked` + `adType` | 이벤트 추가 |
| Cancel 쿨다운 | cancel에도 쿨다운 시작 | cancel 시 쿨다운 안 시작 | 로직 수정 |
| GDPR | 하드코딩 true | 동적 동의/거부 + 이벤트 | GDPRConsentManager 신규 |

### 7.2 IAPManager Gap

| 항목 | 현재 구현 | 테스트 기대 | 필요 수정 |
|---|---|---|---|
| 구매 이벤트명 | `purchaseSuccess` / `purchaseFailed` | `purchaseComplete` (isSuccess 포함) | 이벤트 통일 |
| 복원 이벤트 | `purchasesRestored` | `restoreComplete` + `restoredProducts[]` | 이벤트 구조 변경 |
| 복원 파라미터 | 무시 (PlayerPrefs 기반) | 전달된 productIds 기반 복원 | 파싱 로직 추가 |
| gamebridge API | 없음 | `window.gamebridge.isAdsRemoved()` | jslib 또는 WebGLBridge에 등록 |

### 7.3 AudioManager Gap

| 항목 | 현재 구현 | 테스트 기대 | 필요 수정 |
|---|---|---|---|
| 볼륨 분리 | masterVolume만 | master + bgm + sfx 3개 | 필드 2개 추가 |
| PlaySFXByName | 없음 | `SendMessage('AudioManager', 'PlaySFXByName', 'TapSelect')` | 메서드 추가 |
| SetBGMVolume | 없음 | string 파라미터 래퍼 | 메서드 추가 |
| SetSFXVolume | 없음 | string 파라미터 래퍼 | 메서드 추가 |
| SetMasterVolume | float 파라미터 | string 파라미터 (SendMessage 호환) | string 오버로드 추가 |
| SaveAudioSettings | 없음 | 모든 설정 PlayerPrefs 저장 | 메서드 추가 |
| QueryAudioState | 기본 6개 필드 | 14개 필드 | 확장 필요 |
| SFX 히스토리 | 없음 | lastPlayedSFX, recentSFXHistory | 트래킹 추가 |
| 활성 채널 수 | 없음 | activeSFXChannels | 계산 추가 |
| 실효 볼륨 | 없음 | effectiveBGMVolume, effectiveSFXVolume | 계산 추가 |
| dB 값 | 없음 | masterDecibelValue | 계산 추가 |

---

## 8. 우선순위 및 작업량 추정

| 우선순위 | 작업 | 영향 TC 수 | 복잡도 |
|---|---|---|---|
| 1 | TestBridge.cs 신규 (Query 라우팅 + 조작) | 58+ TC | 높음 (14개 Query 경로 라우팅) |
| 2 | HexaTestBridge.cs 신규 (11개 메서드) | 37 TC | 높음 (TileAnimator/MergeEffect 연동) |
| 3 | AdManager.cs 수정 (6개 이벤트 추가 + 로직 수정) | ~12 TC | 중간 |
| 4 | IAPManager.cs 수정 (이벤트 통일 + 복원 수정) | ~8 TC | 낮음 |
| 5 | AudioManager.cs 수정 (볼륨 분리 + 6개 메서드 + QueryAudioState 확장) | ~15 TC | 중간 |
| 6 | GDPRConsentManager.cs 신규 | 3 TC | 낮음 |
| 7 | SceneSetup.cs 수정 (3개 GO 추가) | 전체 | 낮음 |
