# 기존 30종 외 추가 효과 조사

## 조사 기준

기존 30종은 피격, UI, 보상, 장면 전환, 점프, 공격의 대표 예시다. 애니메이션의 전체 분류 체계는 아니다. 이번에는 지속 상태, 움직임의 관계, 환경 반응, 정보 위치의 연속성을 보완하는 후보를 찾았다.

다음 세 가지를 구별한다.

| 구분 | 정의 | 이번 목록 |
|---|---|---|
| 추가 후보 A | 기존 30종에 명시되지 않은 별도의 시각적 역할 | A01~A24 |
| 확장 V | 기존 효과를 다른 모양·재질·매체로 표현 | V01~V08 |
| 기법 T | 여러 효과를 만드는 계산·재생 방식 | T01~T06, 개발 설계 문서 |

추가 후보도 Lerp·Tween·파티클 등 공통 수단을 사용한다. 따라서 '기존 기술을 전혀 사용하지 않는 신규 발명 24개'라는 의미는 아니다. 난도와 우선순위는 현재 작은 픽셀 캐릭터, 자동 공격, DOM 관리 패널, Phaser 3.90.0에 맞춘 조사자의 판단이다.

## 캐릭터·소품: A01~A07

### A01. 후속·겹침 움직임 — Follow-through / Overlapping action

