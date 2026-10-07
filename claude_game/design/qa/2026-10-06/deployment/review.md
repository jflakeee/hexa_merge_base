# 재설계 빌드 운영 배포 및 시각 검증

2026-10-06 최신 구현 `957ab50` 배포 완료.

- 게임 Pages: `4ef7281`
- `fungood.co.kr` 도메인 Pages: `ae656bc`
- 공개 번들: `/claude_game/assets/index-2Rgyv_5u.js`
- 게임: https://www.fungood.co.kr/claude_game/
- 포털: https://www.fungood.co.kr/game_portal/#/play/claude-game

Chromium에서 공개 사이트와 포털 iframe을 직접 열어 확인했다. 데스크톱 준비 화면(1180px), 보스 전투(520px)와 복귀, 모바일 생존 전투(390px), 화면 움직임 설정 저장/복원, 공개 빌드의 개발 훅 제거, 포털 내 게임 로딩/조작이 통과했다. 수집한 페이지 오류는 0건이었다.

4배 CPU 제한의 Chromium profile은 대기 화면 약 25fps, 전투 약 17fps를 보였다. 제한 없음 profile도 약 30fps/18fps였으므로 headless 주사율과 실행환경 영향을 분리하지 못했다. [측정값](performance-1x.json) · [4배 CPU 제한](performance-4x.json). 이 결과는 최적화 완료 근거로 사용하지 않는다. 실제 iOS 또는 저사양 Android 기기의 프레임/메모리 측정과 병목 프로파일링은 남아 있다.

[기계 검증 결과](results.json) · [데스크톱](01-desktop.png) · [보스](02-boss.png) · [모바일](03-mobile.png) · [포털](04-portal.png)
