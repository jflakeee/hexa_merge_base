# Hexa Merge Basic - 프로젝트 진행 현황

> 최종 업데이트: 2026-02-13
> 프로젝트: 헥사곤 숫자 머지 퍼즐 게임
> 참고 게임: XUP - Brain Training Game (com.gamegos.viral.simple)
> 플랫폼: 웹(WebGL) + 안드로이드 | 엔진: Unity 2020.3.29f1

---

## 전체 진행 요약: 90% (105/117)

| 단계 | 항목 | 상태 | 진행률 |
|------|------|------|--------|
| [A] 분석 및 문서화 | 설계/개발/테스트 문서 23개 | **완료** | 100% |
| [B] 게임 핵심 구현 | 코어/그리드/머지/스코어/상태 | **완료** | 100% |
| [C] 애니메이션 및 이펙트 | 8종 애니메이션/파티클 | **완료** | 100% |
| [D] UI/UX 구현 | 화면/인터랙션/반응형 | **완료** | 100% |
| [E] 오디오 시스템 | AudioManager + 12종 절차적 SFX | **완료** | 100% |
| [F] 수익화 | AdMob/IAP 스텁 구현 | 진행중 | 82% |
| [G] 플랫폼 배포 | 빌드 설정 완료, 배포 대기 | 진행중 | 36% |
| [H] 테스트 | Playwright 인프라 + 10개 spec 작성 (263+ TC) | 진행중 | 92% |

---

## 구현 완료된 스크립트 (33개)

### Core (5개)
| 파일 | 설명 |
|------|------|
| `HexCoord.cs` | 큐브 좌표계, 6방향 이웃, 거리 계산 |
| `HexCell.cs` | 셀 데이터 (값, 빈 상태, 왕관) |
| `HexGrid.cs` | 25셀 다이아몬드 그리드, BFS 유효성 검증 |
| `TileColorConfig.cs` | ScriptableObject 16색 매핑 |
| `TileHelper.cs` | 값 포맷(K 축약), 랜덤 생성(90%→2, 10%→4) |

### Game (8개)
| 파일 | 설명 |
|------|------|
| `GameManager.cs` | 싱글톤 상태 머신, 탭/머지/스폰 조율 |
| `MergeSystem.cs` | BFS 연결 그룹, 머지 결과 계산 |
| `ScoreManager.cs` | 점수 관리, PlayerPrefs 최고점 저장 |
| `SaveSystem.cs` | JSON 직렬화 게임 저장/로드 |
| `GameplayController.cs` | 이벤트 허브 (보드↔HUD↔애니메이션↔오디오) |
| `AdManager.cs` | AdMob 스텁 (배너/보상형, 쿨다운 30초) |
| `IAPManager.cs` | IAP 스텁 (4상품, 구매 시뮬레이션) |
| `WebGLBridge.cs` | Unity↔JS 브리지 (Playwright 테스트용) |