본체가 멈춘 뒤 망토·꼬리·안테나가 잠시 따라 움직인다. 몸통과 부속물의 시간차가 핵심이다. 기존 오버슈트가 한 속성의 목표 초과라면 이 효과는 연결된 부품 사이의 반응 차이다. Spine은 뼈에 대한 관성·복원력·감쇠로 부가 움직임을 제어한다. [Spine Physics constraints](https://us.esotericsoftware.com/spine-physics-constraints)

**적용 제안:** 보스 장식이나 무기 끝부분만 분리해 1~2개 관절부터 적용. 위치가 급변하는 순간에는 물리 상태를 초기화한다. 필요 자산은 본체와 분리된 소품 이미지·회전 중심이다. 난도 중, P1.

### A02. 미세 생체 동작 — Breathing / Blink / Idle variation

대기 중 눈 깜박임·가슴 호흡·고개의 작은 움직임으로 생존 상태를 표현한다. 착지 변형이나 버튼 바운스와 달리 지속되는 캐릭터 상태가 대상이다. 여러 애니메이션을 트랙으로 겹치는 구성은 Spine의 애니메이션 적용 문서에서 확인할 수 있다. [Spine Applying Animations](https://esotericsoftware.com/spine-applying-animations)

**적용 제안:** 모든 적을 같은 주기로 움직이지 말고 고정 시드의 위상차를 사용한다. 작은 픽셀 캐릭터는 전체 크기 확대보다 눈·가슴의 1픽셀 프레임 교체가 읽기 쉽다. 기존 상하 bob과는 구분한다. 난도 낮음~중, P1.

### A03. 회전 선행·기울기 — Turn / Lean / Banking

방향 전환 때 시선·상체·소품이 순서대로 돌아가거나 진행 방향 안쪽으로 기운다. 피격 넉백이 아니라 자발적 이동 방향과 가속에 대한 자세 표현이다. 층별 동작을 합성하는 방식은 A02와 같은 트랙·부품 계층으로 구성할 수 있다. 구체적인 회전 각도·적용 순서는 이 프로젝트의 설계 제안이다.

**적용 제안:** 표시용 자식에만 작은 각도를 적용하고 충돌체는 회전시키지 않는다. 픽셀 아트에서는 매 프레임 연속 회전보다 방향별 프레임이 더 선명할 수 있다. 난도 중, P2.

### A04. 시선·조준 추적 — Look-at / Aim tracking

눈·머리·무기가 실제 목표를 향한다. 공격 전에만 나오는 예고와 달리 목표 관계를 지속적으로 보여준다. Spine의 1개 뼈 IK는 대상을 향하도록 회전을 조정하고, 2개 뼈 IK는 끝부분을 목표에 맞춘다. [Spine IK constraints](https://en.esotericsoftware.com/spine-ik-constraints)

**적용 제안:** 보스의 머리·눈을 플레이어 방향으로 제한 회전한다. 뒤쪽 목표를 향해 목이 한 바퀴 돌지 않도록 각도 제한과 방향 전환 규칙이 필요하다. 난도 중, P1.

### A05. 발 고정·지형 순응 — Foot planting / Terrain adaptation

접지한 발을 고정하고 몸 높이·관절 각도를 조절해 미끄러짐과 지면 관통을 줄인다. 기존 착지 squash는 순간 충격 표현이고, 여기서는 이동 중 접촉 제약을 유지한다. 손이 물체를 잡는 관계도 같은 IK 계열로 표현할 수 있다. [Spine IK 설명과 제한](https://en.esotericsoftware.com/spine-ik-constraints)

**적용 제안:** 현재 게임은 평면·단일 스프라이트라 우선순위가 낮다. 다리 분리 아트와 접지 단계가 생긴 뒤 도입한다. 난도 높음, P3.

### A06. 스미어 프레임 — Smear frames

빠른 동작 사이에 의도적으로 늘어나거나 합쳐진 중간 형태를 그려 넣는다. 지난 위치에 복사본을 남기는 잔상, 전체 스케일만 바꾸는 squash와 구별한다. Mariel Cartwright의 GDC 슬라이드는 큰 움직임의 간격을 채우는 표현으로 스미어를 다룬다. [Powerful and Effective Animation, PDF 15~17페이지](https://media.gdcvault.com/gdcchina14/presentations/833784_MarielCartwright_PowerfulAndEffective_EN.pdf)

**적용 제안:** 무기 휘두르기용 중간 프레임 1~2장부터 제작한다. 스미어의 넓이를 실제 공격 범위로 오해하지 않도록 한다. 난도 중·아트 필요, P2.

### A07. 기계 동작 연계 — Mechanical articulation

석궁의 장력 복귀, 총기 슬라이드, 보스의 회전 관절처럼 부품이 기능 순서에 맞춰 움직인다. 피격당한 대상의 반동과는 별개다. 이 항목은 트랙·부품 제약을 조합한 응용 설계이며 특정 엔진의 단일 내장 효과명이 아니다. [Spine Raptor 예제의 손·무기 결합](https://us.esotericsoftware.com/spine-examples-raptor)

**적용 제안:** 실제 공격 준비·발사·재사용 가능 상태를 시각 동작에 연결한다. 애니메이션이 끝났다는 이유만으로 공격 쿨다운을 줄이지 않는다. 난도 중, P2.

## 지속 효과·표면: A08~A12

### A08. 지속형 빔·연결선 — Beam / Tether

발사체를 이동시키는 대신 시전자와 대상 사이의 연결이 유지된다. 치유 연결, 흡혈, 레이저에 적합하다. 체인 라이트닝은 별도 신규 수로 세지 않고 이 계열의 분기 표현으로 묶는다. Phaser Rope는 텍스처를 점 배열을 따라 늘리며 WebGL 전용이다. [Phaser Rope 3.90](https://docs.phaser.io/api-documentation/3.90.0/class/gameobjects-rope)

**적용 제안:** 처음에는 Graphics 선과 폭 변화로 만든다. 매 프레임 새 난수를 뽑기보다 시간적으로 이어지는 노이즈를 사용한다. 피해 판정 선과 장식 굴곡을 분리한다. 난도 중, 실제 지속형 스킬이 생긴 뒤 P2.

### A09. 궤도·위성 운동 — Orbiting satellites

룬·보호 구체·소환물이 기준 물체 주위를 순환한다. 과거 위치를 남기는 trail과 달리 별도 개체의 현재 위치를 유지한다. 이는 기본 삼각함수·경로 애니메이션을 조합하는 설계이며 새로운 물리 기능이 필수는 아니다.

**적용 제안:** `중심 + 반지름 × (cos θ, sin θ)`로 표시하고 상하 깊이를 나눠 앞뒤를 표현한다. 장식 구체를 피격 가능한 투사체처럼 보이게 하지 않는다. 난도 낮음, P2. 엔진 수단은 [Phaser Tween 개념](https://docs.phaser.io/phaser/concepts/tweens)을 참고한다.

### A10. 누적 흔적 — Footprints / Scorch decals

발자국·그을음·긁힘이 월드 표면에 남아 지나온 행동을 보여준다. 충돌 순간 사라지는 파티클보다 수명이 길고 표면 좌표에 고정된다. Phaser RenderTexture는 여러 이미지를 그려 넣는 표면으로 사용할 수 있다. [RenderTexture 3.90](https://docs.phaser.io/api-documentation/3.90.0/class/gameobjects-rendertexture)

**적용 제안:** 발 접촉 또는 일정 이동 거리마다 흔적을 생성한다. 상한을 두고 오래된 흔적을 회수한다. 현재 게임은 잔해와 위험 바닥이 겹치기 쉬우므로 대비를 낮춰야 한다. 난도 중, P2.

### A11. 표면 흐름 — UV scrolling / Animated material

물체의 외곽은 고정된 채 내부의 문양·물결·에너지만 흐른다. 숫자 증가나 반짝이 입자가 아니라 표면 좌표를 움직이는 효과다. TileSprite는 오브젝트 위치와 별도로 텍스처 위치를 바꿀 수 있다. [Phaser TileSprite 3.90](https://docs.phaser.io/api-documentation/3.90.0/class/gameobjects-tilesprite)

**적용 제안:** 보스 봉인 문양이나 마법 관로에 제한 적용한다. 이동 값은 초 단위 delta로 계산하고 텍스처 이음매를 검사한다. 난도 낮음~중, P1.

### A12. 가림 복구·실루엣 — Occlusion reveal

캐릭터가 전경 구조물 뒤로 가면 해당 부분을 흐리게 하거나 실루엣·외곽선으로 위치를 유지한다. 단발 피격 플래시와 달리 '가려져 있다'는 상태를 전달한다. Phaser의 Glow는 외곽 강조의 도구로 쓸 수 있지만 가림 판단 자체는 제공하지 않는다. [Phaser Glow 3.90](https://docs.phaser.io/api-documentation/3.90.0/class/fx-glow)

**적용 제안:** 전경이 실제로 캐릭터를 가리는 새 맵에만 도입한다. Canvas에서는 반투명 전경이나 대비 높은 복사 실루엣을 대안으로 사용한다. 난도 중, P2.

## 환경·공간: A13~A18

### A13. 움직이는 조명·그림자 — Dynamic lighting and shadows

횃불 밝기, 이동 광원, 방향이 바뀌는 그림자로 공간 관계를 표현한다. 단순 bloom·sparkle과 달리 주변 표면의 명암에 영향을 준다. Godot의 공식 설명은 광원과 그림자 가림 물체를 구분한다. [Godot 2D lights and shadows](https://docs.godotengine.org/en/stable/tutorials/2d/2d_lights_and_shadows.html)

**Phaser 주의:** `PointLight`는 주변 GameObject의 노멀 맵을 실제로 비추는 `Light`와 다르다. 불빛처럼 보이는 효과와 실제 표면 조명을 혼동하면 안 된다. [LightsManager 3.90](https://docs.phaser.io/api-documentation/3.90.0/class/gameobjects-lightsmanager)

**적용 제안:** 픽셀 횃불의 약한 광량 변화와 가짜 접지 그림자부터 적용한다. 실제 노멀 맵 조명·가림 그림자는 별도 단계다. 난도 낮음~높음, 간이형 P1.

### A14. 다층 패럴랙스 — Layered parallax

전경·중경·원경이 서로 다른 속도로 움직여 깊이를 만든다. 화면 흔들림과 달리 이동량과 안정적으로 연결된다. Godot 공식 문서는 레이어별 스크롤 배율을 설명한다. [Godot 2D Parallax](https://docs.godotengine.org/en/stable/tutorials/2d/2d_parallax.html)

**적용 제안:** 현재 한 장짜리 방 이동을 2~3층으로 나눈다. 배경만 움직이고 HUD와 전투 판정 좌표는 유지한다. 반복 경계와 장면 크기 변경을 검증한다. 난도 낮음~중, P1.

### A15. 바람장·접촉 굽힘 — Wind / Interactive foliage

깃발·풀·거미줄이 공유 바람이나 플레이어 접근에 반응한다. A01의 캐릭터 관성 반응과는 입력이 다르며 공통 스프링 도구는 재사용할 수 있다. GPU Gems의 Crysis 사례는 전체 굽힘과 세부 잎 움직임, 전역·국소 바람을 구분한다. [GPU Gems 3, Vegetation in Crysis](https://developer.nvidia.com/gpugems/gpugems3/part-iii-rendering/chapter-16-vegetation-procedural-animation-and-shading-crysis)

**적용 제안:** 실내 맵에는 풀 대신 천·사슬 소품에 작은 움직임을 적용한다. 모든 소품이 같은 사인파 위상으로 흔들리는 것을 피한다. 난도 중, P2.

### A16. 수면·굴절·반사 움직임 — Water surface motion

수면의 파동과 반사상이 지속적으로 변한다. 착지 파티클과 달리 표면 자체가 움직인다. GPU Gems는 여러 파형을 합쳐 수면을 표현하는 접근을 설명한다. [Effective Water Simulation from Physical Models](https://developer.nvidia.com/gpugems/gpugems/part-i-natural-effects/chapter-1-effective-water-simulation-physical-models)

**적용 제안:** 작은 웅덩이는 4~8장의 프레임 애니메이션으로 시작한다. 3D 수면 논문을 그대로 이식하지 않는다. 반사 속 캐릭터가 본체처럼 보이지 않도록 밝기와 윤곽을 낮춘다. 난도 중~높음, 물 구역 도입 후 P3.

### A17. 지속 유동층 — Flowing fog / Smoke field

넓은 안개·연기 무늬가 이어져 흐르는 효과다. 1회 충돌 입자와 달리 공간의 밀도·방향을 유지한다. 실제 유체 시뮬레이션은 연기·불·물의 동작을 계산하지만 비용이 크다. [GPU Gems 3, Real-Time Simulation and Rendering of 3D Fluids](https://developer.nvidia.com/gpugems/gpugems3/part-v-physics-simulation/chapter-30-real-time-simulation-and-rendering-3d-fluids)

**적용 제안:** 현재 게임에서는 저해상도 반투명 무늬 1~2층을 흐르게 하는 근사만 검토한다. 실제 유체 솔버는 필요하지 않다. 바닥 경고를 덮는 연기 농도는 허용하지 않는다. 난도 중, P2.

### A18. 환경 변형·분리 — Deformation / Breakable scenery

벽·상자·교량이 상태에 따라 금이 가거나 조각으로 분리되어 환경 자체가 달라진다. 캐릭터 사망 표현과 달리 이후의 맵 형태·상호작용이 남는 경우가 있다. Epic의 Chaos 자료는 실시간 파괴 도구를 소개하지만 이번 조회에서는 개요 수준으로만 참고했다. [Epic Destruction Overview](https://dev.epicgames.com/documentation/unreal-engine/destruction-overview?lang=en-US)

**적용 제안:** 미리 그린 정상/손상/파손 3상태와 제한된 조각으로 시작한다. 파손이 통행을 바꾸면 애니메이션 작업을 넘어 게임 규칙 변경이다. 난도 중~높음, P3.

## 색·카메라·UI: A19~A24

### A19. 팔레트 순환 — Palette cycling

형태는 그대로 두고 특정 색상 인덱스를 순환해 물·불·마력의 흐름을 만든다. 단일 물체 전체를 번쩍이게 하는 hit flash나 입자 sparkle과 다르다. Joseph Huckaby의 Canvas Cycle은 이 원리를 HTML Canvas에서 구현한 공개 데모다. [Canvas Cycle](https://www.effectgames.com/demos/canvascycle/), [제작자 명시 소개](https://experiments.withgoogle.com/canvas-cycle)

**적용 제안:** 픽셀 룬 또는 횃불의 제한된 4~6색만 순환한다. 캐릭터·등급·위험 표시 팔레트는 분리한다. 매 프레임 모든 픽셀을 CPU에서 수정하기보다 미리 구운 프레임부터 비교한다. 난도 중, P1.

### A20. 상태별 색조 전이 — Color grading transition

밤·저주·보스 단계의 전환을 색조·명도·채도 변화로 표현한다. A19는 특정 팔레트가 반복되는 흐름이고, 이 항목은 화면 상태 간 색 공간의 이동이다. Phaser ColorMatrix는 이미지 색의 변환을 제공한다. [ColorMatrix 3.90](https://docs.phaser.io/api-documentation/3.90.0/class/fx-colormatrix)

**적용 제안:** 보스 2단계에 배경만 약하게 바꾸고 UI·위험색은 보존한다. 색만으로 상태를 전달하지 않는다. 난도 중, P2.

### A21. 초점 이동 — Focus pull / Selective defocus

보여줄 대상은 선명하게 두고 다른 깊이·레이어를 흐리게 하며 초점을 옮긴다. 모달 배경의 단순 어두워짐과 다르다. Phaser Bokeh는 얕은 심도·틸트시프트의 시각적 근사를 제공한다. [Bokeh 3.90](https://docs.phaser.io/api-documentation/3.90.0/class/fx-bokeh)

**적용 제안:** 전투 중에는 적·투사체를 흐리게 하지 않는다. 결과·도감의 정지 장면에서만 검토하며 작은 픽셀 아트의 선명도 손실을 비교한다. 난도 중, P3.

### A22. 구도 기반 카메라 — Look-ahead / Dead zone framing

현재 위치뿐 아니라 이동 방향과 화면 내 여백을 고려해 카메라 중심을 움직인다. 순간 흔들림·줌 펀치와 달리 지속적인 가시성 제어다. Cinemachine은 앞선 위치 추정과 감쇠를 제공하고, 노이즈가 있는 대상 움직임이 카메라 떨림을 증폭할 수 있다고 설명한다. [Cinemachine Position Composer 3.1](https://docs.unity3d.com/Packages/com.unity.cinemachine@3.1/manual/CinemachinePositionComposer.html)

**적용 제안:** 현재 화면 안 전투장에는 불필요하다. 큰 맵 도입 때 본체 bob이 아닌 모델 좌표를 추적하고 이동 방향의 안전 시야를 확보한다. 난도 중, P3.

### A23. 원형 시간 표시 — Radial cooldown / Duration sweep

스킬 재사용·버프 잔여 시간을 원주 각도로 보여준다. 숫자를 올리는 count-up과 달리 시간의 비율을 공간으로 표시한다. CSS `conic-gradient()`는 중심 주위의 각도에 따라 색을 만드는 도구다. [MDN conic-gradient](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/gradient/conic-gradient)

**적용 제안:** 실제 남은 시간으로 각도를 계산하고 숫자·텍스트 대안을 함께 제공한다. 현재 스킬은 자동 효과 중심이므로 능동 스킬이나 명확한 지속시간 UI가 생길 때 적용한다. 난도 낮음, 조건부 P2.

### A24. 재배치의 위치 연결 — Layout / Shared-element motion

장비 정렬·장착 시 항목이 이전 위치에서 새 위치로 이동해 같은 아이템임을 유지한다. 순차 등장 stagger와 달리 이미 있던 물체의 정체성을 연결한다. FLIP은 변경 전후 위치를 측정하고 차이를 역변환한 뒤 원래 상태로 재생하는 방법이다. [Paul Lewis, FLIP Your Animations](https://aerotwist.com/blog/flip-your-animations/)

**적용 제안:** 가방→장착 슬롯의 대표 아이콘을 연결한다. 실제 DOM을 이동할 때 포커스를 잃지 않도록 하고, 장식용 복사본은 입력·접근성 탐색에서 제외한다. 난도 중, P1.

## 기존 효과의 확장: 추가 후보 수에 포함하지 않은 8개

| ID | 확장 표현 | 기존 목록과 관계 | 개발 판단 |
|---|---|---|---|
| V01 | 디졸브·재로 흩어지는 퇴장 | 기존 30 퇴장 피드백 | 노이즈 임계값·가장자리 발광; 별도 재질 기법 |
| V02 | 원형 충격파·실드 물결 | 기존 7 충돌 효과 | 입자 대신 확장 링·국소 왜곡 사용 |
| V03 | 대시 유령 잔상 | 기존 10 투사체 잔상의 대상 변경 | 대상 실루엣 복사·수명 제한 |
| V04 | 방사형 속도선 | 기존 10 궤적 표현·28 카메라 강조와 결합 | 화면 전체 가림과 반복 피로 확인 |
| V05 | 아이템 광택 스윕·bloom | 기존 20 반짝임의 재질 확장 | 지속 발광과 짧은 강조를 구분 |
| V06 | 포털·원형 마스크 전환 | 기존 22·23 장면 전환 | 원형 마스크는 새로운 장면 규칙이 아님 |
| V07 | 스프링 버튼·탄성 창 | 기존 14·16·19 크기/오버슈트/바운스 | 스프링은 구현 기법으로 별도 분류 |
| V08 | 금속·물·돌 표면별 타격 조각 | 기존 7·27 파티클 | 재질별 자산·음향·방향의 프리셋 |

V01~V08은 조합·변형에 대한 설계 제안이다. Phaser에 `Dissolve`라는 기본 FX가 있다고 가정하지 않는다. 공식 FX 목록에는 Glow·Bloom·Displacement·Shine 등이 있으며 전용 디졸브는 마스크나 사용자 셰이더가 필요하다. [Phaser FX 개념](https://docs.phaser.io/phaser/concepts/fx), [3.90 FX 목록](https://docs.phaser.io/api-documentation/3.90.0/namespace/fx)

## 조사 수준과 한계

Phaser·Spine·Godot·Unity·Epic 문서와 GDC 슬라이드의 관련 내용을 읽고 용도를 비교했다. GDC Cartwright 자료는 후속 움직임·스미어 부분, Bollo 자료는 관성 전이 부분을 확인했다. 발표 영상을 모두 시청하거나 예제 프로젝트를 실행한 것은 아니다.

`In Your Hands` GDC PDF는 검색에 노출됐지만 본문 열기가 용량 제한으로 실패해 상세 근거에서 제외했다. Epic 파괴 문서는 본문 추출이 제한되어 개요 이상의 알고리즘 근거로 사용하지 않았다. 최신 다른 엔진 문서의 버전 표시는 비교 원리에만 사용하며 Phaser 호환 API로 간주하지 않는다.

추가 효과의 최적 지속시간, 기기별 비용, 사용자 선호는 자료만으로 확정할 수 없다. 다음 문서의 숫자는 초기 실험값이며 측정 결과가 아니다. [개발 설계와 검증](implementation.md)
