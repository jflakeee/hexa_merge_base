# 애니메이션 시스템 - 상세 개발 계획서

> **문서 버전:** v1.0
> **최종 수정일:** 2026-02-13
> **프로젝트명:** Hexa Merge Basic
> **기반 설계문서:** `docs/design/02_ui-ux-design.md` - 섹션 4. 애니메이션 시스템
> **사용 라이브러리:** DOTween Pro (Unity)
> **목표 프레임레이트:** 60fps

---

## 목차

1. [아키텍처 개요](#1-아키텍처-개요)
2. [블록 생성 애니메이션](#2-블록-생성-애니메이션)
3. [블록 탭 선택 피드백](#3-블록-탭-선택-피드백)
4. [머지 애니메이션](#4-머지-애니메이션)
5. [파도 웨이브 애니메이션](#5-파도-웨이브-애니메이션)
6. [점수 팝업 애니메이션](#6-점수-팝업-애니메이션)
7. [콤보 이펙트](#7-콤보-이펙트)
8. [화면 전환 애니메이션](#8-화면-전환-애니메이션)
9. [파티클 시스템 설계](#9-파티클-시스템-설계)
10. [이징 함수 레퍼런스](#10-이징-함수-레퍼런스)
11. [성능 최적화](#11-성능-최적화)
12. [전체 체크리스트 요약](#12-전체-체크리스트-요약)

---

## 1. 아키텍처 개요

### 1.1 핵심 클래스 구조

```
AnimationManager (싱글톤, 전체 관리)
├── BlockAnimator          (블록 단위 애니메이션)
├── MergeAnimator          (머지 시퀀스)
├── WaveAnimator           (파도 웨이브)
├── ScorePopupAnimator     (점수 팝업)
├── ComboEffectController  (콤보 이펙트)
├── ScreenTransition       (화면 전환)
└── ParticlePoolManager    (파티클 오브젝트 풀)
```

### 1.2 공통 의존성

| 패키지 | 버전 | 용도 |
|--------|------|------|
| DOTween Pro | 1.2.7+ | 트윈 애니메이션 전체 |
| Unity Particle System | Built-in | 파티클 이펙트 |
| TextMeshPro | Built-in | 점수 팝업 텍스트 |

### 1.3 AnimationManager 싱글톤

```csharp
using DG.Tweening;
using UnityEngine;

/// <summary>
/// 모든 애니메이션의 중앙 관리자. 싱글톤 패턴.
/// 오브젝트 풀 초기화, 전역 애니메이션 설정을 담당한다.
/// </summary>
public class AnimationManager : MonoBehaviour
{
    public static AnimationManager Instance { get; private set; }

    [Header("Global Settings")]
    [SerializeField] private int tweenCapacity = 200;
    [SerializeField] private int sequenceCapacity = 50;

    private void Awake()
    {
        if (Instance != null && Instance != this)
        {
            Destroy(gameObject);
            return;
        }
        Instance = this;
        DontDestroyOnLoad(gameObject);

        // DOTween 초기화: 트윈/시퀀스 용량 사전 할당
        DOTween.Init(true, true, LogBehaviour.ErrorsOnly)
               .SetCapacity(tweenCapacity, sequenceCapacity);
        DOTween.defaultEaseType = Ease.OutQuad;
        DOTween.defaultAutoPlay = AutoPlay.All;
    }
}
```

---

## 2. 블록 생성 애니메이션

새로운 블록이 보드에 처음 나타날 때 재생되는 애니메이션.
Scale(0 -> 1.1 -> 1.0) + Fade(0 -> 1) 조합.

### 2.1 구현 항목 체크리스트

- [ ] **블록 스케일 트윈 구현**
  - 구현 설명: 블록이 Scale 0에서 시작하여 1.1(오버슈트)까지 커진 뒤 1.0으로 안착
  - 클래스/메서드: `BlockAnimator.PlaySpawnAnimation(Transform block, float delay)`
  - 예상 난이도: **하**
  - 의존성: DOTween, BlockView 컴포넌트

- [ ] **블록 페이드인 구현**
  - 구현 설명: CanvasGroup 또는 SpriteRenderer의 alpha를 0에서 1로 전환
  - 클래스/메서드: `BlockAnimator.FadeIn(CanvasGroup cg, float duration)`
  - 예상 난이도: **하**
  - 의존성: DOTween, CanvasGroup 또는 SpriteRenderer

- [ ] **순차 딜레이 시스템**
  - 구현 설명: 여러 블록이 동시에 생성될 때 블록별 0.03초 딜레이를 주어 파도 효과 연출
  - 클래스/메서드: `BlockAnimator.PlaySpawnSequence(List<Transform> blocks)`
  - 예상 난이도: **하**
  - 의존성: DOTween Sequence

### 2.2 스펙 요약

| 속성 | 값 |
|------|-----|
| 총 시간 | 0.25초 (250ms) |
| 이징 | EaseOutBack |
| 시작 스케일 | 0.0 |
| 오버슈트 스케일 | 1.1 |
| 최종 스케일 | 1.0 |
| 투명도 | 0 -> 1 (EaseOutQuad) |
| 블록별 순차 딜레이 | 0.03초 |

### 2.3 코드 스니펫

```csharp
using DG.Tweening;
using UnityEngine;
using System.Collections.Generic;

/// <summary>
/// 블록 단위 애니메이션을 담당하는 컴포넌트.
/// 각 블록의 생성, 탭 피드백, 선택/해제 등 개별 블록에 적용되는 모션을 관리한다.
/// </summary>
public class BlockAnimator : MonoBehaviour
{
    // --- 생성 애니메이션 상수 ---
    private const float SPAWN_DURATION = 0.25f;
    private const float SPAWN_OVERSHOOT_SCALE = 1.1f;
    private const float SPAWN_DELAY_PER_BLOCK = 0.03f;
    private const Ease SPAWN_SCALE_EASE = Ease.OutBack;
    private const Ease SPAWN_FADE_EASE = Ease.OutQuad;

    /// <summary>
    /// 단일 블록의 생성 애니메이션을 재생한다.
    /// Scale(0->1.1->1.0) + Fade(0->1) 시퀀스.
    /// </summary>
    /// <param name="block">애니메이션 대상 블록 Transform</param>
    /// <param name="canvasGroup">블록의 CanvasGroup (페이드용)</param>
    /// <param name="delay">재생 시작 전 딜레이(초)</param>
    /// <returns>생성된 Sequence (체이닝 또는 콜백 연결용)</returns>
    public Sequence PlaySpawnAnimation(Transform block, CanvasGroup canvasGroup, float delay = 0f)
    {
        // 초기 상태 설정
        block.localScale = Vector3.zero;
        canvasGroup.alpha = 0f;

        Sequence seq = DOTween.Sequence();
        seq.SetDelay(delay);

        // 스케일: 0 -> 1.1 -> 1.0 (EaseOutBack이 자연스러운 오버슈트를 제공)
        seq.Append(
            block.DOScale(1f, SPAWN_DURATION)
                 .SetEase(SPAWN_SCALE_EASE, SPAWN_OVERSHOOT_SCALE)
        );

        // 페이드: 0 -> 1 (스케일과 동시에 진행)
        seq.Join(
            canvasGroup.DOFade(1f, SPAWN_DURATION)
                       .SetEase(SPAWN_FADE_EASE)
        );

        return seq;
    }

    /// <summary>
    /// 여러 블록을 순차적 딜레이로 생성 애니메이션 재생.
    /// 블록별 0.03초 간격으로 파도처럼 나타나는 효과.
    /// </summary>
    /// <param name="blocks">생성할 블록 목록 (Transform, CanvasGroup 쌍)</param>
    /// <returns>전체 시퀀스</returns>
    public Sequence PlaySpawnSequence(List<(Transform transform, CanvasGroup cg)> blocks)
    {
        Sequence masterSeq = DOTween.Sequence();

        for (int i = 0; i < blocks.Count; i++)
        {
            float delay = i * SPAWN_DELAY_PER_BLOCK;
            var (blockTransform, cg) = blocks[i];
            Sequence blockSeq = PlaySpawnAnimation(blockTransform, cg, delay);
            masterSeq.Join(blockSeq);
        }

        return masterSeq;
    }
}
```

---

## 3. 블록 탭 선택 피드백

사용자가 블록을 탭했을 때 즉각적인 시각 피드백을 제공한다.
첫 번째 블록 선택, 두 번째 블록 선택(매칭 시도), 매칭 실패 흔들림 세 가지 상태를 처리한다.

### 3.1 구현 항목 체크리스트

- [ ] **탭 바운스 애니메이션**
  - 구현 설명: Scale 1.0 -> 0.95 -> 1.05 -> 1.0 탄성 바운스
  - 클래스/메서드: `BlockAnimator.PlayTapBounce(Transform block)`
  - 예상 난이도: **하**
  - 의존성: DOTween

- [ ] **글로우 테두리 효과**
  - 구현 설명: 흰색 3px 글로우 테두리를 fade in 0.1초로 표시. 선택 해제 시 fade out 0.1초
  - 클래스/메서드: `BlockAnimator.SetGlow(GameObject block, bool active)`
  - 예상 난이도: **중**
  - 의존성: DOTween, 별도 글로우 오브젝트(Outline Sprite 또는 셰이더)

- [ ] **선택 밝기 증가**
  - 구현 설명: 선택된 블록의 배경색 명도를 +15% 올림
  - 클래스/메서드: `BlockAnimator.SetHighlight(SpriteRenderer sr, bool active)`
  - 예상 난이도: **하**
  - 의존성: SpriteRenderer 또는 Image 컴포넌트

- [ ] **매칭 실패 흔들림(Shake)**
  - 구현 설명: 두 블록이 좌우로 흔들리며 빨간색으로 0.2초 번쩍임
  - 클래스/메서드: `BlockAnimator.PlayMatchFailShake(Transform blockA, Transform blockB)`
  - 예상 난이도: **중**
  - 의존성: DOTween (DOShakePosition), SpriteRenderer 색상 트윈

- [ ] **선택 해제 피드백**
  - 구현 설명: 같은 블록 재탭 시 테두리/글로우 fade out 0.1초
  - 클래스/메서드: `BlockAnimator.PlayDeselect(GameObject block)`
  - 예상 난이도: **하**
  - 의존성: DOTween

### 3.2 스펙 요약

**첫 번째 블록 선택:**

| 속성 | 값 |
|------|-----|
| 축소/확대 | Scale 1.0 -> 0.95 -> 1.05 -> 1.0 |
| 시간 | 0.15초 |
| 이징 | EaseOutElastic |
| 테두리 | 흰색 3px 글로우, fade in 0.1초 |
| 밝기 | 배경색 명도 +15% |

**매칭 실패:**

| 속성 | 값 |
|------|-----|
| 흔들림 | 좌우 Shake, 강도 5px |
| 시간 | 0.2초 |
| 색상 | 빨간색 번쩍임 (#F44336) |

### 3.3 코드 스니펫

```csharp
// BlockAnimator 클래스 내부에 추가

// --- 탭 피드백 상수 ---
private const float TAP_BOUNCE_DURATION = 0.15f;
private const float GLOW_FADE_DURATION = 0.1f;
private const float SHAKE_DURATION = 0.2f;
private const float SHAKE_STRENGTH = 5f;
private const float HIGHLIGHT_BRIGHTNESS = 0.15f;

/// <summary>
/// 블록 탭 시 바운스 피드백 재생.
/// Scale: 1.0 -> 0.95 -> 1.05 -> 1.0 탄성 바운스.
/// </summary>
public Tween PlayTapBounce(Transform block)
{
    block.DOKill(); // 기존 트윈 정리
    return block.DOPunchScale(
        punch: new Vector3(-0.05f, -0.05f, 0f),
        duration: TAP_BOUNCE_DURATION,
        vibrato: 2,
        elasticity: 0.5f
    ).SetEase(Ease.OutElastic);
}

/// <summary>
/// 글로우 테두리 표시/숨김.
/// glowObject는 블록 하위에 배치된 흰색 테두리 스프라이트.
/// </summary>
public Tween SetGlow(SpriteRenderer glowRenderer, bool active)
{
    glowRenderer.DOKill();
    float targetAlpha = active ? 1f : 0f;
    return glowRenderer.DOFade(targetAlpha, GLOW_FADE_DURATION);
}

/// <summary>
/// 선택 시 블록 밝기를 증가시킨다.
/// Color의 V(Value) 채널을 +15% 올린다.
/// </summary>
public void SetHighlight(SpriteRenderer sr, bool active, Color originalColor)
{
    if (active)
    {
        Color.RGBToHSV(originalColor, out float h, out float s, out float v);
        v = Mathf.Clamp01(v + HIGHLIGHT_BRIGHTNESS);
        sr.color = Color.HSVToRGB(h, s, v);
    }
    else
    {
        sr.color = originalColor;
    }
}

/// <summary>
/// 매칭 실패 시 두 블록을 좌우로 흔들고 빨간색으로 번쩍이게 한다.
/// </summary>
public Sequence PlayMatchFailShake(
    Transform blockA, SpriteRenderer srA, Color originalColorA,
    Transform blockB, SpriteRenderer srB, Color originalColorB)
{
    Color flashColor = new Color(0.96f, 0.26f, 0.21f, 1f); // #F44336

    Sequence seq = DOTween.Sequence();

    // 흔들림
    seq.Append(blockA.DOShakePosition(SHAKE_DURATION, SHAKE_STRENGTH, vibrato: 10));
    seq.Join(blockB.DOShakePosition(SHAKE_DURATION, SHAKE_STRENGTH, vibrato: 10));

    // 빨간 번쩍임
    seq.Join(srA.DOColor(flashColor, SHAKE_DURATION * 0.5f)
                .SetLoops(2, LoopType.Yoyo));
    seq.Join(srB.DOColor(flashColor, SHAKE_DURATION * 0.5f)
                .SetLoops(2, LoopType.Yoyo));

    // 원래 색상 복구
    seq.OnComplete(() =>
    {
        srA.color = originalColorA;
        srB.color = originalColorB;
    });

    return seq;
}
```

---

## 4. 머지 애니메이션

두 개의 같은 숫자 블록이 합쳐지는 핵심 애니메이션.
4단계 시퀀스: 이동 -> 합체 -> 팽창 -> 정착.
가장 중요한 만족감 요소이므로 파티클, 사운드, 색상 전환을 모두 포함한다.

### 4.1 구현 항목 체크리스트

- [ ] **블록 이동 (단계 1: 0~200ms)**
  - 구현 설명: 블록 B가 블록 A 위치로 EaseInQuad 가속 이동
  - 클래스/메서드: `MergeAnimator.PlayMergeSequence(BlockView source, BlockView target, int newValue, System.Action onComplete)`
  - 예상 난이도: **중**
  - 의존성: DOTween, BlockView

- [ ] **합체 및 숫자 전환 (단계 2: 200~300ms)**
  - 구현 설명: 두 블록이 겹치며 기존 숫자가 fade out, 새 숫자가 fade in (크로스페이드 0.1초)
  - 클래스/메서드: `MergeAnimator.CrossfadeNumber(BlockView block, int newValue)`
  - 예상 난이도: **중**
  - 의존성: TextMeshPro, DOTween

- [ ] **팽창 + 파티클 방출 (단계 3: 300~400ms)**
  - 구현 설명: 합쳐진 블록이 1.3배로 팽창하며 원형 파티클 8~12개 방출
  - 클래스/메서드: `MergeAnimator.PlayExpandWithParticles(BlockView block, Color blockColor)`
  - 예상 난이도: **상**
  - 의존성: DOTween, ParticlePoolManager

- [ ] **정착 (단계 4: 400~500ms)**
  - 구현 설명: 블록이 1.3배에서 1.0배로 EaseOutBack으로 돌아오며 안착
  - 클래스/메서드: 상기 `PlayMergeSequence` 시퀀스 내 포함
  - 예상 난이도: **하**
  - 의존성: DOTween

- [ ] **색상 전환**
  - 구현 설명: 합체 순간 새 숫자의 색상으로 즉시 전환
  - 클래스/메서드: `MergeAnimator.ApplyNewColor(BlockView block, int newValue)`
  - 예상 난이도: **하**
  - 의존성: 숫자별 색상 매핑 테이블 (ColorConfig)

- [ ] **머지 사운드 피치 변조**
  - 구현 설명: 숫자 크기에 비례하여 "merge.wav"의 피치를 상승 (2=1.0, 2048=2.0)
  - 클래스/메서드: `AudioManager.PlayMergeSound(int blockValue)`
  - 예상 난이도: **중**
  - 의존성: AudioManager, AudioSource

### 4.2 스펙 요약

| 속성 | 값 |
|------|-----|
| 총 시간 | 0.5초 (500ms) |
| 이동 이징 | EaseInQuad (가속 이동) |
| 팽창 이징 | EaseOutBack (오버슈트) |
| 파티클 | 원형 8~12개, 블록 색상, 수명 0.4초 |
| 숫자 전환 | 크로스페이드 0.1초 |
| 색상 전환 | 새 숫자 색상으로 즉시 전환 |

### 4.3 코드 스니펫

```csharp
using DG.Tweening;
using UnityEngine;
using TMPro;

/// <summary>
/// 머지 시퀀스 전체를 관리하는 컴포넌트.
/// 4단계(이동->합체->팽창->정착) 시퀀스와 파티클 방출을 제어한다.
/// </summary>
public class MergeAnimator : MonoBehaviour
{
    // --- 머지 애니메이션 상수 ---
    private const float MOVE_DURATION = 0.2f;       // 단계1: 이동
    private const float CROSSFADE_DURATION = 0.1f;   // 단계2: 숫자 크로스페이드
    private const float EXPAND_DURATION = 0.1f;      // 단계3: 팽창
    private const float SETTLE_DURATION = 0.1f;      // 단계4: 정착
    private const float EXPAND_SCALE = 1.3f;
    private const Ease MOVE_EASE = Ease.InQuad;
    private const Ease EXPAND_EASE = Ease.OutQuad;
    private const Ease SETTLE_EASE = Ease.OutBack;

    [SerializeField] private ParticlePoolManager particlePool;

    /// <summary>
    /// 머지 전체 시퀀스를 재생한다.
    /// source(블록B)가 target(블록A) 위치로 이동 후 합체한다.
    /// </summary>
    /// <param name="source">이동하는 블록 (블록 B)</param>
    /// <param name="target">고정된 블록 (블록 A, 머지 결과 위치)</param>
    /// <param name="newValue">합쳐진 후 새 숫자값</param>
    /// <param name="newColor">새 숫자에 해당하는 블록 색상</param>
    /// <param name="onComplete">시퀀스 완료 콜백</param>
    public void PlayMergeSequence(
        BlockView source,
        BlockView target,
        int newValue,
        Color newColor,
        System.Action onComplete = null)
    {
        Sequence seq = DOTween.Sequence();

        // ====== 단계 1: 이동 (0~200ms) ======
        // 블록 B가 블록 A 위치로 가속 이동
        seq.Append(
            source.transform.DOMove(target.transform.position, MOVE_DURATION)
                  .SetEase(MOVE_EASE)
        );

        // ====== 단계 2: 합체 (200~300ms) ======
        // source 비활성화 + 숫자 크로스페이드 + 색상 전환
        seq.AppendCallback(() =>
        {
            source.gameObject.SetActive(false);
            ApplyNewColor(target, newColor);
        });
        seq.Append(CrossfadeNumber(target, newValue));

        // ====== 단계 3: 팽창 + 파티클 (300~400ms) ======
        seq.Append(
            target.transform.DOScale(EXPAND_SCALE, EXPAND_DURATION)
                  .SetEase(EXPAND_EASE)
        );
        seq.AppendCallback(() =>
        {
            // 합체 위치에서 파티클 방출
            particlePool.EmitMergeParticles(
                target.transform.position, newColor
            );
        });

        // ====== 단계 4: 정착 (400~500ms) ======
        seq.Append(
            target.transform.DOScale(1f, SETTLE_DURATION)
                  .SetEase(SETTLE_EASE)
        );

        seq.OnComplete(() => onComplete?.Invoke());
    }

    /// <summary>
    /// 숫자 텍스트를 크로스페이드로 전환한다.
    /// 기존 숫자 fade out과 새 숫자 fade in이 동시에 진행된다.
    /// </summary>
    private Sequence CrossfadeNumber(BlockView block, int newValue)
    {
        TMP_Text label = block.NumberLabel;
        Sequence fade = DOTween.Sequence();

        // 기존 숫자 fade out
        fade.Append(label.DOFade(0f, CROSSFADE_DURATION));

        // 새 숫자 설정 후 fade in
        fade.AppendCallback(() => label.text = newValue.ToString());
        fade.Append(label.DOFade(1f, CROSSFADE_DURATION));

        return fade;
    }

    /// <summary>
    /// 블록 색상을 새 숫자에 맞게 즉시 변경한다.
    /// </summary>
    private void ApplyNewColor(BlockView block, Color newColor)
    {
        block.BackgroundRenderer.color = newColor;
    }
}
```

---

## 5. 파도 웨이브 애니메이션

머지 이후 빈 자리를 채우며 새로운 블록이 밀려 들어오는 애니메이션.
"파도처럼 밀려오는" 느낌을 3가지 방향 패턴으로 구현한다.

### 5.1 구현 항목 체크리스트

- [ ] **파도 방향 패턴 시스템**
  - 구현 설명: 아래->위, 좌->우, 외곽->중앙 3가지 패턴 중 무작위 또는 순환 선택
  - 클래스/메서드: `WaveAnimator.GetWavePattern()`, `WaveDirection` enum
  - 예상 난이도: **중**
  - 의존성: 헥사곤 그리드 좌표 시스템

- [ ] **순차 진입 애니메이션**
  - 구현 설명: 각 블록이 화면 바깥에서 목표 위치까지 0.3초에 걸쳐 이동, 블록 간 0.04초 딜레이
  - 클래스/메서드: `WaveAnimator.PlayWaveAnimation(List<BlockView> newBlocks, WaveDirection direction)`
  - 예상 난이도: **상**
  - 의존성: DOTween, 그리드 좌표 -> 화면 좌표 변환

- [ ] **도착 바운스**
  - 구현 설명: 목표 위치 도착 시 미세 바운스 (EaseOutBounce, 0.1초)
  - 클래스/메서드: `WaveAnimator` 시퀀스 내 포함
  - 예상 난이도: **하**
  - 의존성: DOTween

- [ ] **패턴 순환/무작위 선택 로직**
  - 구현 설명: 매번 파도가 발생할 때마다 방향을 순환하거나 랜덤으로 선택
  - 클래스/메서드: `WaveAnimator.NextDirection()`
  - 예상 난이도: **하**
  - 의존성: 없음

### 5.2 스펙 요약

| 속성 | 값 |
|------|-----|
| 진입 방향 | 하단/좌측/우측 중 무작위 또는 순환 |
| 블록 간 딜레이 | 0.04초 |
| 이동 시간 | 0.3초/블록 |
| 이동 이징 | EaseOutCubic (감속 도착) |
| 도착 바운스 | EaseOutBounce, 0.1초 |

### 5.3 코드 스니펫

```csharp
using DG.Tweening;
using UnityEngine;
using System.Collections.Generic;
using System.Linq;

/// <summary>
/// 파도(웨이브) 애니메이션을 담당한다.
/// 머지 후 빈 공간에 새 블록이 밀려 들어오는 연출을 3가지 패턴으로 제어한다.
/// </summary>
public class WaveAnimator : MonoBehaviour
{
    public enum WaveDirection
    {
        BottomToTop,   // 패턴 A: 아래에서 위로
        LeftToRight,   // 패턴 B: 좌에서 우로
        OuterToCenter  // 패턴 C: 외곽에서 중앙으로
    }

    // --- 웨이브 애니메이션 상수 ---
    private const float MOVE_DURATION = 0.3f;
    private const float DELAY_PER_BLOCK = 0.04f;
    private const float BOUNCE_DURATION = 0.1f;
    private const float OFFSCREEN_OFFSET = 300f; // 화면 바깥 시작 거리(px)
    private const Ease MOVE_EASE = Ease.OutCubic;
    private const Ease BOUNCE_EASE = Ease.OutBounce;

    private int _directionIndex = 0;
    private readonly WaveDirection[] _directions = {
        WaveDirection.BottomToTop,
        WaveDirection.LeftToRight,
        WaveDirection.OuterToCenter
    };

    /// <summary>
    /// 다음 파도 방향을 순환 방식으로 반환한다.
    /// </summary>
    public WaveDirection NextDirection()
    {
        WaveDirection dir = _directions[_directionIndex];
        _directionIndex = (_directionIndex + 1) % _directions.Length;
        return dir;
    }

    /// <summary>
    /// 파도 애니메이션 재생.
    /// 새 블록들이 지정된 방향에서 순차적으로 밀려 들어온다.
    /// </summary>
    /// <param name="newBlocks">새로 생성된 블록 목록</param>
    /// <param name="direction">파도 진입 방향</param>
    /// <param name="onComplete">전체 완료 콜백</param>
    public void PlayWaveAnimation(
        List<BlockView> newBlocks,
        WaveDirection direction,
        System.Action onComplete = null)
    {
        // 방향에 따라 블록 정렬 (진입 순서 결정)
        List<BlockView> sorted = SortBlocksByDirection(newBlocks, direction);

        Sequence masterSeq = DOTween.Sequence();

        for (int i = 0; i < sorted.Count; i++)
        {
            BlockView block = sorted[i];
            Vector3 targetPos = block.transform.position;

            // 시작 위치 계산 (화면 바깥)
            Vector3 startOffset = GetStartOffset(direction);
            block.transform.position = targetPos + startOffset;

            float delay = i * DELAY_PER_BLOCK;

            // 이동 트윈
            Sequence blockSeq = DOTween.Sequence();
            blockSeq.SetDelay(delay);
            blockSeq.Append(
                block.transform.DOMove(targetPos, MOVE_DURATION)
                     .SetEase(MOVE_EASE)
            );
            // 도착 바운스 (미세한 스케일 바운스)
            blockSeq.Append(
                block.transform.DOPunchScale(
                    new Vector3(0.05f, 0.05f, 0f),
                    BOUNCE_DURATION, vibrato: 1, elasticity: 0f
                ).SetEase(BOUNCE_EASE)
            );

            masterSeq.Join(blockSeq);
        }

        masterSeq.OnComplete(() => onComplete?.Invoke());
    }

    /// <summary>
    /// 방향에 따라 블록을 진입 순서로 정렬한다.
    /// BottomToTop: Y좌표 오름차순 (아래부터)
    /// LeftToRight: X좌표 오름차순 (왼쪽부터)
    /// OuterToCenter: 중심까지 거리 내림차순 (바깥부터)
    /// </summary>
    private List<BlockView> SortBlocksByDirection(
        List<BlockView> blocks, WaveDirection direction)
    {
        switch (direction)
        {
            case WaveDirection.BottomToTop:
                return blocks.OrderBy(b => b.transform.position.y).ToList();
            case WaveDirection.LeftToRight:
                return blocks.OrderBy(b => b.transform.position.x).ToList();
            case WaveDirection.OuterToCenter:
                Vector3 center = GetBoardCenter(blocks);
                return blocks.OrderByDescending(
                    b => Vector3.Distance(b.transform.position, center)
                ).ToList();
            default:
                return blocks;
        }
    }

    /// <summary>
    /// 방향에 따른 화면 바깥 시작 오프셋을 반환한다.
    /// </summary>
    private Vector3 GetStartOffset(WaveDirection direction)
    {
        switch (direction)
        {
            case WaveDirection.BottomToTop:
                return Vector3.down * OFFSCREEN_OFFSET;
            case WaveDirection.LeftToRight:
                return Vector3.left * OFFSCREEN_OFFSET;
            case WaveDirection.OuterToCenter:
                return Vector3.down * OFFSCREEN_OFFSET; // 기본 아래에서 진입
            default:
                return Vector3.down * OFFSCREEN_OFFSET;
        }
    }

    private Vector3 GetBoardCenter(List<BlockView> blocks)
    {
        if (blocks.Count == 0) return Vector3.zero;
        Vector3 sum = Vector3.zero;
        foreach (var b in blocks) sum += b.transform.position;
        return sum / blocks.Count;
    }
}
```

---

## 6. 점수 팝업 애니메이션

머지 발생 시 획득 점수가 시각적으로 표시되는 효과.
텍스트가 나타나며 위로 떠올라 페이드아웃된다.

### 6.1 구현 항목 체크리스트

- [ ] **기본 점수 팝업**
  - 구현 설명: "+점수" 텍스트가 머지 위치에서 Scale 0->1.2->1.0으로 나타난 뒤, Y축 40px 위로 이동하며 0.8초 후 페이드아웃
  - 클래스/메서드: `ScorePopupAnimator.ShowPopup(Vector3 position, int score)`
  - 예상 난이도: **중**
  - 의존성: DOTween, TextMeshPro, ScorePopup 프리팹, 오브젝트 풀

- [ ] **대형 점수 특수 효과 (1000점 이상)**
  - 구현 설명: 크기 1.5배, 색상 빨강(#FF5722), 별 파티클 추가
  - 클래스/메서드: `ScorePopupAnimator.ShowBigPopup(Vector3 position, int score)`
  - 예상 난이도: **중**
  - 의존성: DOTween, ParticlePoolManager, 별 파티클 프리팹

- [ ] **점수 팝업 오브젝트 풀**
  - 구현 설명: 팝업 텍스트 오브젝트를 미리 생성하여 풀링, 재사용으로 GC 방지
  - 클래스/메서드: `ObjectPool<ScorePopup>` 제네릭 풀
  - 예상 난이도: **중**
  - 의존성: ScorePopup 프리팹

### 6.2 스펙 요약

| 속성 | 일반 (< 1000) | 대형 (>= 1000) |
|------|-------------|---------------|
| 시작 위치 | 머지 블록 중심 | 머지 블록 중심 |
| Y축 이동 | 위로 40px | 위로 40px |
| 시간 | 0.8초 | 0.8초 |
| 폰트 | Roboto Bold, 20px | Roboto Bold, 30px (1.5배) |
| 색상 | #FFD700 (금색) | #FF5722 (빨강) |
| 외곽선 | #000000, 2px | #000000, 2px |
| 스케일 | 0->1.2->1.0 (EaseOutBack, 0.15초) | 0->1.2->1.0 (EaseOutBack, 0.15초) |
| 페이드아웃 | 0.5초 시점부터 (EaseInQuad) | 0.5초 시점부터 (EaseInQuad) |
| 파티클 | 없음 | 별 파티클 추가 |

### 6.3 코드 스니펫

```csharp
using DG.Tweening;
using UnityEngine;
using TMPro;

/// <summary>
/// 점수 팝업 애니메이션 관리.
/// 오브젝트 풀에서 팝업을 가져와 애니메이션 후 반환한다.
/// </summary>
public class ScorePopupAnimator : MonoBehaviour
{
    // --- 점수 팝업 상수 ---
    private const float POPUP_TOTAL_DURATION = 0.8f;
    private const float POPUP_SCALE_DURATION = 0.15f;
    private const float POPUP_FADE_START = 0.5f;       // 페이드아웃 시작 시점(초)
    private const float POPUP_FLOAT_Y = 40f;            // Y축 이동 거리(px)
    private const float POPUP_OVERSHOOT_SCALE = 1.2f;
    private const int BIG_SCORE_THRESHOLD = 1000;

    private static readonly Color NormalColor = new Color(1f, 0.84f, 0f);      // #FFD700
    private static readonly Color BigScoreColor = new Color(1f, 0.34f, 0.13f); // #FF5722

    [SerializeField] private ObjectPool<ScorePopup> popupPool;
    [SerializeField] private ParticlePoolManager particlePool;

    /// <summary>
    /// 점수 팝업을 표시한다.
    /// 1000점 미만이면 일반, 1000점 이상이면 대형 연출.
    /// </summary>
    /// <param name="worldPosition">팝업 표시 월드 좌표</param>
    /// <param name="score">표시할 점수값</param>
    public void ShowPopup(Vector3 worldPosition, int score)
    {
        bool isBig = score >= BIG_SCORE_THRESHOLD;

        ScorePopup popup = popupPool.Get();
        popup.transform.position = worldPosition;
        popup.SetScore(score);

        TMP_Text label = popup.Label;
        CanvasGroup cg = popup.CanvasGroup;

        // 색상 및 크기 설정
        label.color = isBig ? BigScoreColor : NormalColor;
        float fontScale = isBig ? 1.5f : 1.0f;
        popup.transform.localScale = Vector3.zero;

        Sequence seq = DOTween.Sequence();

        // 스케일 팝: 0 -> 1.2 -> 1.0
        seq.Append(
            popup.transform.DOScale(fontScale, POPUP_SCALE_DURATION)
                 .SetEase(Ease.OutBack, POPUP_OVERSHOOT_SCALE)
        );

        // Y축 위로 이동
        seq.Join(
            popup.transform.DOMoveY(
                worldPosition.y + POPUP_FLOAT_Y,
                POPUP_TOTAL_DURATION
            ).SetEase(Ease.OutQuad)
        );

        // 페이드아웃 (0.5초 시점에서 시작)
        float fadeDuration = POPUP_TOTAL_DURATION - POPUP_FADE_START;
        seq.Insert(POPUP_FADE_START,
            cg.DOFade(0f, fadeDuration).SetEase(Ease.InQuad)
        );

        // 대형 점수일 때 별 파티클 추가
        if (isBig)
        {
            seq.InsertCallback(POPUP_SCALE_DURATION, () =>
            {
                particlePool.EmitStarParticles(worldPosition);
            });
        }

        // 완료 후 풀에 반환
        seq.OnComplete(() =>
        {
            cg.alpha = 1f;
            popupPool.Release(popup);
        });
    }
}
```

---

## 7. 콤보 이펙트

연속 머지 시 콤보 카운터가 증가하며 단계별 시각 효과가 재생된다.
콤보 단계에 따라 텍스트, 화면 흔들림, 플래시 등의 강도가 증가한다.

### 7.1 구현 항목 체크리스트

- [ ] **콤보 타이머 로직**
  - 구현 설명: 머지 후 2.0초 이내에 다음 머지를 하면 콤보 연결, 타이머 초과 시 콤보 초기화
  - 클래스/메서드: `ComboEffectController.OnMerge()`, `ComboEffectController.ResetCombo()`
  - 예상 난이도: **중**
  - 의존성: 게임 로직 이벤트 시스템

- [ ] **콤보 텍스트 표시 (x2~x5+)**
  - 구현 설명: 콤보 단계별 텍스트 크기(1.0x~1.5x), 색상(흰->노랑->무지개) 변화
  - 클래스/메서드: `ComboEffectController.ShowComboText(int comboCount)`
  - 예상 난이도: **중**
  - 의존성: DOTween, TextMeshPro

- [ ] **화면 흔들림 (x3 이상)**
  - 구현 설명: 콤보 x3부터 카메라 미세 흔들림, x5+에서 강한 흔들림
  - 클래스/메서드: `ComboEffectController.ShakeScreen(int comboCount)`
  - 예상 난이도: **중**
  - 의존성: DOTween (Camera.DOShakePosition)

- [ ] **화면 플래시 (x5 이상)**
  - 구현 설명: 콤보 x5 이상 시 화면 전체가 하얀색으로 번쩍이는 플래시 효과
  - 클래스/메서드: `ComboEffectController.FlashScreen()`
  - 예상 난이도: **중**
  - 의존성: DOTween, 풀스크린 오버레이 Image

- [ ] **콤보 종료 페이드아웃**
  - 구현 설명: 콤보 타이머 만료 시 콤보 카운터 텍스트가 0.5초에 걸쳐 fade out
  - 클래스/메서드: `ComboEffectController.FadeOutCombo()`
  - 예상 난이도: **하**
  - 의존성: DOTween, CanvasGroup

- [ ] **콤보 배수 점수 계산 연동**
  - 구현 설명: 콤보 x2=1.5배, x3=2.0배, x4=2.5배, x5+=3.0배 점수 배수 적용
  - 클래스/메서드: `ComboEffectController.GetScoreMultiplier()`
  - 예상 난이도: **하**
  - 의존성: ScoreManager

### 7.2 스펙 요약

| 콤보 | 배수 | 텍스트 색상 | 텍스트 스케일 | 화면 효과 |
|------|------|-----------|-------------|---------|
| x2 | 1.5배 | 흰색 | 1.0x | 없음 |
| x3 | 2.0배 | 노란색 | 1.2x | 미세 흔들림 |
| x4 | 2.5배 | 노란색+글로우 | 1.3x | 글로우 + 파티클 |
| x5+ | 3.0배 | 무지개(그라데이션) | 1.5x | 강한 흔들림 + 플래시 + 대형 파티클 |

콤보 타이머: 2.0초 (화면에 표시하지 않음)

### 7.3 코드 스니펫

```csharp
using DG.Tweening;
using UnityEngine;
using UnityEngine.UI;
using TMPro;

/// <summary>
/// 콤보 이펙트 전체를 관리한다.
/// 콤보 타이머, 단계별 시각 효과(텍스트, 화면 흔들림, 플래시)를 제어한다.
/// </summary>
public class ComboEffectController : MonoBehaviour
{
    // --- 콤보 상수 ---
    private const float COMBO_TIMEOUT = 2.0f;
    private const float COMBO_FADEOUT_DURATION = 0.5f;
    private const float FLASH_DURATION = 0.15f;

    // 콤보 단계별 배수
    private static readonly float[] MULTIPLIERS = { 1f, 1f, 1.5f, 2f, 2.5f, 3f };

    [Header("UI References")]
    [SerializeField] private TMP_Text comboLabel;
    [SerializeField] private CanvasGroup comboCanvasGroup;
    [SerializeField] private Image screenFlashOverlay;
    [SerializeField] private Camera mainCamera;
    [SerializeField] private ParticlePoolManager particlePool;

    private int _comboCount = 0;
    private float _comboTimer = 0f;
    private Tween _fadeOutTween;
    private Vector3 _originalCameraPos;

    private void Start()
    {
        _originalCameraPos = mainCamera.transform.position;
        screenFlashOverlay.color = new Color(1f, 1f, 1f, 0f);
        comboCanvasGroup.alpha = 0f;
    }

    private void Update()
    {
        if (_comboCount > 0)
        {
            _comboTimer -= Time.deltaTime;
            if (_comboTimer <= 0f)
            {
                ResetCombo();
            }
        }
    }

    /// <summary>
    /// 머지 발생 시 호출. 콤보 카운터를 증가시키고 이펙트를 재생한다.
    /// </summary>
    public void OnMerge()
    {
        _comboCount++;
        _comboTimer = COMBO_TIMEOUT;

        // 기존 페이드아웃 취소
        _fadeOutTween?.Kill();
        comboCanvasGroup.alpha = 1f;

        if (_comboCount >= 2)
        {
            ShowComboText(_comboCount);

            if (_comboCount >= 3) ShakeScreen(_comboCount);
            if (_comboCount >= 5) FlashScreen();
        }
    }

    /// <summary>
    /// 현재 콤보에 따른 점수 배수를 반환한다.
    /// </summary>
    public float GetScoreMultiplier()
    {
        int index = Mathf.Clamp(_comboCount, 0, MULTIPLIERS.Length - 1);
        return MULTIPLIERS[index];
    }

    /// <summary>
    /// 콤보 텍스트를 단계별 스타일로 표시한다.
    /// </summary>
    private void ShowComboText(int count)
    {
        comboLabel.text = $"COMBO x{count}";
        comboLabel.transform.DOKill();

        // 단계별 스케일 결정
        float targetScale = count >= 5 ? 1.5f : count >= 4 ? 1.3f : count >= 3 ? 1.2f : 1.0f;

        // 단계별 색상 결정
        if (count >= 5)
        {
            // 무지개 효과는 셰이더 또는 DOTween 색상 루프로 구현
            comboLabel.enableVertexGradient = true;
            comboLabel.colorGradient = new VertexGradient(
                Color.red, Color.yellow, Color.cyan, Color.magenta
            );
        }
        else if (count >= 3)
        {
            comboLabel.enableVertexGradient = false;
            comboLabel.color = Color.yellow;
        }
        else
        {
            comboLabel.enableVertexGradient = false;
            comboLabel.color = Color.white;
        }

        // 스케일 바운스
        comboLabel.transform.localScale = Vector3.zero;
        comboLabel.transform.DOScale(targetScale, 0.2f).SetEase(Ease.OutBack);
    }

    /// <summary>
    /// 카메라 흔들림 효과. 콤보 단계에 따라 강도가 달라진다.
    /// </summary>
    private void ShakeScreen(int count)
    {
        float strength = count >= 5 ? 8f : 3f;
        mainCamera.transform.DOKill();
        mainCamera.transform.position = _originalCameraPos;
        mainCamera.transform.DOShakePosition(0.3f, strength, vibrato: 10)
                  .OnComplete(() => mainCamera.transform.position = _originalCameraPos);
    }

    /// <summary>
    /// 화면 전체 하얀색 플래시 효과 (x5 이상).
    /// </summary>
    private void FlashScreen()
    {
        screenFlashOverlay.DOKill();
        screenFlashOverlay.color = new Color(1f, 1f, 1f, 0.6f);
        screenFlashOverlay.DOFade(0f, FLASH_DURATION);
    }

    /// <summary>
    /// 콤보를 초기화하고 텍스트를 페이드아웃한다.
    /// </summary>
    private void ResetCombo()
    {
        _comboCount = 0;
        _fadeOutTween = comboCanvasGroup.DOFade(0f, COMBO_FADEOUT_DURATION);
    }
}
```

---

## 8. 화면 전환 애니메이션

화면 간 이동 시 사용되는 전환 효과. 각 전환 상황별로 다른 효과를 적용한다.

### 8.1 구현 항목 체크리스트

- [ ] **Circle Wipe 전환 (메인 메뉴 -> 게임)**
  - 구현 설명: PLAY 버튼 위치에서 원형이 확산되며 다음 화면으로 전환 (0.5초)
  - 클래스/메서드: `ScreenTransition.CircleWipe(Vector2 origin, float duration)`
  - 예상 난이도: **상**
  - 의존성: 커스텀 셰이더 (원형 마스크), DOTween

- [ ] **오버레이 페이드 전환 (게임 <-> 일시정지)**
  - 구현 설명: 반투명 검은색 오버레이가 페이드인/아웃 (0.3초), 배경 블러 효과 포함
  - 클래스/메서드: `ScreenTransition.OverlayFade(bool fadeIn, float duration)`
  - 예상 난이도: **중**
  - 의존성: DOTween, CanvasGroup, 블러 셰이더(선택)

- [ ] **슬라이드 전환 (메뉴 간 이동)**
  - 구현 설명: 화면이 상/하/좌/우 방향으로 슬라이드하며 전환
  - 클래스/메서드: `ScreenTransition.Slide(SlideDirection dir, RectTransform panel, float duration)`
  - 예상 난이도: **중**
  - 의존성: DOTween, RectTransform

- [ ] **전환 매니저 (전환 규칙 테이블)**
  - 구현 설명: 각 화면 전환 경우에 맞는 효과/시간을 매핑하는 설정 테이블
  - 클래스/메서드: `ScreenTransition.Transition(ScreenType from, ScreenType to)`
  - 예상 난이도: **중**
  - 의존성: ScreenType enum, 전환 설정 ScriptableObject

### 8.2 스펙 요약

| 전환 | 효과 | 시간 | 이징 |
|------|------|------|------|
| 메인 메뉴 -> 게임 | Circle Wipe | 0.5초 | EaseInOutQuad |
| 게임 -> 일시정지 | 오버레이 페이드인 | 0.3초 | EaseOutQuad |
| 일시정지 -> 게임 | 오버레이 페이드아웃 | 0.3초 | EaseInQuad |
| 게임 -> 메인 메뉴 | 슬라이드 다운 | 0.4초 | EaseInOutCubic |
| 메인 메뉴 -> 설정 | 슬라이드 라이트 | 0.3초 | EaseInOutCubic |
| 설정 -> 메인 메뉴 | 슬라이드 레프트 | 0.3초 | EaseInOutCubic |
| 메인 메뉴 -> 리더보드 | 슬라이드 업 | 0.35초 | EaseInOutCubic |
| 메인 메뉴 -> 상점 | 슬라이드 업 | 0.35초 | EaseInOutCubic |

### 8.3 코드 스니펫

```csharp
using DG.Tweening;
using UnityEngine;
using UnityEngine.UI;

/// <summary>
/// 화면 전환 애니메이션을 관리한다.
/// Circle Wipe, 오버레이 페이드, 슬라이드 3가지 방식을 제공한다.
/// </summary>
public class ScreenTransition : MonoBehaviour
{
    public enum SlideDirection { Up, Down, Left, Right }

    [Header("Circle Wipe")]
    [SerializeField] private Material circleWipeMaterial; // 원형 마스크 셰이더 머터리얼
    [SerializeField] private Image circleWipeImage;

    [Header("Overlay")]
    [SerializeField] private CanvasGroup overlayCanvasGroup;

    /// <summary>
    /// Circle Wipe 전환.
    /// 지정 위치에서 원형이 확산되며 화면을 덮는다.
    /// 셰이더의 _Progress 프로퍼티를 0->1로 트윈한다.
    /// </summary>
    /// <param name="origin">원형 시작 위치 (스크린 좌표, 0~1 정규화)</param>
    /// <param name="duration">전환 시간</param>
    /// <param name="onHalfway">화면이 완전히 덮인 시점 콜백 (씬 전환용)</param>
    /// <param name="onComplete">전환 완료 콜백</param>
    public void CircleWipe(Vector2 origin, float duration,
        System.Action onHalfway = null, System.Action onComplete = null)
    {
        circleWipeImage.gameObject.SetActive(true);
        circleWipeMaterial.SetVector("_Center", new Vector4(origin.x, origin.y, 0, 0));
        circleWipeMaterial.SetFloat("_Progress", 0f);

        Sequence seq = DOTween.Sequence();

        // 전반: 원형 확산으로 덮기
        seq.Append(
            circleWipeMaterial.DOFloat(1f, "_Progress", duration * 0.5f)
                              .SetEase(Ease.InOutQuad)
        );
        seq.AppendCallback(() => onHalfway?.Invoke());

        // 후반: 원형 축소로 새 화면 드러내기
        seq.Append(
            circleWipeMaterial.DOFloat(0f, "_Progress", duration * 0.5f)
                              .SetEase(Ease.InOutQuad)
        );

        seq.OnComplete(() =>
        {
            circleWipeImage.gameObject.SetActive(false);
            onComplete?.Invoke();
        });
    }

    /// <summary>
    /// 오버레이 페이드인/아웃.
    /// 일시정지 화면 진입/퇴장 시 사용한다.
    /// </summary>
    public Tween OverlayFade(bool fadeIn, float duration)
    {
        float targetAlpha = fadeIn ? 1f : 0f;
        Ease ease = fadeIn ? Ease.OutQuad : Ease.InQuad;

        overlayCanvasGroup.gameObject.SetActive(true);
        return overlayCanvasGroup.DOFade(targetAlpha, duration)
                                 .SetEase(ease)
                                 .OnComplete(() =>
                                 {
                                     if (!fadeIn) overlayCanvasGroup.gameObject.SetActive(false);
                                 });
    }

    /// <summary>
    /// 패널 슬라이드 전환.
    /// 지정 방향에서 슬라이드인하거나 슬라이드아웃한다.
    /// </summary>
    /// <param name="panel">이동할 패널 RectTransform</param>
    /// <param name="direction">슬라이드 방향</param>
    /// <param name="slideIn">true=화면 안으로, false=화면 밖으로</param>
    /// <param name="duration">전환 시간</param>
    public Tween Slide(RectTransform panel, SlideDirection direction,
        bool slideIn, float duration)
    {
        Vector2 screenSize = new Vector2(Screen.width, Screen.height);
        Vector2 offScreenPos = GetOffScreenPosition(direction, screenSize);
        Vector2 onScreenPos = Vector2.zero;

        if (slideIn)
        {
            panel.anchoredPosition = offScreenPos;
            return panel.DOAnchorPos(onScreenPos, duration).SetEase(Ease.InOutCubic);
        }
        else
        {
            panel.anchoredPosition = onScreenPos;
            return panel.DOAnchorPos(offScreenPos, duration).SetEase(Ease.InOutCubic);
        }
    }

    private Vector2 GetOffScreenPosition(SlideDirection dir, Vector2 screenSize)
    {
        switch (dir)
        {
            case SlideDirection.Up:    return new Vector2(0, screenSize.y);
            case SlideDirection.Down:  return new Vector2(0, -screenSize.y);
            case SlideDirection.Left:  return new Vector2(-screenSize.x, 0);
            case SlideDirection.Right: return new Vector2(screenSize.x, 0);
            default:                   return Vector2.zero;
        }
    }
}
```

---

## 9. 파티클 시스템 설계

### 9.1 구현 항목 체크리스트

- [ ] **머지 파티클 (원형 방사)**
  - 구현 설명: 합체 순간 원형으로 8~12개의 작은 원 파티클이 방출, 블록 색상 적용, 수명 0.4초
  - 클래스/메서드: `ParticlePoolManager.EmitMergeParticles(Vector3 pos, Color color)`
  - 예상 난이도: **중**
  - 의존성: Unity ParticleSystem, 오브젝트 풀

- [ ] **별 파티클 (대형 점수)**
  - 구현 설명: 1000점 이상 획득 시 별 모양 파티클 5~8개 방출, 금색, 수명 0.6초
  - 클래스/메서드: `ParticlePoolManager.EmitStarParticles(Vector3 pos)`
  - 예상 난이도: **중**
  - 의존성: Unity ParticleSystem, 별 스프라이트, 오브젝트 풀

- [ ] **콤보 대형 파티클 (x5+)**
  - 구현 설명: 콤보 x5 이상 시 화면 넓은 범위에 대형 파티클 방출
  - 클래스/메서드: `ParticlePoolManager.EmitComboParticles(int comboLevel)`
  - 예상 난이도: **중**
  - 의존성: Unity ParticleSystem, 오브젝트 풀

- [ ] **파티클 오브젝트 풀**
  - 구현 설명: ParticleSystem 인스턴스를 미리 생성하여 풀링. 재사용 시 위치/색상만 변경
  - 클래스/메서드: `ParticlePoolManager` 클래스 전체
  - 예상 난이도: **상**
  - 의존성: Unity ParticleSystem

### 9.2 파티클 상세 사양

**머지 파티클:**

| 속성 | 값 |
|------|-----|
| 형태 | 원형(Circle) 스프라이트 |
| 수량 | 8~12개 (랜덤) |
| 방출 패턴 | 중심에서 360도 원형 방사 |
| 시작 크기 | 6~10px (랜덤) |
| 종료 크기 | 0px (크기 감소) |
| 시작 투명도 | 1.0 |
| 종료 투명도 | 0.0 |
| 수명 | 0.4초 |
| 속도 | 100~200px/s (랜덤) |
| 색상 | 합체된 블록의 배경 색상 |

**별 파티클:**

| 속성 | 값 |
|------|-----|
| 형태 | 별(Star) 스프라이트 |
| 수량 | 5~8개 |
| 방출 패턴 | 위쪽 180도 반원형 |
| 시작 크기 | 12~18px |
| 종료 크기 | 4px |
| 수명 | 0.6초 |
| 색상 | #FFD700 (금색) |
| 회전 | 랜덤 회전 (0~360도) |

### 9.3 코드 스니펫

```csharp
using UnityEngine;
using System.Collections.Generic;

/// <summary>
/// 파티클 시스템 오브젝트 풀 관리자.
/// 머지, 별, 콤보 파티클을 미리 생성하고 풀링하여 재사용한다.
/// GC 할당 없이 파티클을 방출할 수 있도록 한다.
/// </summary>
public class ParticlePoolManager : MonoBehaviour
{
    [Header("Prefabs")]
    [SerializeField] private ParticleSystem mergeParticlePrefab;
    [SerializeField] private ParticleSystem starParticlePrefab;
    [SerializeField] private ParticleSystem comboParticlePrefab;

    [Header("Pool Settings")]
    [SerializeField] private int mergePoolSize = 10;
    [SerializeField] private int starPoolSize = 5;
    [SerializeField] private int comboPoolSize = 3;

    private Queue<ParticleSystem> _mergePool;
    private Queue<ParticleSystem> _starPool;
    private Queue<ParticleSystem> _comboPool;

    private void Awake()
    {
        _mergePool = CreatePool(mergeParticlePrefab, mergePoolSize);
        _starPool = CreatePool(starParticlePrefab, starPoolSize);
        _comboPool = CreatePool(comboParticlePrefab, comboPoolSize);
    }

    /// <summary>
    /// 지정 프리팹으로 오브젝트 풀을 생성한다.
    /// </summary>
    private Queue<ParticleSystem> CreatePool(ParticleSystem prefab, int size)
    {
        Queue<ParticleSystem> pool = new Queue<ParticleSystem>();
        for (int i = 0; i < size; i++)
        {
            ParticleSystem ps = Instantiate(prefab, transform);
            ps.gameObject.SetActive(false);
            pool.Enqueue(ps);
        }
        return pool;
    }

    /// <summary>
    /// 풀에서 파티클을 꺼내 사용하고, 재생 완료 후 자동 반환한다.
    /// </summary>
    private ParticleSystem GetFromPool(Queue<ParticleSystem> pool)
    {
        if (pool.Count == 0)
        {
            Debug.LogWarning("[ParticlePoolManager] Pool exhausted. Consider increasing pool size.");
            return null;
        }
        ParticleSystem ps = pool.Dequeue();
        ps.gameObject.SetActive(true);
        return ps;
    }

    private void ReturnToPool(Queue<ParticleSystem> pool, ParticleSystem ps)
    {
        ps.Stop(true, ParticleSystemStopBehavior.StopEmittingAndClear);
        ps.gameObject.SetActive(false);
        pool.Enqueue(ps);
    }

    /// <summary>
    /// 머지 파티클 방출.
    /// 8~12개의 원형 파티클이 블록 색상으로 원형 방사된다.
    /// </summary>
    /// <param name="position">방출 위치 (월드 좌표)</param>
    /// <param name="blockColor">블록 배경 색상</param>
    public void EmitMergeParticles(Vector3 position, Color blockColor)
    {
        ParticleSystem ps = GetFromPool(_mergePool);
        if (ps == null) return;

        ps.transform.position = position;

        // 색상 동적 설정
        var main = ps.main;
        main.startColor = blockColor;

        int count = Random.Range(8, 13);
        ps.Emit(count);

        // 수명(0.4초) 후 자동 반환
        StartCoroutine(ReturnAfterDelay(_mergePool, ps, 0.5f));
    }

    /// <summary>
    /// 별 파티클 방출.
    /// 대형 점수(1000+) 획득 시 금색 별 파티클을 방출한다.
    /// </summary>
    public void EmitStarParticles(Vector3 position)
    {
        ParticleSystem ps = GetFromPool(_starPool);
        if (ps == null) return;

        ps.transform.position = position;
        int count = Random.Range(5, 9);
        ps.Emit(count);

        StartCoroutine(ReturnAfterDelay(_starPool, ps, 0.7f));
    }

    /// <summary>
    /// 콤보 대형 파티클 방출 (x5+).
    /// </summary>
    public void EmitComboParticles(int comboLevel)
    {
        ParticleSystem ps = GetFromPool(_comboPool);
        if (ps == null) return;

        ps.transform.position = Vector3.zero; // 화면 중앙
        int count = comboLevel >= 5 ? 20 : 12;
        ps.Emit(count);

        StartCoroutine(ReturnAfterDelay(_comboPool, ps, 1.0f));
    }

    private System.Collections.IEnumerator ReturnAfterDelay(
        Queue<ParticleSystem> pool, ParticleSystem ps, float delay)
    {
        yield return new WaitForSeconds(delay);
        ReturnToPool(pool, ps);
    }
}
```

---

## 10. 이징 함수 레퍼런스

프로젝트 전체에서 사용하는 DOTween 이징 함수 매핑 표.
각 애니메이션 유형에 따라 적합한 이징을 통일되게 적용한다.

### 10.1 이징 함수 사용 매핑

| 애니메이션 | 이징 함수 | DOTween Ease | 선택 이유 |
|-----------|---------|-------------|---------|
| 블록 생성 (스케일) | EaseOutBack | `Ease.OutBack` | 오버슈트 후 정착 -> 톡 튀어나오는 느낌 |
| 블록 생성 (페이드) | EaseOutQuad | `Ease.OutQuad` | 부드러운 페이드인 |
| 탭 바운스 | EaseOutElastic | `Ease.OutElastic` | 탄성 바운스 -> 물리적 탭 느낌 |
| 머지 이동 | EaseInQuad | `Ease.InQuad` | 가속 이동 -> 빨려 들어가는 느낌 |
| 머지 팽창 | EaseOutBack | `Ease.OutBack` | 오버슈트 -> 팽창 후 수축 |
| 파도 이동 | EaseOutCubic | `Ease.OutCubic` | 감속 도착 -> 자연스러운 정착 |
| 파도 바운스 | EaseOutBounce | `Ease.OutBounce` | 통통 튀는 도착 느낌 |
| 점수 팝업 스케일 | EaseOutBack | `Ease.OutBack` | 톡 튀어나오는 출현 |
| 점수 팝업 페이드 | EaseInQuad | `Ease.InQuad` | 자연스러운 사라짐 |
| 화면 전환 슬라이드 | EaseInOutCubic | `Ease.InOutCubic` | 부드러운 가감속 |
| Circle Wipe | EaseInOutQuad | `Ease.InOutQuad` | 균형 잡힌 확산/수축 |

### 10.2 이징 커브 시각화 참고

```
EaseOutBack:     ╱‾‾\__          (오버슈트 후 정착)
EaseOutElastic:  ╱~‾~─           (탄성 진동)
EaseInQuad:      ___╱            (가속)
EaseOutCubic:    ╱───            (감속)
EaseOutBounce:   ╱╲╱╲─           (바운스)
EaseInOutCubic:  __╱╱──          (S자 가감속)
```

### 10.3 커스텀 이징이 필요한 경우

DOTween의 기본 이징으로 충분하지 않은 경우, `AnimationCurve`를 사용한 커스텀 커브를 적용할 수 있다.

```csharp
/// <summary>
/// 커스텀 AnimationCurve를 DOTween에 적용하는 예시.
/// Inspector에서 커브를 편집할 수 있다.
/// </summary>
public class CustomEaseExample : MonoBehaviour
{
    [SerializeField] private AnimationCurve customBounce;

    public void PlayWithCustomEase(Transform target)
    {
        target.DOScale(1f, 0.3f).SetEase(customBounce);
    }
}
```

---

## 11. 성능 최적화

### 11.1 구현 항목 체크리스트

- [ ] **제네릭 오브젝트 풀 시스템**
  - 구현 설명: 점수 팝업, 파티클, 블록 등 자주 생성/파괴되는 오브젝트를 풀링하여 GC 부하 제거
  - 클래스/메서드: `ObjectPool<T>` 제네릭 클래스
  - 예상 난이도: **중**
  - 의존성: 없음 (Unity 기본)

- [ ] **DOTween 용량 사전 할당**
  - 구현 설명: 게임 시작 시 트윈 200개, 시퀀스 50개를 미리 할당하여 런타임 할당 방지
  - 클래스/메서드: `AnimationManager.Awake()` 내 `DOTween.SetCapacity()`
  - 예상 난이도: **하**
  - 의존성: DOTween

- [ ] **트윈 재활용 및 Kill 관리**
  - 구현 설명: 오브젝트 비활성화/파괴 전 연결된 트윈을 반드시 Kill, SetAutoKill 활용
  - 클래스/메서드: 모든 애니메이션 클래스에 `DOKill()` 호출 패턴 적용
  - 예상 난이도: **하**
  - 의존성: DOTween

- [ ] **ParticleSystem 최적화**
  - 구현 설명: 최대 파티클 수 제한, 렌더 모드 Mesh->Billboard, 셰이더 경량화
  - 클래스/메서드: ParticleSystem 프리팹 설정
  - 예상 난이도: **중**
  - 의존성: Unity ParticleSystem

- [ ] **프레임 드롭 감지 및 품질 조절**
  - 구현 설명: FPS가 30 이하로 떨어지면 파티클 수량 감소, 일부 이펙트 생략
  - 클래스/메서드: `PerformanceMonitor.CheckFrameRate()`, `AnimationQuality` enum
  - 예상 난이도: **상**
  - 의존성: AnimationManager, 모든 이펙트 클래스

- [ ] **WebGL 특화 최적화**
  - 구현 설명: WebGL 빌드에서는 파티클 수량 50% 감소, 블러 셰이더 비활성화
  - 클래스/메서드: `PlatformOptimizer.ApplyWebGLSettings()`
  - 예상 난이도: **중**
  - 의존성: `Application.platform` 분기

### 11.2 제네릭 오브젝트 풀 코드

```csharp
using UnityEngine;
using System.Collections.Generic;

/// <summary>
/// 제네릭 오브젝트 풀.
/// MonoBehaviour를 상속한 모든 컴포넌트를 풀링할 수 있다.
/// 점수 팝업, 블록, 파티클 등에 범용적으로 사용한다.
/// </summary>
/// <typeparam name="T">풀링할 컴포넌트 타입</typeparam>
[System.Serializable]
public class ObjectPool<T> where T : MonoBehaviour
{
    [SerializeField] private T prefab;
    [SerializeField] private int initialSize = 10;
    [SerializeField] private Transform parent;

    private Queue<T> _pool;
    private bool _initialized = false;

    /// <summary>
    /// 풀을 초기화하고 오브젝트를 미리 생성한다.
    /// 게임 시작 시 한 번만 호출한다.
    /// </summary>
    public void Initialize(Transform parentTransform = null)
    {
        if (_initialized) return;
        parent = parentTransform;
        _pool = new Queue<T>();

        for (int i = 0; i < initialSize; i++)
        {
            T obj = Object.Instantiate(prefab, parent);
            obj.gameObject.SetActive(false);
            _pool.Enqueue(obj);
        }
        _initialized = true;
    }

    /// <summary>
    /// 풀에서 오브젝트를 꺼낸다. 풀이 비었으면 새로 생성한다.
    /// </summary>
    public T Get()
    {
        if (!_initialized) Initialize();

        T obj;
        if (_pool.Count > 0)
        {
            obj = _pool.Dequeue();
        }
        else
        {
            // 풀 확장 (동적 생성)
            obj = Object.Instantiate(prefab, parent);
            Debug.LogWarning($"[ObjectPool] Pool exhausted for {typeof(T).Name}. Expanding.");
        }
        obj.gameObject.SetActive(true);
        return obj;
    }

    /// <summary>
    /// 사용이 끝난 오브젝트를 풀에 반환한다.
    /// </summary>
    public void Release(T obj)
    {
        obj.gameObject.SetActive(false);
        _pool.Enqueue(obj);
    }

    /// <summary>
    /// 현재 풀에 남아있는 비활성 오브젝트 수를 반환한다.
    /// </summary>
    public int CountInactive => _pool?.Count ?? 0;
}
```

### 11.3 프레임 드롭 감지 코드

```csharp
using UnityEngine;

/// <summary>
/// 프레임 레이트를 모니터링하고, 성능이 떨어지면 애니메이션 품질을 자동 조절한다.
/// </summary>
public class PerformanceMonitor : MonoBehaviour
{
    public enum AnimationQuality { High, Medium, Low }

    public static AnimationQuality CurrentQuality { get; private set; } = AnimationQuality.High;

    private const float CHECK_INTERVAL = 2.0f;   // 체크 주기(초)
    private const float LOW_FPS_THRESHOLD = 30f;  // Low 품질 전환 기준
    private const float MED_FPS_THRESHOLD = 45f;  // Medium 품질 전환 기준

    private float _timer;
    private int _frameCount;

    private void Update()
    {
        _frameCount++;
        _timer += Time.unscaledDeltaTime;

        if (_timer >= CHECK_INTERVAL)
        {
            float avgFps = _frameCount / _timer;
            UpdateQuality(avgFps);
            _timer = 0f;
            _frameCount = 0;
        }
    }

    private void UpdateQuality(float fps)
    {
        AnimationQuality newQuality;

        if (fps < LOW_FPS_THRESHOLD)
            newQuality = AnimationQuality.Low;
        else if (fps < MED_FPS_THRESHOLD)
            newQuality = AnimationQuality.Medium;
        else
            newQuality = AnimationQuality.High;

        if (newQuality != CurrentQuality)
        {
            CurrentQuality = newQuality;
            Debug.Log($"[PerformanceMonitor] Quality changed to: {CurrentQuality} (FPS: {fps:F1})");
        }
    }

    /// <summary>
    /// 현재 품질에 따른 파티클 수량 배수를 반환한다.
    /// High=1.0, Medium=0.6, Low=0.3
    /// </summary>
    public static float GetParticleMultiplier()
    {
        switch (CurrentQuality)
        {
            case AnimationQuality.High:   return 1.0f;
            case AnimationQuality.Medium: return 0.6f;
            case AnimationQuality.Low:    return 0.3f;
            default:                      return 1.0f;
        }
    }
}
```

---

## 12. 전체 체크리스트 요약

### 12.1 블록 생성 애니메이션 (난이도: 하)

- [ ] 블록 스케일 트윈 (Scale 0->1.1->1.0, EaseOutBack, 0.25초)
- [ ] 블록 페이드인 (Alpha 0->1, EaseOutQuad, 0.25초)
- [ ] 블록별 순차 딜레이 시스템 (0.03초 간격)

### 12.2 블록 탭 선택 피드백 (난이도: 중)

- [ ] 탭 바운스 (Scale 1.0->0.95->1.05->1.0, EaseOutElastic, 0.15초)
- [ ] 글로우 테두리 표시/숨김 (흰색 3px, fade 0.1초)
- [ ] 선택 밝기 증가 (명도 +15%)
- [ ] 매칭 실패 흔들림 (Shake 0.2초 + 빨간 번쩍임)
- [ ] 선택 해제 피드백 (글로우 fade out 0.1초)

### 12.3 머지 애니메이션 (난이도: 상)

- [ ] 단계1: 블록 이동 (EaseInQuad, 0.2초)
- [ ] 단계2: 합체 + 숫자 크로스페이드 (0.1초)
- [ ] 단계3: 팽창 1.3배 + 파티클 8~12개 방출 (0.1초)
- [ ] 단계4: 정착 1.0배 (EaseOutBack, 0.1초)
- [ ] 색상 즉시 전환
- [ ] 머지 사운드 피치 변조

### 12.4 파도 웨이브 애니메이션 (난이도: 상)

- [ ] 3가지 방향 패턴 구현 (아래->위, 좌->우, 외곽->중앙)
- [ ] 패턴 순환/무작위 선택 로직
- [ ] 순차 진입 (EaseOutCubic, 0.3초/블록, 0.04초 딜레이)
- [ ] 도착 바운스 (EaseOutBounce, 0.1초)

### 12.5 점수 팝업 애니메이션 (난이도: 중)

- [ ] 기본 팝업 (금색, Scale 0->1.2->1.0, Y+40px, 0.8초)
- [ ] 대형 팝업 (1000+, 빨강, 1.5배 크기, 별 파티클)
- [ ] 팝업 오브젝트 풀

### 12.6 콤보 이펙트 (난이도: 중)

- [ ] 콤보 타이머 로직 (2.0초 이내 연속 머지)
- [ ] 콤보 텍스트 단계별 스타일 (x2~x5+)
- [ ] 화면 흔들림 (x3 이상)
- [ ] 화면 플래시 (x5 이상)
- [ ] 콤보 종료 페이드아웃 (0.5초)
- [ ] 콤보 배수 점수 계산 연동

### 12.7 화면 전환 애니메이션 (난이도: 상)

- [ ] Circle Wipe (메인->게임, 0.5초, 커스텀 셰이더)
- [ ] 오버레이 페이드 (게임<->일시정지, 0.3초)
- [ ] 슬라이드 전환 4방향 (0.3~0.4초)
- [ ] 전환 규칙 테이블 (ScriptableObject)

### 12.8 파티클 시스템 (난이도: 중)

- [ ] 머지 파티클 프리팹 (원형, 8~12개, 0.4초)
- [ ] 별 파티클 프리팹 (별 모양, 5~8개, 0.6초)
- [ ] 콤보 대형 파티클 프리팹
- [ ] ParticlePoolManager 구현

### 12.9 성능 최적화 (난이도: 상)

- [ ] 제네릭 오브젝트 풀 (`ObjectPool<T>`)
- [ ] DOTween 용량 사전 할당 (트윈 200개, 시퀀스 50개)
- [ ] 트윈 Kill 관리 패턴 적용 (모든 애니메이터)
- [ ] ParticleSystem 최적화 (최대 수량 제한, 렌더 모드)
- [ ] 프레임 드롭 감지 및 품질 자동 조절
- [ ] WebGL 특화 최적화 (파티클 50% 감소, 블러 비활성화)

---

### 난이도별 요약

| 난이도 | 항목 수 | 주요 내용 |
|--------|---------|---------|
| **하** (쉬움) | 10개 | 스케일/페이드 트윈, 딜레이, 색상 전환, 선택 해제 등 |
| **중** (보통) | 18개 | 글로우, 크로스페이드, 풀링, 콤보 텍스트, 슬라이드 전환 등 |
| **상** (어려움) | 8개 | 머지 시퀀스, 파도 패턴, Circle Wipe 셰이더, 성능 모니터링 등 |

### 예상 전체 개발 기간

| 단계 | 기간 | 내용 |
|------|------|------|
| 1단계: 기반 구축 | 2일 | AnimationManager, ObjectPool, DOTween 설정 |
| 2단계: 핵심 애니메이션 | 3일 | 블록 생성, 탭 피드백, 머지 시퀀스 |
| 3단계: 보조 애니메이션 | 2일 | 파도 웨이브, 점수 팝업, 콤보 이펙트 |
| 4단계: 화면 전환 | 2일 | Circle Wipe 셰이더, 슬라이드, 오버레이 |
| 5단계: 파티클 시스템 | 1일 | 3종 파티클 프리팹 + 풀 매니저 |
| 6단계: 최적화/테스트 | 2일 | 성능 모니터링, WebGL 테스트, 60fps 검증 |
| **합계** | **12일** | |

---

> **문서 끝**
> 이 문서는 `docs/design/02_ui-ux-design.md`의 섹션 4(애니메이션 시스템)을 기반으로 작성되었습니다.
> 개발 진행에 따라 지속적으로 업데이트됩니다.