### UI (10개)
| 파일 | 설명 |
|------|------|
| `HexCellView.cs` | 셀 뷰 (색상, 텍스트 크기 자동 조절, 왕관) |
| `HexBoardRenderer.cs` | 보드 렌더러 (flat-top 레이아웃, AutoFit) |
| `HUDManager.cs` | 점수 표시 (핑크 #FF69B4), 버튼 연결 |
| `ScreenManager.cs` | 화면 전환 (페이드 애니메이션) |
| `GameOverScreen.cs` | 게임 오버 패널 (리스타트/광고 시청) |
| `PauseScreen.cs` | 일시정지 패널 (계속/리스타트/사운드) |
| `ShopScreen.cs` | 상점 화면 (IAP 연동) |
| `LeaderboardScreen.cs` | 리더보드 (Top 10, PlayerPrefs JSON) |
| `ResponsiveLayout.cs` | 반응형 3단 브레이크포인트 |
| `ButtonFeedback.cs` | 버튼 스케일 펀치 + 클릭 SFX |

### Animation (2개)
| 파일 | 설명 |
|------|------|
| `TileAnimator.cs` | 코루틴 기반: 스폰/머지/점수팝업/왕관전환/게임오버 |
| `MergeEffect.cs` | 스플래시 + 파티클 버스트, 오브젝트 풀링 |

### Audio (3개)
| 파일 | 설명 |
|------|------|
| `AudioManager.cs` | 싱글톤, 8채널 풀링, 12종 SFXType, RegisterSFX |
| `ProceduralSFX.cs` | 사인파 합성으로 12종 효과음 런타임 생성 |
| `SFXInitializer.cs` | 게임 시작 시 자동 SFX 생성 + AudioManager 등록 |

### Utility/Input (3개)
| 파일 | 설명 |
|------|------|
| `Singleton.cs` | 제네릭 스레드 안전 싱글톤 베이스 |
| `ObjectPool.cs` | Queue 기반 제네릭 오브젝트 풀 |
| `InputManager.cs` | 터치/마우스 통합 입력, UI 필터링 |

### Editor (2개)
| 파일 | 설명 |
|------|------|
| `SceneSetup.cs` | 원클릭 게임 씬 자동 구성 (800줄+) |
| `BuildHelper.cs` | WebGL/Android 빌드 자동화 |

---

## 빌드/배포 인프라

| 항목 | 파일 | 설명 |
|------|------|------|
| WebGL 템플릿 | `WebGLTemplates/HexaMerge/index.html` | 커스텀 로딩 화면 (핑크 프로그레스 바) |
| JS 브리지 | `Plugins/WebGL/HexaMergeBridge.jslib` | Unity→JS 메시지 전달 |
| 프로젝트 설정 | `ProjectSettings/ProjectSettings.asset` | WebGL + Android 빌드 설정 |
| 품질 설정 | `ProjectSettings/QualitySettings.asset` | Low/Medium/High 3단계 |
| 빌드 씬 | `ProjectSettings/EditorBuildSettings.asset` | GameScene 등록 |

---

## 테스트 인프라 (10개 spec, 263+ TC)

| 항목 | 파일 |
|------|------|
| 패키지 설정 | `tests/package.json` |
| Playwright 설정 | `tests/playwright.config.ts` |
| Unity 브리지 헬퍼 | `tests/helpers/unity-bridge.ts` |
| 헥사 그리드 테스트 (30 TC) | `tests/specs/hex-grid.spec.ts` |
| 머지 시스템 테스트 (33 TC) | `tests/specs/merge-system.spec.ts` |
| 스코어링 테스트 (37 TC) | `tests/specs/scoring.spec.ts` |
| 게임 상태 테스트 | `tests/specs/game-state.spec.ts` |
| 애니메이션 테스트 (36 TC) | `tests/specs/animation.spec.ts` |
| UI 컴포넌트 테스트 (43 TC) | `tests/specs/ui-components.spec.ts` |
| 오디오 테스트 (15 TC) | `tests/specs/audio.spec.ts` |
| 광고/보상 테스트 (18 TC) | `tests/specs/ad-reward.spec.ts` |
| 인앱 결제 테스트 (14 TC) | `tests/specs/iap.spec.ts` |
| 플랫폼 배포 테스트 (37 TC) | `tests/specs/platform.spec.ts` |

---

## 미완료 항목 (12개) - 외부 의존성/수동 작업 필요

| 카테고리 | 항목 | 필요 사항 |
|----------|------|-----------|
| 수익화 | 웹 결제 (Stripe) | 백엔드 서버 |
| 수익화 | 구매 검증 | 백엔드 서버 |
| 배포 | 웹 호스팅 | WebGL 빌드 후 서버 업로드 |
| 배포 | 브라우저 호환성 | 빌드 후 수동 테스트 |
| 배포 | 키스토어 생성 | keytool 수동 실행 |
| 배포 | Play Console 등록 | Google 개발자 계정 |
| 배포 | 스토어 에셋 | 스크린샷/아이콘 제작 |
| 배포 | 트랙 배포 | Play Console 수동 |
| 배포 | Firebase 3종 | SDK 설치 필요 |
| 테스트 | 플랫폼 배포 테스트 실행 | WebGL 빌드 후 |
| 테스트 | 테스트 결과 저장 | 빌드 후 실행 |

---

## 기술 스택

| 분류 | 기술 |
|------|------|
| 게임 엔진 | Unity 2020.3.29f1 (C# 7.3) |
| UI | Unity UI (Canvas) + TextMeshPro |
| 애니메이션 | 코루틴 기반 (DOTween 미사용) |
| 오디오 | AudioClip.Create 절차적 SFX 합성 |
| 광고 | AdMob 스텁 (SDK 미포함) |
| 결제 | IAP 스텁 (SDK 미포함) |
| 테스트 | Playwright (TypeScript) |
| 빌드 | WebGL (Gzip) + Android (IL2CPP, ARM64) |

---

*이 문서는 프로젝트 진행 상황을 추적하기 위해 자동 생성되었습니다.*
