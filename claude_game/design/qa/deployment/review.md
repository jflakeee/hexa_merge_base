# 애니메이션 업데이트 운영 배포

2026-10-05 배포 및 공개 사이트 검증 완료.

- 게임: https://www.fungood.co.kr/claude_game/
- 포털: https://www.fungood.co.kr/game_portal/#/play/claude-game
- 소스: `cf25c97`
- 게임 gh-pages: `fd17f7a`
- 운영 도메인 gh-pages: `35e3ac8`
- 번들: `index-wX80CaSN.js`, `index-ClSKoqeP.css`

두 저장소의 Pages 최신 빌드가 해당 커밋으로 `built`, 오류 없음임을 확인했다. 운영 도메인 저장소는 `claude_game/`의 index와 신규 자산만 변경했다. 이전 해시 자산은 열린 탭의 호환성을 위해 보존했다.

Playwright 공개 URL 검증 통과:

1. apex 주소로 접속해 최종 HTTP 200 및 새 번들 확인.
2. 개발용 전역 훅이 운영 빌드에 없는지 확인.
3. 화면 움직임 설정 변경 후 새로고침해 저장 복원 확인.
4. 실제 UI로 전투 입장, 지연 체력바 존재, 이탈 및 결과 창 확인.
5. 포털 iframe에서 같은 새 번들과 설정 UI 확인.
6. 수집된 페이지 오류 0건.

[기계 검증 결과](results.json) · [설정 화면](01-settings.png) · [전투](02-combat.png) · [결과](03-result.png) · [포털 내부 실행](04-portal.png)

검증은 Chromium 모바일 에뮬레이션 기준이며 실제 iOS 기기 검증은 포함하지 않는다.
