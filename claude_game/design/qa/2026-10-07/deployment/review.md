# 2026-10-07 공개 배포 검증

성장 안내가 포함된 `d7b9806` 빌드가 `fungood.co.kr/claude_game/`에 게시됐다. 공개 번들은 `index-CNv2tOwz.js`이며 게임 Pages 커밋은 `8c23072`, `fungood.co.kr` Pages 커밋은 `dd111f5`다.

Playwright Chromium으로 공개 게임 페이지와 게임 포털 iframe을 확인했다. 데스크톱 준비 화면(1180px), 보스 아레나 진입과 복귀(520px), 모바일 생존 전투(390×844), 화면 움직임 설정 저장·복원, 포털 iframe 로딩 및 프로덕션 디버그 훅 비활성 상태가 통과했다. 브라우저 페이지 오류는 0건이다. [자동 검증 결과](results.json)와 [데스크톱](01-desktop.png), [보스](02-boss.png), [모바일](03-mobile.png), [포털](04-portal.png) 캡처를 확인할 수 있다.

문서 색인은 [설계·리서치 공개 페이지](https://www.fungood.co.kr/claude_game/design/)에서 열 수 있다.
