# 출처와 조사 범위

접근일: 2026-10-05. 아래 10개는 이번 연구의 직접 참고 자료다. 게임 제작 사례는 해당 작품의 조건에서 나온 판단이며 모든 장르의 통제 실험 결과와 동일하게 취급하지 않는다.

| ID | 자료 | 확인 범위 | 이 문서의 사용 범위 |
|---|---|---|---|
| S01 | [Riot, VALORANT Shaders and Gameplay Clarity](https://www.riotgames.com/en/news/valorant-shaders-and-gameplay-clarity) | 공식 기술 본문: 목표·캐릭터 경계·품질 설정 | 아트·가독성·성능의 공동 설계. 2D 직접 이식 주장 없음. |
| S02 | [Riot Art Education, Visual Effects](https://www.riotgames.com/en/artedu/visual-effects) | 공식 웹 본문 | VFX의 명확한 의미와 전체 일관성. 연결된 동영상 전체를 분석한 것은 아님. |
| S03 | [Valve, Illustrative Rendering in Team Fortress 2 (2007)](https://cdn.steamstatic.com/apps/valve/2007/NPAR07_IllustrativeRenderingInTeamFortress2.pdf) | 원문 PDF: 실루엣·미술/기술 협업 관련 부분 | 역할 식별과 스타일 규칙. 최신 엔진 기능 설명으로 사용하지 않음. |
| S04 | [Rosenholtz·Li·Nakano, Measuring visual clutter (2007)](https://pubmed.ncbi.nlm.nih.gov/18217832/) | PubMed에 수록된 저자 초록 | 혼잡도와 탐색 관계, 측정 접근의 존재. 전체 논문 방법 재현·게임 적용 검증 없음. |
| S05 | [NN/g, 5 Principles of Visual Design in UX](https://www.nngroup.com/articles/principles-visual-design/) | 원저자 기관의 설명 | 계층·균형·조직화의 설계 참고. 게임별 인식 효과는 실험 필요. |
| S06 | [XAG 101: Text display](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/101) | Microsoft 공식 지침 | 크기·표시 조건을 함께 검토. 이 게임에 대한 인증 아님. |
| S07 | [XAG 102: Contrast](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/102) | 공식 본문과 대비 표 | 조건별 권고 및 복잡한 배경 측정. 실제 게임 색상 측정은 미수행. |
| S08 | [XAG 103: Additional channels](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/103) | 공식 지침 | 색·소리 등 단일 경로에만 의존하지 않는 정보 설계. |
| S09 | [XAG 117: Visual distractions and motion settings](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/117) | 공식 본문: UI 움직임·카메라 관련 부분 | 모션 선택권과 감소 조건의 검토. 모든 카메라 옵션을 이 2D 게임에 요구하지 않음. |
| S10 | [MDN, Crisp pixel art look](https://developer.mozilla.org/en-US/docs/Games/Techniques/Crisp_pixel_art_look) | 공식 기술 본문 | 픽셀 아트 확대와 표시 배율 제약. Phaser 설정 전체 검증을 대신하지 않음. |

## 근거를 적용하는 방식

- 논문 초록만 확인한 자료는 그 범위 내 주장으로 제한한다.
- 디자인 가이드는 개선 후보를 만드는 근거이며 이 프로젝트에서 효과가 발생했다는 증거가 아니다.
- XAG는 명시한 대상과 조건을 검토하고 적용한다. WCAG의 다른 기준이나 플랫폼 인증과 혼동하지 않는다.
- 원문을 길게 재현하지 않고 요지를 요약했다. 이 문서의 실험 설계·우선순위·표는 프로젝트를 위한 자체 제안이다.
- 구현 기법의 확장 자료는 [이전 카툰/영화 연출 조사](../cinematic-animation-toon/README.md), 실험 설계의 일반 참고는 [게임 개발 이론 조사](../game-development-theory/validation-production.md)에 별도로 연결했다.

## 관찰과 측정의 경계

기존 QA 이미지 두 장을 직접 보았으며 새로운 캡처를 생성하지 않았다. 그림의 의미, 판정 시간, 플레이어 이해도는 이미지로 추정해 확정하지 않았다. 코드 일부에서 확인한 사항은 [프로젝트 적용안](project-study.md)에 함수 단위로 기록했다.

색 대비 비율, 시선 데이터, 입력 지연, 프레임 시간, 사용자 선호 점수를 측정하지 않았다. 미측정 항목은 실험 계획에만 포함했다. 이번 조사는 체계적 문헌고찰이나 시각 접근성·점멸 안전성의 적합성 판정이 아니다.
