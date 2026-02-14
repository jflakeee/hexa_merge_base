# 06. 오디오 시스템 개발 계획서

> **기반 설계 문서:** `docs/design/02_ui-ux-design.md` - 섹션 5. 사운드 디자인
> **최종 수정일:** 2026-02-13
> **대상 플랫폼:** Android / iOS / WebGL
> **Unity 버전:** 2022.3 LTS 이상

---

## 목차

1. [시스템 아키텍처 개요](#1-시스템-아키텍처-개요)
2. [BGM 매니저 구현](#2-bgm-매니저-구현)
3. [SFX 매니저 구현](#3-sfx-매니저-구현)
4. [볼륨 설정 시스템](#4-볼륨-설정-시스템)
5. [햅틱 피드백 시스템](#5-햅틱-피드백-시스템)
6. [오디오 리소스 관리 (Addressables)](#6-오디오-리소스-관리-addressables)
7. [통합 테스트 체크리스트](#7-통합-테스트-체크리스트)

---

## 1. 시스템 아키텍처 개요

### 1.1 전체 구조도

```
AudioManager (싱글톤, DontDestroyOnLoad)
├── BGMManager
│   ├── AudioSource A (현재 트랙)
│   ├── AudioSource B (크로스페이드 대상)
│   └── BGMTrackDatabase (ScriptableObject)
├── SFXManager
│   ├── SFXPool (AudioSource x8 풀링)
│   ├── SFXClipDatabase (ScriptableObject)
│   └── PitchModulator
├── VolumeController
│   ├── AudioMixer (Master/BGM/SFX 그룹)
│   └── VolumeSettingsData (PlayerPrefs)
└── HapticManager
    ├── IOSHapticProvider
    ├── AndroidHapticProvider
    └── WebGLHapticProvider
```

### 1.2 클래스 다이어그램 요약

| 클래스 | 역할 | 네임스페이스 |
|--------|------|-------------|
| `AudioManager` | 싱글톤 진입점, 하위 매니저 생성/관리 | `HexaMerge.Audio` |
| `BGMManager` | BGM 재생, 크로스페이드, 씬별 전환 | `HexaMerge.Audio` |
| `SFXManager` | 효과음 재생, 풀링, 피치 변조 | `HexaMerge.Audio` |
| `VolumeController` | 볼륨 제어, PlayerPrefs 저장/로드 | `HexaMerge.Audio` |
| `HapticManager` | 플랫폼별 햅틱 피드백 분기 처리 | `HexaMerge.Audio` |
| `AudioAddressableLoader` | Addressables 기반 오디오 리소스 로드/해제 | `HexaMerge.Audio` |
| `SFXClipData` | SFX 클립 설정 ScriptableObject | `HexaMerge.Audio.Data` |
| `BGMTrackData` | BGM 트랙 설정 ScriptableObject | `HexaMerge.Audio.Data` |

---

## 2. BGM 매니저 구현

### 2.1 BGM 트랙 데이터 정의

- [ ] **BGMTrackData ScriptableObject 생성**
  - **구현 설명:** 각 BGM 트랙의 메타데이터를 ScriptableObject로 정의한다. ID, 트랙명, 용도(씬), 기본 볼륨, 루프 여부 등을 포함한다.
  - **클래스/메서드:**
    - `BGMTrackData : ScriptableObject`
    - `BGMTrackDatabase : ScriptableObject` (전체 트랙 목록 관리)
  - **코드 스니펫:**
    ```csharp
    using UnityEngine;
    using UnityEngine.AddressableAssets;

    namespace HexaMerge.Audio.Data
    {
        public enum BGMTrackID
        {
            BGM_01_SunnyPuzzle,   // 메인 메뉴
            BGM_02_ChillMerge,    // 게임 플레이 (기본)
            BGM_03_ComboVibes,    // 게임 플레이 (콤보 시)
            BGM_04_ShopMelody     // 상점
        }

        [CreateAssetMenu(fileName = "BGMTrackData", menuName = "HexaMerge/Audio/BGM Track Data")]
        public class BGMTrackData : ScriptableObject
        {
            public BGMTrackID trackID;
            public string trackName;
            public AssetReferenceT<AudioClip> clipReference;
            [Range(0f, 1f)] public float baseVolume = 0.7f;
            public bool loop = true;
            public int bpm;
        }

        [CreateAssetMenu(fileName = "BGMTrackDatabase", menuName = "HexaMerge/Audio/BGM Track Database")]
        public class BGMTrackDatabase : ScriptableObject
        {
            public BGMTrackData[] tracks;

            public BGMTrackData GetTrack(BGMTrackID id)
            {
                foreach (var track in tracks)
                {
                    if (track.trackID == id) return track;
                }
                Debug.LogWarning($"[BGMTrackDatabase] 트랙을 찾을 수 없음: {id}");
                return null;
            }
        }
    }
    ```
  - **예상 난이도:** 하
  - **의존성:** Addressables 패키지 설치

---

### 2.2 BGMManager 코어 구현

- [ ] **BGMManager 클래스 구현 (기본 재생/정지)**
  - **구현 설명:** 두 개의 AudioSource(A/B)를 사용하여 BGM을 재생한다. 하나는 현재 재생 중인 트랙, 다른 하나는 크로스페이드 전환 대상으로 사용한다. 각 화면에 지정된 BGM을 루프 재생하며, 재생/정지/일시정지 기능을 제공한다.
  - **클래스/메서드:**
    - `BGMManager`
    - `Init(BGMTrackDatabase database)` - 초기화
    - `Play(BGMTrackID trackID)` - 지정 BGM 재생
    - `Stop()` - 정지
    - `Pause()` - 일시정지 (볼륨 50%로 0.3초 페이드)
    - `Resume()` - 재개 (볼륨 100%로 0.3초 페이드)
  - **코드 스니펫:**
    ```csharp
    using System.Collections;
    using UnityEngine;

    namespace HexaMerge.Audio
    {
        public class BGMManager : MonoBehaviour
        {
            private AudioSource _sourceA;
            private AudioSource _sourceB;
            private AudioSource _activeSource;
            private AudioSource _inactiveSource;

            private BGMTrackDatabase _database;
            private BGMTrackID _currentTrackID;
            private bool _isPaused;

            private Coroutine _fadeCoroutine;
            private Coroutine _pauseFadeCoroutine;

            // 설계서 정의: 크로스페이드 1.0초, 콤보 전환 0.5초, 일시정지 페이드 0.3초
            private const float CROSSFADE_DURATION = 1.0f;
            private const float COMBO_FADE_DURATION = 0.5f;
            private const float PAUSE_FADE_DURATION = 0.3f;
            private const float PAUSE_VOLUME_RATIO = 0.5f;

            private float _targetVolume = 1f;

            public void Init(BGMTrackDatabase database)
            {
                _database = database;

                _sourceA = gameObject.AddComponent<AudioSource>();
                _sourceB = gameObject.AddComponent<AudioSource>();

                ConfigureSource(_sourceA);
                ConfigureSource(_sourceB);

                _activeSource = _sourceA;
                _inactiveSource = _sourceB;
            }

            private void ConfigureSource(AudioSource source)
            {
                source.playOnAwake = false;
                source.loop = true;
                source.priority = 0; // 최고 우선순위
                source.spatialBlend = 0f; // 2D 사운드
            }

            public void Play(BGMTrackID trackID)
            {
                if (_currentTrackID == trackID && _activeSource.isPlaying)
                    return;

                var trackData = _database.GetTrack(trackID);
                if (trackData == null) return;

                _currentTrackID = trackID;
                StartCrossfade(trackData, CROSSFADE_DURATION);
            }

            public void Pause()
            {
                if (_isPaused) return;
                _isPaused = true;

                if (_pauseFadeCoroutine != null)
                    StopCoroutine(_pauseFadeCoroutine);
                _pauseFadeCoroutine = StartCoroutine(
                    FadeVolume(_activeSource, _activeSource.volume,
                        _targetVolume * PAUSE_VOLUME_RATIO, PAUSE_FADE_DURATION));
            }

            public void Resume()
            {
                if (!_isPaused) return;
                _isPaused = false;

                if (_pauseFadeCoroutine != null)
                    StopCoroutine(_pauseFadeCoroutine);
                _pauseFadeCoroutine = StartCoroutine(
                    FadeVolume(_activeSource, _activeSource.volume,
                        _targetVolume, PAUSE_FADE_DURATION));
            }

            public void Stop()
            {
                if (_fadeCoroutine != null) StopCoroutine(_fadeCoroutine);
                _activeSource.Stop();
                _inactiveSource.Stop();
            }

            public void SetVolume(float volume)
            {
                _targetVolume = volume;
                if (!_isPaused)
                    _activeSource.volume = volume;
                else
                    _activeSource.volume = volume * PAUSE_VOLUME_RATIO;
            }

            // 아래 2.3 크로스페이드 섹션에서 상세 구현
            private void StartCrossfade(BGMTrackData trackData, float duration) { /* 2.3 참조 */ }
            private IEnumerator FadeVolume(AudioSource source, float from, float to, float duration) { /* 2.3 참조 */ }
        }
    }
    ```
  - **예상 난이도:** 중
  - **의존성:** `BGMTrackDatabase`, `AudioAddressableLoader`

---

### 2.3 크로스페이드 시스템

- [ ] **BGM 크로스페이드 전환 구현**
  - **구현 설명:** 화면 이동 시 현재 BGM에서 새 BGM으로 1.0초 크로스페이드 전환한다. 두 AudioSource를 교대로 사용하며, 하나는 페이드아웃, 다른 하나는 페이드인한다. 콤보 전환 시에는 0.5초로 더 빠르게 전환한다.
  - **클래스/메서드:**
    - `BGMManager.StartCrossfade(BGMTrackData trackData, float duration)`
    - `BGMManager.CrossfadeCoroutine(AudioClip newClip, float baseVolume, float duration)` (코루틴)
    - `BGMManager.FadeVolume(AudioSource source, float from, float to, float duration)` (코루틴)
  - **코드 스니펫:**
    ```csharp
    // BGMManager 클래스 내부에 추가

    private async void StartCrossfade(BGMTrackData trackData, float duration)
    {
        // Addressables를 통한 비동기 클립 로드
        var clip = await AudioAddressableLoader.LoadClipAsync(trackData.clipReference);
        if (clip == null) return;

        if (_fadeCoroutine != null)
            StopCoroutine(_fadeCoroutine);

        _fadeCoroutine = StartCoroutine(
            CrossfadeCoroutine(clip, trackData.baseVolume, duration));
    }

    private IEnumerator CrossfadeCoroutine(AudioClip newClip, float baseVolume, float duration)
    {
        // 소스 스왑: inactive -> 새 트랙 재생용
        _inactiveSource.clip = newClip;
        _inactiveSource.volume = 0f;
        _inactiveSource.Play();

        float startVolumeA = _activeSource.volume;
        float targetVolumeB = _targetVolume * baseVolume;
        float elapsed = 0f;

        while (elapsed < duration)
        {
            elapsed += Time.unscaledDeltaTime; // 일시정지 중에도 작동
            float t = Mathf.Clamp01(elapsed / duration);

            // EaseInOutSine 커브 적용으로 자연스러운 전환
            float curve = -(Mathf.Cos(Mathf.PI * t) - 1f) / 2f;

            _activeSource.volume = Mathf.Lerp(startVolumeA, 0f, curve);
            _inactiveSource.volume = Mathf.Lerp(0f, targetVolumeB, curve);

            yield return null;
        }

        _activeSource.Stop();
        _activeSource.volume = 0f;

        // 소스 스왑
        (_activeSource, _inactiveSource) = (_inactiveSource, _activeSource);

        _fadeCoroutine = null;
    }

    private IEnumerator FadeVolume(AudioSource source, float from, float to, float duration)
    {
        float elapsed = 0f;
        while (elapsed < duration)
        {
            elapsed += Time.unscaledDeltaTime;
            float t = Mathf.Clamp01(elapsed / duration);
            source.volume = Mathf.Lerp(from, to, t);
            yield return null;
        }
        source.volume = to;
    }
    ```
  - **예상 난이도:** 중
  - **의존성:** `BGMManager` 코어, `AudioAddressableLoader`

---

### 2.4 씬별 BGM 전환 로직

- [ ] **씬/화면별 자동 BGM 전환 구현**
  - **구현 설명:** 각 화면(메인 메뉴, 게임 플레이, 상점)에 진입할 때 설계서에 정의된 BGM을 자동으로 크로스페이드 전환한다. 씬 매핑 테이블을 ScriptableObject 또는 딕셔너리로 관리한다.
  - **클래스/메서드:**
    - `BGMManager.OnSceneChanged(string sceneName)`
    - `BGMSceneMapping` (씬 이름 -> BGMTrackID 매핑)
  - **코드 스니펫:**
    ```csharp
    using System.Collections.Generic;
    using UnityEngine;

    namespace HexaMerge.Audio
    {
        // BGMManager 클래스 내부에 추가

        // 설계서 기준 씬별 BGM 매핑
        // BGM_01: 메인 메뉴 / BGM_02: 게임 플레이 / BGM_04: 상점
        private static readonly Dictionary<string, BGMTrackID> SceneBGMMap = new()
        {
            { "MainMenu",  BGMTrackID.BGM_01_SunnyPuzzle },
            { "Gameplay",  BGMTrackID.BGM_02_ChillMerge },
            { "Shop",      BGMTrackID.BGM_04_ShopMelody }
        };

        public void OnSceneChanged(string sceneName)
        {
            if (SceneBGMMap.TryGetValue(sceneName, out var trackID))
            {
                Play(trackID);
            }
            else
            {
                Debug.LogWarning($"[BGMManager] 씬에 매핑된 BGM 없음: {sceneName}");
            }
        }
    }
    ```
  - **예상 난이도:** 하
  - **의존성:** `BGMManager` 코어, 씬 관리 시스템

---

### 2.5 콤보 BGM 전환 로직

- [ ] **콤보 x3 이상 시 BGM 동적 전환 구현**
  - **구현 설명:** 설계서 규칙에 따라 콤보 x3 이상에 도달하면 BGM_02("Chill Merge")에서 BGM_03("Combo Vibes")으로 0.5초 페이드 전환한다. 콤보가 종료되면 2초 대기 후 BGM_02로 복귀한다.
  - **클래스/메서드:**
    - `BGMManager.OnComboChanged(int comboCount)`
    - `BGMManager.ComboEndDelayCoroutine()` (코루틴)
  - **코드 스니펫:**
    ```csharp
    // BGMManager 클래스 내부에 추가

    private const int COMBO_BGM_THRESHOLD = 3;
    private const float COMBO_END_DELAY = 2.0f;
    private bool _isComboTrackPlaying;
    private Coroutine _comboEndCoroutine;

    /// <summary>
    /// 콤보 시스템에서 콤보 카운트 변경 시 호출한다.
    /// 설계서: 콤보 x3 이상 -> BGM_02->BGM_03 (0.5초 페이드)
    ///         콤보 종료 -> 2초 후 BGM_03->BGM_02 (크로스페이드)
    /// </summary>
    public void OnComboChanged(int comboCount)
    {
        if (comboCount >= COMBO_BGM_THRESHOLD && !_isComboTrackPlaying)
        {
            // 콤보 돌입: BGM_03으로 빠른 전환
            if (_comboEndCoroutine != null)
            {
                StopCoroutine(_comboEndCoroutine);
                _comboEndCoroutine = null;
            }

            _isComboTrackPlaying = true;
            var comboTrack = _database.GetTrack(BGMTrackID.BGM_03_ComboVibes);
            if (comboTrack != null)
                StartCrossfade(comboTrack, COMBO_FADE_DURATION);
        }
        else if (comboCount == 0 && _isComboTrackPlaying)
        {
            // 콤보 종료: 2초 후 BGM_02 복귀
            if (_comboEndCoroutine != null)
                StopCoroutine(_comboEndCoroutine);
            _comboEndCoroutine = StartCoroutine(ComboEndDelayCoroutine());
        }
    }

    private IEnumerator ComboEndDelayCoroutine()
    {
        yield return new WaitForSeconds(COMBO_END_DELAY);

        _isComboTrackPlaying = false;
        var normalTrack = _database.GetTrack(BGMTrackID.BGM_02_ChillMerge);
        if (normalTrack != null)
            StartCrossfade(normalTrack, CROSSFADE_DURATION);

        _comboEndCoroutine = null;
    }
    ```
  - **예상 난이도:** 중
  - **의존성:** `BGMManager` 크로스페이드 시스템, 콤보 시스템 이벤트

---

## 3. SFX 매니저 구현

### 3.1 SFX 클립 데이터 정의

- [ ] **SFXClipData ScriptableObject 생성**
  - **구현 설명:** 설계서의 15종 효과음 각각에 대해 ID, 파일 참조, 기본 볼륨, 피치 변조 설정, 우선순위를 ScriptableObject로 정의한다.
  - **클래스/메서드:**
    - `SFXClipData : ScriptableObject`
    - `SFXClipDatabase : ScriptableObject`
    - `SFXPriority` enum
    - `PitchModulationType` enum
  - **코드 스니펫:**
    ```csharp
    using UnityEngine;
    using UnityEngine.AddressableAssets;

    namespace HexaMerge.Audio.Data
    {
        public enum SFXClipID
        {
            SFX_01_TapSelect,       // 블록 탭
            SFX_02_TapDeselect,     // 선택 해제
            SFX_03_Merge,           // 머지 성공
            SFX_04_MatchFail,       // 매칭 실패
            SFX_05_WaveWhoosh,      // 파도 등장
            SFX_06_Combo2,          // 콤보 x2
            SFX_07_Combo3,          // 콤보 x3
            SFX_08_Combo4,          // 콤보 x4
            SFX_09_ComboMax,        // 콤보 x5+
            SFX_10_ScoreTick,       // 점수 카운트
            SFX_11_NewRecord,       // 최고 점수 갱신
            SFX_12_ButtonClick,     // 버튼 클릭
            SFX_13_Transition,      // 화면 전환
            SFX_14_ItemUse,         // 아이템 사용
            SFX_15_Purchase         // 구매 완료
        }

        public enum SFXPriority
        {
            Low = 0,      // 낮음: score_tick, transition
            Medium = 64,  // 중간: deselect, match_fail, button_click
            High = 128,   // 높음: tap_select, merge, combo2~4, item_use
            Highest = 255 // 최고: combo_max, new_record, purchase
        }

        public enum PitchModulationType
        {
            Fixed,            // 고정 피치 (1.0)
            RandomRange,      // 랜덤 범위 (예: 0.95~1.05)
            Sequential,       // 순차 증가 (예: 0.8~1.2)
            MergeValueBased   // 머지 숫자 기반 (설계서 피치 테이블)
        }

        [CreateAssetMenu(fileName = "SFXClipData", menuName = "HexaMerge/Audio/SFX Clip Data")]
        public class SFXClipData : ScriptableObject
        {
            public SFXClipID clipID;
            public string clipName;
            public AssetReferenceT<AudioClip> clipReference;

            [Header("볼륨 설정")]
            [Range(0f, 1f)] public float baseVolume = 1f;

            [Header("피치 변조 설정")]
            public PitchModulationType pitchType = PitchModulationType.Fixed;
            public float pitchMin = 1f;
            public float pitchMax = 1f;

            [Header("우선순위")]
            public SFXPriority priority = SFXPriority.Medium;
        }

        [CreateAssetMenu(fileName = "SFXClipDatabase", menuName = "HexaMerge/Audio/SFX Clip Database")]
        public class SFXClipDatabase : ScriptableObject
        {
            public SFXClipData[] clips;

            public SFXClipData GetClip(SFXClipID id)
            {
                foreach (var clip in clips)
                {
                    if (clip.clipID == id) return clip;
                }
                Debug.LogWarning($"[SFXClipDatabase] 클립을 찾을 수 없음: {id}");
                return null;
            }
        }
    }
    ```
  - **예상 난이도:** 하
  - **의존성:** Addressables 패키지

---

### 3.2 SFXManager 코어 및 풀링 시스템

- [ ] **SFXManager 오디오 소스 풀링 구현**
  - **구현 설명:** 설계서에서 동시 재생 최대 8채널로 정의된 SFX 풀링 시스템을 구현한다. 8개의 AudioSource를 미리 생성하고, 재생 요청 시 유휴 소스를 할당한다. 모든 소스가 사용 중이면 가장 낮은 우선순위 소스를 강탈(preempt)한다.
  - **클래스/메서드:**
    - `SFXManager`
    - `Init(SFXClipDatabase database)` - 초기화 및 풀 생성
    - `Play(SFXClipID clipID, float pitchOverride = -1f)` - SFX 재생
    - `GetAvailableSource(SFXPriority priority)` - 유휴 소스 탐색 또는 우선순위 강탈
    - `ReturnSource(AudioSource source)` - 소스 반환
  - **코드 스니펫:**
    ```csharp
    using System.Collections.Generic;
    using UnityEngine;

    namespace HexaMerge.Audio
    {
        public class SFXManager : MonoBehaviour
        {
            private const int POOL_SIZE = 8; // 설계서: 동시 재생 최대 8채널

            private SFXClipDatabase _database;
            private AudioSource[] _pool;
            private SFXPriority[] _poolPriorities;
            private float[] _poolEndTimes;

            private float _volumeMultiplier = 1f;

            // 로드된 AudioClip 캐시 (Addressables 로드 후 저장)
            private readonly Dictionary<SFXClipID, AudioClip> _clipCache = new();

            public void Init(SFXClipDatabase database)
            {
                _database = database;
                _pool = new AudioSource[POOL_SIZE];
                _poolPriorities = new SFXPriority[POOL_SIZE];
                _poolEndTimes = new float[POOL_SIZE];

                for (int i = 0; i < POOL_SIZE; i++)
                {
                    var go = new GameObject($"SFX_Source_{i}");
                    go.transform.SetParent(transform);
                    _pool[i] = go.AddComponent<AudioSource>();
                    _pool[i].playOnAwake = false;
                    _pool[i].spatialBlend = 0f; // 2D
                    _poolPriorities[i] = SFXPriority.Low;
                    _poolEndTimes[i] = 0f;
                }
            }

            public void Play(SFXClipID clipID, float pitchOverride = -1f)
            {
                var clipData = _database.GetClip(clipID);
                if (clipData == null) return;

                if (!_clipCache.TryGetValue(clipID, out var audioClip))
                {
                    // 캐시에 없으면 비동기 로드 후 재생
                    LoadAndPlay(clipData, pitchOverride);
                    return;
                }

                PlayInternal(audioClip, clipData, pitchOverride);
            }

            private async void LoadAndPlay(SFXClipData clipData, float pitchOverride)
            {
                var clip = await AudioAddressableLoader.LoadClipAsync(clipData.clipReference);
                if (clip == null) return;

                _clipCache[clipData.clipID] = clip;
                PlayInternal(clip, clipData, pitchOverride);
            }

            private void PlayInternal(AudioClip clip, SFXClipData clipData, float pitchOverride)
            {
                var source = GetAvailableSource(clipData.priority);
                if (source == null) return; // 재생 불가 (모두 더 높은 우선순위)

                int index = System.Array.IndexOf(_pool, source);
                _poolPriorities[index] = clipData.priority;
                _poolEndTimes[index] = Time.time + clip.length;

                source.clip = clip;
                source.volume = clipData.baseVolume * _volumeMultiplier;
                source.pitch = pitchOverride > 0f
                    ? pitchOverride
                    : PitchModulator.GetPitch(clipData);
                source.Play();
            }

            private AudioSource GetAvailableSource(SFXPriority requestPriority)
            {
                // 1단계: 유휴 소스 탐색
                for (int i = 0; i < POOL_SIZE; i++)
                {
                    if (!_pool[i].isPlaying)
                        return _pool[i];
                }

                // 2단계: 가장 낮은 우선순위 소스 강탈
                int lowestIndex = -1;
                SFXPriority lowestPriority = requestPriority;

                for (int i = 0; i < POOL_SIZE; i++)
                {
                    if (_poolPriorities[i] < lowestPriority)
                    {
                        lowestPriority = _poolPriorities[i];
                        lowestIndex = i;
                    }
                    else if (_poolPriorities[i] == lowestPriority && lowestIndex >= 0)
                    {
                        // 같은 우선순위면 가장 오래된 것 선택
                        if (_poolEndTimes[i] < _poolEndTimes[lowestIndex])
                            lowestIndex = i;
                    }
                }

                if (lowestIndex >= 0)
                {
                    _pool[lowestIndex].Stop();
                    return _pool[lowestIndex];
                }

                return null; // 강탈 불가
            }

            public void SetVolume(float volume)
            {
                _volumeMultiplier = volume;
            }

            public void StopAll()
            {
                foreach (var source in _pool)
                    source.Stop();
            }
        }
    }
    ```
  - **예상 난이도:** 중
  - **의존성:** `SFXClipDatabase`, `PitchModulator`, `AudioAddressableLoader`

---

### 3.3 피치 변조 시스템

- [ ] **PitchModulator 구현 (랜덤/순차/머지 기반)**
  - **구현 설명:** 설계서에 정의된 다양한 피치 변조 유형을 처리한다. (1) 랜덤 범위: 탭 사운드의 반복감 방지용 0.95~1.05 랜덤, (2) 순차 증가: 파도 등장 시 0.8~1.2 순차, 점수 카운트 시 1.0~1.5 순차, (3) 머지 숫자 기반: 숫자 크기에 비례하여 1.0~1.4 피치 상승.
  - **클래스/메서드:**
    - `PitchModulator` (static 클래스)
    - `GetPitch(SFXClipData clipData)` - 변조 타입에 따른 피치 반환
    - `GetMergePitch(int fromValue, int toValue)` - 머지 숫자 기반 피치 계산
    - `GetSequentialPitch(SFXClipData clipData)` - 순차 피치 반환
  - **코드 스니펫:**
    ```csharp
    using System.Collections.Generic;
    using UnityEngine;

    namespace HexaMerge.Audio
    {
        /// <summary>
        /// 설계서 5.2절 피치 변조 규칙 구현
        /// </summary>
        public static class PitchModulator
        {
            // 순차 피치용 인덱스 추적
            private static readonly Dictionary<SFXClipID, int> _sequentialIndex = new();

            /// <summary>
            /// 설계서 피치 변조 테이블 (SFX_03 머지 사운드)
            /// 숫자 -> 피치 배수 매핑
            /// </summary>
            private static readonly (int threshold, float pitch)[] MergePitchTable =
            {
                (4,   1.00f),  // 2->4:   기본음
                (8,   1.05f),  // 4->8:   약간 높음
                (16,  1.10f),  // 8->16:  높음
                (32,  1.15f),  // 16->32: 더 높음
                (64,  1.20f),  // 32->64: 상쾌함
                (128, 1.25f),  // 64->128: 밝음
                (256, 1.30f),  // 128->256: 화려함
                (512, 1.35f),  // 256->512: 최고조
            };

            private const float MERGE_PITCH_MAX = 1.4f; // 512+: 클라이맥스

            public static float GetPitch(SFXClipData clipData)
            {
                switch (clipData.pitchType)
                {
                    case PitchModulationType.Fixed:
                        return clipData.pitchMin; // 고정값 (보통 1.0)

                    case PitchModulationType.RandomRange:
                        return Random.Range(clipData.pitchMin, clipData.pitchMax);

                    case PitchModulationType.Sequential:
                        return GetSequentialPitch(clipData);

                    case PitchModulationType.MergeValueBased:
                        return clipData.pitchMin; // 기본값, 실제로는 GetMergePitch() 사용

                    default:
                        return 1f;
                }
            }

            /// <summary>
            /// 머지 결과 숫자에 따른 피치 반환.
            /// 설계서 테이블: 2->4(1.0), 4->8(1.05), ... 512+(1.4)
            /// </summary>
            public static float GetMergePitch(int resultValue)
            {
                foreach (var (threshold, pitch) in MergePitchTable)
                {
                    if (resultValue <= threshold)
                        return pitch;
                }
                return MERGE_PITCH_MAX;
            }

            /// <summary>
            /// 순차 피치: 호출할 때마다 pitchMin~pitchMax 사이를 단계적으로 이동.
            /// 예) wave_whoosh: 0.8 -> 0.88 -> 0.96 -> 1.04 -> 1.12 -> 1.2 -> 0.8 (순환)
            ///     score_tick: 1.0 -> 1.1 -> 1.2 -> 1.3 -> 1.4 -> 1.5 -> 1.0 (순환)
            /// </summary>
            private static float GetSequentialPitch(SFXClipData clipData)
            {
                const int STEPS = 6; // 순차 단계 수

                if (!_sequentialIndex.ContainsKey(clipData.clipID))
                    _sequentialIndex[clipData.clipID] = 0;

                int index = _sequentialIndex[clipData.clipID];
                float t = (float)index / (STEPS - 1);
                float pitch = Mathf.Lerp(clipData.pitchMin, clipData.pitchMax, t);

                _sequentialIndex[clipData.clipID] = (index + 1) % STEPS;

                return pitch;
            }

            /// <summary>
            /// 순차 피치 인덱스 리셋 (웨이브 시작 등에서 호출)
            /// </summary>
            public static void ResetSequentialPitch(SFXClipID clipID)
            {
                _sequentialIndex[clipID] = 0;
            }
        }
    }
    ```
  - **예상 난이도:** 중
  - **의존성:** `SFXClipData`

---

### 3.4 머지 SFX 전용 재생 메서드

- [ ] **머지 숫자 기반 피치 변조 SFX 재생 구현**
  - **구현 설명:** SFXManager에 머지 결과 숫자를 인자로 받아 설계서의 피치 테이블에 따라 자동으로 피치가 조절된 머지 사운드를 재생하는 전용 메서드를 추가한다.
  - **클래스/메서드:**
    - `SFXManager.PlayMerge(int resultValue)`
  - **코드 스니펫:**
    ```csharp
    // SFXManager 클래스 내부에 추가

    /// <summary>
    /// 머지 사운드 전용 재생.
    /// 설계서: "merge.wav" 피치는 숫자 크기에 비례하여 상승
    /// 예) 2->4: pitch 1.0, 256->512: pitch 1.35, 512+: pitch 1.4
    /// </summary>
    public void PlayMerge(int resultValue)
    {
        float pitch = PitchModulator.GetMergePitch(resultValue);
        Play(SFXClipID.SFX_03_Merge, pitch);
    }

    /// <summary>
    /// 콤보 사운드 재생. 콤보 카운트에 따라 적절한 클립을 선택한다.
    /// 설계서: x2->combo_2, x3->combo_3, x4->combo_4, x5+->combo_max
    /// </summary>
    public void PlayCombo(int comboCount)
    {
        SFXClipID clipID = comboCount switch
        {
            2 => SFXClipID.SFX_06_Combo2,
            3 => SFXClipID.SFX_07_Combo3,
            4 => SFXClipID.SFX_08_Combo4,
            _ when comboCount >= 5 => SFXClipID.SFX_09_ComboMax,
            _ => SFXClipID.SFX_06_Combo2
        };

        Play(clipID);
    }
    ```
  - **예상 난이도:** 하
  - **의존성:** `SFXManager` 코어, `PitchModulator`

---

## 4. 볼륨 설정 시스템

### 4.1 VolumeController 구현

- [ ] **VolumeController 구현 (AudioMixer 연동)**
  - **구현 설명:** 설계서의 볼륨 설정 구조를 구현한다. Master, BGM, SFX 3개 채널의 볼륨을 AudioMixer를 통해 제어하며, 실제 재생 볼륨은 `masterVolume x 개별볼륨 x trackBaseVolume` 공식으로 계산한다. 음소거 토글도 지원한다.
  - **클래스/메서드:**
    - `VolumeController`
    - `Init(AudioMixer mixer)` - 초기화
    - `SetMasterVolume(float value)` - 마스터 볼륨 설정
    - `SetBGMVolume(float value)` - BGM 볼륨 설정
    - `SetSFXVolume(float value)` - SFX 볼륨 설정
    - `ToggleMute()` - 음소거 토글
    - `LoadSettings()` - PlayerPrefs에서 로드
    - `SaveSettings()` - PlayerPrefs에 저장
  - **코드 스니펫:**
    ```csharp
    using UnityEngine;
    using UnityEngine.Audio;

    namespace HexaMerge.Audio
    {
        /// <summary>
        /// 설계서 5.3절 사운드 볼륨 설정 구현.
        /// 실제 BGM 볼륨 = masterVolume x bgmVolume x trackBaseVolume
        /// 실제 SFX 볼륨 = masterVolume x sfxVolume x clipBaseVolume x priorityFactor
        /// </summary>
        public class VolumeController
        {
            // PlayerPrefs 키
            private const string KEY_MASTER = "Audio_MasterVolume";
            private const string KEY_BGM    = "Audio_BGMVolume";
            private const string KEY_SFX    = "Audio_SFXVolume";
            private const string KEY_MUTE   = "Audio_Mute";

            // AudioMixer 파라미터명 (AudioMixer 에디터에서 Expose 필요)
            private const string MIXER_MASTER = "MasterVolume";
            private const string MIXER_BGM    = "BGMVolume";
            private const string MIXER_SFX    = "SFXVolume";

            // 설계서 기본값
            private const float DEFAULT_MASTER = 1.0f;   // 100%
            private const float DEFAULT_BGM    = 0.7f;   // 70%
            private const float DEFAULT_SFX    = 1.0f;   // 100%

            private AudioMixer _mixer;
            private float _masterVolume;
            private float _bgmVolume;
            private float _sfxVolume;
            private bool _isMuted;

            // 외부 참조용 프로퍼티
            public float MasterVolume => _masterVolume;
            public float BGMVolume => _bgmVolume;
            public float SFXVolume => _sfxVolume;
            public bool IsMuted => _isMuted;

            public event System.Action<float> OnMasterVolumeChanged;
            public event System.Action<float> OnBGMVolumeChanged;
            public event System.Action<float> OnSFXVolumeChanged;
            public event System.Action<bool>  OnMuteChanged;

            public void Init(AudioMixer mixer)
            {
                _mixer = mixer;
                LoadSettings();
                ApplyAllVolumes();
            }

            public void SetMasterVolume(float value)
            {
                _masterVolume = Mathf.Clamp01(value);
                ApplyMixerVolume(MIXER_MASTER, _isMuted ? 0f : _masterVolume);
                OnMasterVolumeChanged?.Invoke(_masterVolume);
                SaveSettings();
            }

            public void SetBGMVolume(float value)
            {
                _bgmVolume = Mathf.Clamp01(value);
                ApplyMixerVolume(MIXER_BGM, _bgmVolume);
                OnBGMVolumeChanged?.Invoke(_bgmVolume);
                SaveSettings();
            }

            public void SetSFXVolume(float value)
            {
                _sfxVolume = Mathf.Clamp01(value);
                ApplyMixerVolume(MIXER_SFX, _sfxVolume);
                OnSFXVolumeChanged?.Invoke(_sfxVolume);
                SaveSettings();
            }

            public void ToggleMute()
            {
                _isMuted = !_isMuted;
                ApplyAllVolumes();
                OnMuteChanged?.Invoke(_isMuted);
                SaveSettings();
            }

            public void SetMute(bool muted)
            {
                if (_isMuted == muted) return;
                _isMuted = muted;
                ApplyAllVolumes();
                OnMuteChanged?.Invoke(_isMuted);
                SaveSettings();
            }

            private void ApplyAllVolumes()
            {
                float master = _isMuted ? 0f : _masterVolume;
                ApplyMixerVolume(MIXER_MASTER, master);
                ApplyMixerVolume(MIXER_BGM, _bgmVolume);
                ApplyMixerVolume(MIXER_SFX, _sfxVolume);
            }

            /// <summary>
            /// 선형 볼륨(0~1)을 데시벨(-80~0)로 변환하여 AudioMixer에 적용
            /// </summary>
            private void ApplyMixerVolume(string parameter, float linearVolume)
            {
                // 0이면 -80dB (사실상 무음), 그 외 로그 변환
                float dB = linearVolume > 0.0001f
                    ? Mathf.Log10(linearVolume) * 20f
                    : -80f;
                _mixer.SetFloat(parameter, dB);
            }

            private void LoadSettings()
            {
                _masterVolume = PlayerPrefs.GetFloat(KEY_MASTER, DEFAULT_MASTER);
                _bgmVolume    = PlayerPrefs.GetFloat(KEY_BGM,    DEFAULT_BGM);
                _sfxVolume    = PlayerPrefs.GetFloat(KEY_SFX,    DEFAULT_SFX);
                _isMuted      = PlayerPrefs.GetInt(KEY_MUTE, 0) == 1;
            }

            private void SaveSettings()
            {
                PlayerPrefs.SetFloat(KEY_MASTER, _masterVolume);
                PlayerPrefs.SetFloat(KEY_BGM,    _bgmVolume);
                PlayerPrefs.SetFloat(KEY_SFX,    _sfxVolume);
                PlayerPrefs.SetInt(KEY_MUTE,     _isMuted ? 1 : 0);
                PlayerPrefs.Save();
            }
        }
    }
    ```
  - **예상 난이도:** 중
  - **의존성:** Unity AudioMixer (에디터에서 Master/BGM/SFX 그룹 생성 및 파라미터 Expose 필요)

---

### 4.2 AudioMixer 설정 가이드

- [ ] **AudioMixer 에셋 구성**
  - **구현 설명:** Unity 에디터에서 AudioMixer를 생성하고, Master/BGM/SFX 3개 그룹을 구성한다. 각 그룹의 Volume 파라미터를 Expose하여 스크립트에서 제어 가능하게 한다.
  - **설정 단계:**
    1. `Assets/Audio/Mixers/MainAudioMixer.mixer` 생성
    2. Master 그룹 하위에 BGM, SFX 그룹 추가
    3. 각 그룹의 Volume 파라미터 우클릭 -> "Expose to Script"
    4. 파라미터명: `MasterVolume`, `BGMVolume`, `SFXVolume`
  - **Mixer 구조:**
    ```
    MainAudioMixer
    └── Master (Exposed: "MasterVolume")
        ├── BGM (Exposed: "BGMVolume")
        └── SFX (Exposed: "SFXVolume")
    ```
  - **예상 난이도:** 하
  - **의존성:** 없음 (에디터 작업)

---

### 4.3 설정 UI 연동

- [ ] **볼륨 슬라이더 UI 바인딩 구현**
  - **구현 설명:** 설정 화면의 마스터/BGM/SFX 볼륨 슬라이더와 음소거 토글을 VolumeController에 연결한다. 슬라이더 값 변경 시 실시간으로 볼륨이 반영되며, 화면 진입 시 저장된 값을 복원한다.
  - **클래스/메서드:**
    - `VolumeSettingsUI : MonoBehaviour`
    - `Init(VolumeController controller)` - VolumeController 바인딩
    - `OnMasterSliderChanged(float value)` - 슬라이더 콜백
    - `OnBGMSliderChanged(float value)` - 슬라이더 콜백
    - `OnSFXSliderChanged(float value)` - 슬라이더 콜백
    - `OnMuteToggleChanged(bool value)` - 토글 콜백
  - **코드 스니펫:**
    ```csharp
    using UnityEngine;
    using UnityEngine.UI;
    using TMPro;

    namespace HexaMerge.Audio.UI
    {
        public class VolumeSettingsUI : MonoBehaviour
        {
            [Header("슬라이더")]
            [SerializeField] private Slider _masterSlider;
            [SerializeField] private Slider _bgmSlider;
            [SerializeField] private Slider _sfxSlider;

            [Header("퍼센트 텍스트")]
            [SerializeField] private TextMeshProUGUI _masterText;
            [SerializeField] private TextMeshProUGUI _bgmText;
            [SerializeField] private TextMeshProUGUI _sfxText;

            [Header("음소거 토글")]
            [SerializeField] private Toggle _muteToggle;

            private VolumeController _controller;

            public void Init(VolumeController controller)
            {
                _controller = controller;

                // 저장된 값 복원
                _masterSlider.value = controller.MasterVolume;
                _bgmSlider.value = controller.BGMVolume;
                _sfxSlider.value = controller.SFXVolume;
                _muteToggle.isOn = controller.IsMuted;

                UpdateTexts();

                // 리스너 등록
                _masterSlider.onValueChanged.AddListener(OnMasterSliderChanged);
                _bgmSlider.onValueChanged.AddListener(OnBGMSliderChanged);
                _sfxSlider.onValueChanged.AddListener(OnSFXSliderChanged);
                _muteToggle.onValueChanged.AddListener(OnMuteToggleChanged);
            }

            private void OnMasterSliderChanged(float value)
            {
                _controller.SetMasterVolume(value);
                UpdateTexts();
            }

            private void OnBGMSliderChanged(float value)
            {
                _controller.SetBGMVolume(value);
                UpdateTexts();
            }

            private void OnSFXSliderChanged(float value)
            {
                _controller.SetSFXVolume(value);
                UpdateTexts();
            }

            private void OnMuteToggleChanged(bool isMuted)
            {
                _controller.SetMute(isMuted);
            }

            private void UpdateTexts()
            {
                _masterText.text = $"{Mathf.RoundToInt(_masterSlider.value * 100)}%";
                _bgmText.text = $"{Mathf.RoundToInt(_bgmSlider.value * 100)}%";
                _sfxText.text = $"{Mathf.RoundToInt(_sfxSlider.value * 100)}%";
            }

            private void OnDestroy()
            {
                _masterSlider.onValueChanged.RemoveListener(OnMasterSliderChanged);
                _bgmSlider.onValueChanged.RemoveListener(OnBGMSliderChanged);
                _sfxSlider.onValueChanged.RemoveListener(OnSFXSliderChanged);
                _muteToggle.onValueChanged.RemoveListener(OnMuteToggleChanged);
            }
        }
    }
    ```
  - **예상 난이도:** 하
  - **의존성:** `VolumeController`, UI 레이아웃 (설정 화면)

---

## 5. 햅틱 피드백 시스템

### 5.1 HapticManager 및 플랫폼 추상화

- [ ] **IHapticProvider 인터페이스 및 HapticManager 구현**
  - **구현 설명:** 설계서 5.4절의 플랫폼별 햅틱 피드백을 추상화한다. iOS(UIImpactFeedbackGenerator), Android(Vibrator), WebGL(Navigator.vibrate) 각각에 대한 Provider를 구현하고, HapticManager가 런타임 플랫폼에 따라 적절한 Provider를 선택한다.
  - **클래스/메서드:**
    - `IHapticProvider` (인터페이스)
    - `HapticManager : MonoBehaviour` (싱글톤)
    - `HapticType` enum (Light, Medium, Heavy, Double, Error, Success, Selection)
    - `Trigger(HapticType type)` - 햅틱 실행
    - `SetEnabled(bool enabled)` - 햅틱 ON/OFF
  - **코드 스니펫:**
    ```csharp
    using UnityEngine;

    namespace HexaMerge.Audio
    {
        /// <summary>
        /// 설계서 5.4절 햅틱 피드백 이벤트 유형.
        /// iOS/Android/WebGL 각각 다른 구현을 매핑한다.
        /// </summary>
        public enum HapticType
        {
            Light,      // 블록 탭: iOS Light Impact / Android 10ms
            Medium,     // 머지 성공: iOS Medium Impact / Android 30ms
            Heavy,      // 콤보 x3+: iOS Heavy Impact / Android 50ms
            Double,     // 콤보 x5+: iOS Heavy x2(100ms간격) / Android 50-50-50ms
            Error,      // 매칭 실패: iOS Notification Error / Android 20-40-20ms
            Success,    // 최고점수 갱신: iOS Notification Success / Android 100ms
            Selection   // 버튼 클릭: iOS Selection / Android 5ms
        }

        public interface IHapticProvider
        {
            void Trigger(HapticType type);
            bool IsSupported { get; }
        }

        public class HapticManager : MonoBehaviour
        {
            private IHapticProvider _provider;
            private bool _isEnabled = true;

            private const string KEY_HAPTIC = "Audio_HapticEnabled";

            public bool IsEnabled => _isEnabled;

            public void Init()
            {
                _isEnabled = PlayerPrefs.GetInt(KEY_HAPTIC, 1) == 1;

#if UNITY_IOS && !UNITY_EDITOR
                _provider = new IOSHapticProvider();
#elif UNITY_ANDROID && !UNITY_EDITOR
                _provider = new AndroidHapticProvider();
#elif UNITY_WEBGL && !UNITY_EDITOR
                _provider = new WebGLHapticProvider();
#else
                _provider = new DummyHapticProvider();
#endif

                Debug.Log($"[HapticManager] Provider: {_provider.GetType().Name}, " +
                          $"Supported: {_provider.IsSupported}");
            }

            public void Trigger(HapticType type)
            {
                if (!_isEnabled || _provider == null || !_provider.IsSupported)
                    return;

                _provider.Trigger(type);
            }

            public void SetEnabled(bool enabled)
            {
                _isEnabled = enabled;
                PlayerPrefs.SetInt(KEY_HAPTIC, enabled ? 1 : 0);
                PlayerPrefs.Save();
            }

            // 게임 이벤트 헬퍼 메서드
            public void OnBlockTap()       => Trigger(HapticType.Light);
            public void OnMergeSuccess()   => Trigger(HapticType.Medium);
            public void OnCombo(int count)
            {
                if (count >= 5)      Trigger(HapticType.Double);
                else if (count >= 3) Trigger(HapticType.Heavy);
            }
            public void OnMatchFail()      => Trigger(HapticType.Error);
            public void OnNewRecord()      => Trigger(HapticType.Success);
            public void OnButtonClick()    => Trigger(HapticType.Selection);
        }

        /// <summary>에디터/미지원 플랫폼용 더미 구현</summary>
        public class DummyHapticProvider : IHapticProvider
        {
            public bool IsSupported => false;
            public void Trigger(HapticType type)
            {
                Debug.Log($"[Haptic:Dummy] {type}");
            }
        }
    }
    ```
  - **예상 난이도:** 중
  - **의존성:** 없음 (플랫폼별 네이티브 플러그인은 각 Provider에서 처리)

---

### 5.2 iOS 햅틱 Provider

- [ ] **IOSHapticProvider 구현**
  - **구현 설명:** iOS의 UIImpactFeedbackGenerator, UINotificationFeedbackGenerator, UISelectionFeedbackGenerator를 네이티브 플러그인을 통해 호출한다. 설계서의 iOS 컬럼(Light Impact, Medium Impact, Heavy Impact, Notification Error/Success, Selection)을 정확히 매핑한다.
  - **클래스/메서드:**
    - `IOSHapticProvider : IHapticProvider`
    - 네이티브 브릿지: `_WZHapticLight()`, `_WZHapticMedium()`, `_WZHapticHeavy()`, `_WZHapticError()`, `_WZHapticSuccess()`, `_WZHapticSelection()`
  - **코드 스니펫:**
    ```csharp
    #if UNITY_IOS
    using System.Runtime.InteropServices;
    using UnityEngine;

    namespace HexaMerge.Audio
    {
        public class IOSHapticProvider : IHapticProvider
        {
            // Objective-C 네이티브 플러그인 브릿지
            [DllImport("__Internal")] private static extern void _WZHapticLight();
            [DllImport("__Internal")] private static extern void _WZHapticMedium();
            [DllImport("__Internal")] private static extern void _WZHapticHeavy();
            [DllImport("__Internal")] private static extern void _WZHapticError();
            [DllImport("__Internal")] private static extern void _WZHapticSuccess();
            [DllImport("__Internal")] private static extern void _WZHapticSelection();
            [DllImport("__Internal")] private static extern bool _WZHapticIsSupported();

            public bool IsSupported => _WZHapticIsSupported();

            public void Trigger(HapticType type)
            {
                switch (type)
                {
                    case HapticType.Light:
                        _WZHapticLight();
                        break;
                    case HapticType.Medium:
                        _WZHapticMedium();
                        break;
                    case HapticType.Heavy:
                        _WZHapticHeavy();
                        break;
                    case HapticType.Double:
                        // 설계서: Heavy Impact x2 (100ms 간격)
                        _WZHapticHeavy();
                        DoubleHapticAsync();
                        break;
                    case HapticType.Error:
                        _WZHapticError();
                        break;
                    case HapticType.Success:
                        _WZHapticSuccess();
                        break;
                    case HapticType.Selection:
                        _WZHapticSelection();
                        break;
                }
            }

            private async void DoubleHapticAsync()
            {
                await System.Threading.Tasks.Task.Delay(100);
                _WZHapticHeavy();
            }
        }
    }
    #endif
    ```
  - **예상 난이도:** 중
  - **의존성:** iOS 네이티브 플러그인 (.mm 파일) 작성 필요

---

### 5.3 Android 햅틱 Provider

- [ ] **AndroidHapticProvider 구현**
  - **구현 설명:** Android의 Vibrator 서비스를 JNI를 통해 호출한다. 설계서의 Android 컬럼(10ms, 30ms, 50ms, 패턴 50-50-50ms, 패턴 20-40-20ms, 100ms, 5ms)을 정확히 매핑한다.
  - **클래스/메서드:**
    - `AndroidHapticProvider : IHapticProvider`
    - `Vibrate(long milliseconds)` - 단일 진동
    - `VibratePattern(long[] pattern)` - 패턴 진동
  - **코드 스니펫:**
    ```csharp
    #if UNITY_ANDROID
    using UnityEngine;

    namespace HexaMerge.Audio
    {
        public class AndroidHapticProvider : IHapticProvider
        {
            private AndroidJavaObject _vibrator;

            public bool IsSupported => _vibrator != null;

            public AndroidHapticProvider()
            {
                try
                {
                    using var unityPlayer = new AndroidJavaClass("com.unity3d.player.UnityPlayer");
                    using var activity = unityPlayer.GetStatic<AndroidJavaObject>("currentActivity");
                    _vibrator = activity.Call<AndroidJavaObject>(
                        "getSystemService", "vibrator");
                }
                catch (System.Exception e)
                {
                    Debug.LogWarning($"[AndroidHaptic] Vibrator 초기화 실패: {e.Message}");
                    _vibrator = null;
                }
            }

            public void Trigger(HapticType type)
            {
                switch (type)
                {
                    case HapticType.Light:      // 블록 탭: 10ms
                        Vibrate(10);
                        break;
                    case HapticType.Medium:      // 머지 성공: 30ms
                        Vibrate(30);
                        break;
                    case HapticType.Heavy:       // 콤보 x3+: 50ms
                        Vibrate(50);
                        break;
                    case HapticType.Double:      // 콤보 x5+: 패턴 50ms-50ms-50ms
                        VibratePattern(new long[] { 0, 50, 50, 50, 50, 50 });
                        break;
                    case HapticType.Error:       // 매칭 실패: 패턴 20ms-40ms-20ms
                        VibratePattern(new long[] { 0, 20, 40, 20 });
                        break;
                    case HapticType.Success:     // 최고점수 갱신: 100ms
                        Vibrate(100);
                        break;
                    case HapticType.Selection:   // 버튼 클릭: 5ms
                        Vibrate(5);
                        break;
                }
            }

            private void Vibrate(long milliseconds)
            {
                _vibrator?.Call("vibrate", milliseconds);
            }

            private void VibratePattern(long[] pattern)
            {
                // 두 번째 인자 -1: 반복 없음
                _vibrator?.Call("vibrate", pattern, -1);
            }
        }
    }
    #endif
    ```
  - **예상 난이도:** 중
  - **의존성:** Android Manifest에 `<uses-permission android:name="android.permission.VIBRATE"/>` 추가

---

### 5.4 WebGL 햅틱 Provider

- [ ] **WebGLHapticProvider 구현 (Navigator.vibrate 폴백)**
  - **구현 설명:** 설계서의 WebGL 환경 요구사항에 따라 Navigator.vibrate() API를 사용한다. 지원하지 않는 브라우저에서는 시각적 피드백으로 대체하기 위한 콜백 이벤트를 발행한다.
  - **클래스/메서드:**
    - `WebGLHapticProvider : IHapticProvider`
    - JavaScript 플러그인: `WebGLVibrate(int ms)`, `WebGLVibratePattern(int[] pattern)`
  - **코드 스니펫:**
    ```csharp
    #if UNITY_WEBGL
    using System.Runtime.InteropServices;
    using UnityEngine;

    namespace HexaMerge.Audio
    {
        public class WebGLHapticProvider : IHapticProvider
        {
            [DllImport("__Internal")] private static extern bool _WZVibrateSupported();
            [DllImport("__Internal")] private static extern void _WZVibrate(int milliseconds);
            [DllImport("__Internal")] private static extern void _WZVibratePattern(int[] pattern, int length);

            public bool IsSupported => _WZVibrateSupported();

            /// <summary>
            /// 시각적 폴백 필요 시 발행되는 이벤트.
            /// 설계서: "미지원 시 시각적 피드백으로 대체 (화면 미세 흔들림)"
            /// </summary>
            public static event System.Action<HapticType> OnVisualFallbackNeeded;

            public void Trigger(HapticType type)
            {
                if (!IsSupported)
                {
                    OnVisualFallbackNeeded?.Invoke(type);
                    return;
                }

                switch (type)
                {
                    case HapticType.Light:
                        _WZVibrate(10);
                        break;
                    case HapticType.Medium:
                        _WZVibrate(30);
                        break;
                    case HapticType.Heavy:
                        _WZVibrate(50);
                        break;
                    case HapticType.Double:
                        var doublePattern = new int[] { 50, 50, 50, 50, 50 };
                        _WZVibratePattern(doublePattern, doublePattern.Length);
                        break;
                    case HapticType.Error:
                        var errorPattern = new int[] { 20, 40, 20 };
                        _WZVibratePattern(errorPattern, errorPattern.Length);
                        break;
                    case HapticType.Success:
                        _WZVibrate(100);
                        break;
                    case HapticType.Selection:
                        _WZVibrate(5);
                        break;
                }
            }
        }
    }
    #endif
    ```

  - **JavaScript 플러그인 파일** (`Assets/Plugins/WebGL/HapticPlugin.jslib`):
    ```javascript
    // HapticPlugin.jslib
    mergeInto(LibraryManager.library, {
        _WZVibrateSupported: function() {
            return 'vibrate' in navigator;
        },
        _WZVibrate: function(ms) {
            if ('vibrate' in navigator) navigator.vibrate(ms);
        },
        _WZVibratePattern: function(patternPtr, length) {
            if (!('vibrate' in navigator)) return;
            var pattern = [];
            for (var i = 0; i < length; i++) {
                pattern.push(HEAP32[(patternPtr >> 2) + i]);
            }
            navigator.vibrate(pattern);
        }
    });
    ```
  - **예상 난이도:** 중
  - **의존성:** WebGL 빌드 환경, jslib 플러그인 파일

---

## 6. 오디오 리소스 관리 (Addressables)

### 6.1 AudioAddressableLoader 구현

- [ ] **Addressables 기반 오디오 클립 비동기 로드/해제 시스템 구현**
  - **구현 설명:** 오디오 클립을 Addressables를 통해 비동기로 로드하고, 참조 카운트 기반으로 메모리를 관리한다. BGM은 씬 전환 시 이전 트랙을 해제하고, SFX는 첫 사용 시 로드 후 캐시한다. 플랫폼별 오디오 포맷(WebGL: OGG, 에디터: WAV)도 고려한다.
  - **클래스/메서드:**
    - `AudioAddressableLoader` (static 클래스)
    - `LoadClipAsync(AssetReferenceT<AudioClip> reference)` - 비동기 로드
    - `ReleaseClip(AssetReferenceT<AudioClip> reference)` - 메모리 해제
    - `PreloadSFXClips(SFXClipDatabase database)` - SFX 일괄 프리로드
    - `ReleaseAll()` - 전체 해제
  - **코드 스니펫:**
    ```csharp
    using System.Collections.Generic;
    using System.Threading.Tasks;
    using UnityEngine;
    using UnityEngine.AddressableAssets;
    using UnityEngine.ResourceManagement.AsyncOperations;

    namespace HexaMerge.Audio
    {
        /// <summary>
        /// Addressables 기반 오디오 리소스 비동기 로드/해제.
        /// 설계서: 오디오 포맷 최적화 (OGG for WebGL, WAV for Editor)
        /// Addressables 라벨로 플랫폼별 에셋 분리 가능.
        /// </summary>
        public static class AudioAddressableLoader
        {
            private static readonly Dictionary<string, AsyncOperationHandle<AudioClip>> _handles = new();
            private static readonly Dictionary<string, int> _refCounts = new();

            /// <summary>
            /// AudioClip 비동기 로드. 이미 로드된 경우 캐시에서 반환한다.
            /// </summary>
            public static async Task<AudioClip> LoadClipAsync(AssetReferenceT<AudioClip> reference)
            {
                if (reference == null || !reference.RuntimeKeyIsValid())
                {
                    Debug.LogWarning("[AudioAddressableLoader] 유효하지 않은 AssetReference");
                    return null;
                }

                string key = reference.RuntimeKey.ToString();

                // 이미 로드된 경우 참조 카운트 증가 후 반환
                if (_handles.TryGetValue(key, out var existingHandle)
                    && existingHandle.IsValid()
                    && existingHandle.Status == AsyncOperationStatus.Succeeded)
                {
                    _refCounts[key]++;
                    return existingHandle.Result;
                }

                try
                {
                    var handle = reference.LoadAssetAsync<AudioClip>();
                    await handle.Task;

                    if (handle.Status == AsyncOperationStatus.Succeeded)
                    {
                        _handles[key] = handle;
                        _refCounts[key] = 1;
                        return handle.Result;
                    }
                    else
                    {
                        Debug.LogError($"[AudioAddressableLoader] 로드 실패: {key}");
                        return null;
                    }
                }
                catch (System.Exception e)
                {
                    Debug.LogError($"[AudioAddressableLoader] 예외 발생: {e.Message}");
                    return null;
                }
            }

            /// <summary>
            /// 참조 카운트 감소. 0이 되면 메모리에서 해제한다.
            /// </summary>
            public static void ReleaseClip(AssetReferenceT<AudioClip> reference)
            {
                if (reference == null || !reference.RuntimeKeyIsValid()) return;

                string key = reference.RuntimeKey.ToString();

                if (!_refCounts.ContainsKey(key)) return;

                _refCounts[key]--;

                if (_refCounts[key] <= 0)
                {
                    if (_handles.TryGetValue(key, out var handle) && handle.IsValid())
                    {
                        Addressables.Release(handle);
                    }
                    _handles.Remove(key);
                    _refCounts.Remove(key);
                }
            }

            /// <summary>
            /// SFX 클립 일괄 프리로드. 게임 시작 시 호출하여 첫 재생 지연을 방지한다.
            /// </summary>
            public static async Task PreloadSFXClips(SFXClipDatabase database)
            {
                if (database == null || database.clips == null) return;

                var tasks = new List<Task>();

                foreach (var clipData in database.clips)
                {
                    if (clipData.clipReference != null && clipData.clipReference.RuntimeKeyIsValid())
                    {
                        tasks.Add(LoadClipAsync(clipData.clipReference));
                    }
                }

                await Task.WhenAll(tasks);
                Debug.Log($"[AudioAddressableLoader] SFX 프리로드 완료: {tasks.Count}개 클립");
            }

            /// <summary>
            /// 모든 로드된 오디오 리소스 해제. 씬 전환 또는 앱 종료 시 호출.
            /// </summary>
            public static void ReleaseAll()
            {
                foreach (var kvp in _handles)
                {
                    if (kvp.Value.IsValid())
                        Addressables.Release(kvp.Value);
                }
                _handles.Clear();
                _refCounts.Clear();
                Debug.Log("[AudioAddressableLoader] 모든 오디오 리소스 해제 완료");
            }
        }
    }
    ```
  - **예상 난이도:** 상
  - **의존성:** Addressables 패키지 (`com.unity.addressables`), 오디오 에셋 Addressable 등록

---

### 6.2 Addressables 오디오 에셋 구성 가이드

- [ ] **오디오 에셋 Addressable 그룹 구성**
  - **구현 설명:** BGM과 SFX를 별도 Addressable 그룹으로 분리하여 관리한다. BGM은 필요 시 로드/해제하고, SFX는 게임 시작 시 일괄 프리로드한다.
  - **그룹 구성:**
    ```
    Addressable Groups
    ├── Audio_BGM (원격 또는 로컬)
    │   ├── bgm_sunny_puzzle     [label: bgm]
    │   ├── bgm_chill_merge      [label: bgm]
    │   ├── bgm_combo_vibes      [label: bgm]
    │   └── bgm_shop_melody      [label: bgm]
    ├── Audio_SFX (로컬 - 빠른 접근)
    │   ├── tap_select            [label: sfx]
    │   ├── tap_deselect          [label: sfx]
    │   ├── merge                 [label: sfx]
    │   ├── match_fail            [label: sfx]
    │   ├── wave_whoosh           [label: sfx]
    │   ├── combo_2               [label: sfx]
    │   ├── combo_3               [label: sfx]
    │   ├── combo_4               [label: sfx]
    │   ├── combo_max             [label: sfx]
    │   ├── score_tick            [label: sfx]
    │   ├── new_record            [label: sfx]
    │   ├── button_click          [label: sfx]
    │   ├── transition            [label: sfx]
    │   ├── item_use              [label: sfx]
    │   └── purchase              [label: sfx]
    ```
  - **플랫폼별 포맷 설정 (Unity Audio Import Settings):**
    | 플랫폼 | BGM 포맷 | SFX 포맷 | 압축 | 로드 방식 |
    |--------|---------|---------|------|---------|
    | Android | Vorbis (OGG) | Vorbis (OGG) | 70% 품질 | Streaming (BGM) / Compressed In Memory (SFX) |
    | iOS | AAC (MP4) | ADPCM | 70% 품질 | Streaming (BGM) / Compressed In Memory (SFX) |
    | WebGL | Vorbis (OGG) | Vorbis (OGG) | 70% 품질 | Compressed In Memory |
    | Editor | PCM (WAV) | PCM (WAV) | 무압축 | Decompress On Load |
  - **예상 난이도:** 중
  - **의존성:** Addressables 패키지, Unity 에디터 Import Settings

---

## 7. AudioManager 싱글톤 (통합 진입점)

### 7.1 AudioManager 구현

- [ ] **AudioManager 싱글톤 통합 구현**
  - **구현 설명:** BGMManager, SFXManager, VolumeController, HapticManager를 통합 관리하는 싱글톤 진입점이다. DontDestroyOnLoad로 씬 전환 간 유지되며, 다른 시스템에서 `AudioManager.Instance`를 통해 접근한다.
  - **클래스/메서드:**
    - `AudioManager : MonoBehaviour` (싱글톤)
    - `Instance` (static 프로퍼티)
    - `BGM` (BGMManager 접근 프로퍼티)
    - `SFX` (SFXManager 접근 프로퍼티)
    - `Volume` (VolumeController 접근 프로퍼티)
    - `Haptic` (HapticManager 접근 프로퍼티)
  - **코드 스니펫:**
    ```csharp
    using UnityEngine;
    using UnityEngine.Audio;

    namespace HexaMerge.Audio
    {
        /// <summary>
        /// 오디오 시스템 통합 싱글톤.
        /// 설계서 체크리스트: "AudioManager 싱글톤 구현"
        ///
        /// 사용 예시:
        ///   AudioManager.Instance.SFX.PlayMerge(resultValue);
        ///   AudioManager.Instance.BGM.Play(BGMTrackID.BGM_01_SunnyPuzzle);
        ///   AudioManager.Instance.Haptic.OnBlockTap();
        /// </summary>
        public class AudioManager : MonoBehaviour
        {
            private static AudioManager _instance;
            public static AudioManager Instance
            {
                get
                {
                    if (_instance == null)
                    {
                        Debug.LogError("[AudioManager] 인스턴스가 존재하지 않습니다. " +
                                       "씬에 AudioManager 프리팹이 필요합니다.");
                    }
                    return _instance;
                }
            }

            [Header("데이터베이스")]
            [SerializeField] private BGMTrackDatabase _bgmDatabase;
            [SerializeField] private SFXClipDatabase _sfxDatabase;

            [Header("AudioMixer")]
            [SerializeField] private AudioMixer _audioMixer;

            // 하위 매니저 접근 프로퍼티
            public BGMManager BGM { get; private set; }
            public SFXManager SFX { get; private set; }
            public VolumeController Volume { get; private set; }
            public HapticManager Haptic { get; private set; }

            private void Awake()
            {
                if (_instance != null && _instance != this)
                {
                    Destroy(gameObject);
                    return;
                }

                _instance = this;
                DontDestroyOnLoad(gameObject);

                InitializeSubSystems();
            }

            private async void InitializeSubSystems()
            {
                // 1. 볼륨 컨트롤러 (가장 먼저 - 다른 매니저가 볼륨 참조)
                Volume = new VolumeController();
                Volume.Init(_audioMixer);

                // 2. BGM 매니저
                var bgmGO = new GameObject("BGMManager");
                bgmGO.transform.SetParent(transform);
                BGM = bgmGO.AddComponent<BGMManager>();
                BGM.Init(_bgmDatabase);

                // 3. SFX 매니저
                var sfxGO = new GameObject("SFXManager");
                sfxGO.transform.SetParent(transform);
                SFX = sfxGO.AddComponent<SFXManager>();
                SFX.Init(_sfxDatabase);

                // 4. 햅틱 매니저
                var hapticGO = new GameObject("HapticManager");
                hapticGO.transform.SetParent(transform);
                Haptic = hapticGO.AddComponent<HapticManager>();
                Haptic.Init();

                // 5. 볼륨 변경 이벤트 바인딩
                Volume.OnBGMVolumeChanged += (v) => BGM.SetVolume(v * Volume.MasterVolume);
                Volume.OnSFXVolumeChanged += (v) => SFX.SetVolume(v * Volume.MasterVolume);
                Volume.OnMasterVolumeChanged += (v) =>
                {
                    BGM.SetVolume(v * Volume.BGMVolume);
                    SFX.SetVolume(v * Volume.SFXVolume);
                };

                // 6. SFX 프리로드 (비동기)
                await AudioAddressableLoader.PreloadSFXClips(_sfxDatabase);

                Debug.Log("[AudioManager] 초기화 완료");
            }

            private void OnDestroy()
            {
                if (_instance == this)
                {
                    AudioAddressableLoader.ReleaseAll();
                    _instance = null;
                }
            }
        }
    }
    ```
  - **예상 난이도:** 중
  - **의존성:** `BGMManager`, `SFXManager`, `VolumeController`, `HapticManager`, `AudioAddressableLoader`

---

## 8. 통합 테스트 체크리스트

### 8.1 BGM 테스트

- [ ] 메인 메뉴 진입 시 BGM_01("Sunny Puzzle") 자동 재생 확인
- [ ] 게임 플레이 진입 시 BGM_01 -> BGM_02 크로스페이드 전환 확인 (1.0초)
- [ ] 상점 진입 시 BGM_04("Shop Melody") 크로스페이드 전환 확인
- [ ] 콤보 x3 도달 시 BGM_02 -> BGM_03 페이드 전환 확인 (0.5초)
- [ ] 콤보 종료 2초 후 BGM_03 -> BGM_02 복귀 전환 확인
- [ ] 일시정지 시 BGM 볼륨 50%로 감소 확인 (0.3초 페이드)
- [ ] 일시정지 해제 시 BGM 볼륨 100% 복구 확인 (0.3초 페이드)
- [ ] 크로스페이드 중 새 전환 요청 시 정상 처리 확인
- [ ] BGM 루프 재생 확인 (끊김 없이 반복)

### 8.2 SFX 테스트

- [ ] SFX 15종 모두 정상 재생 확인
- [ ] 블록 탭 사운드 피치 랜덤 변조 확인 (0.95~1.05 범위)
- [ ] 머지 사운드 피치 숫자 비례 상승 확인 (1.0~1.4 범위)
- [ ] 파도 등장 사운드 순차 피치 확인 (0.8~1.2)
- [ ] 점수 카운트 사운드 순차 피치 확인 (1.0~1.5)
- [ ] 동시 8채널 재생 시 정상 동작 확인
- [ ] 우선순위 강탈 동작 확인 (낮은 우선순위 클립이 높은 우선순위에 의해 대체)
- [ ] 빠른 연타 시 풀링 안정성 확인

### 8.3 볼륨 설정 테스트

- [ ] 마스터 볼륨 슬라이더 실시간 반영 확인
- [ ] BGM 볼륨 슬라이더 실시간 반영 확인
- [ ] SFX 볼륨 슬라이더 실시간 반영 확인
- [ ] 볼륨 공식 정확성 확인: `실제 BGM = master x bgm x trackBase`
- [ ] 음소거 토글 ON/OFF 동작 확인
- [ ] 앱 종료 후 재실행 시 볼륨 설정 유지 확인 (PlayerPrefs)
- [ ] 기본값 정확성 확인 (Master: 100%, BGM: 70%, SFX: 100%)
- [ ] 볼륨 0% 시 완전 무음 확인 (-80dB)

### 8.4 햅틱 피드백 테스트

- [ ] **iOS:** 블록 탭 -> Light Impact 확인
- [ ] **iOS:** 머지 성공 -> Medium Impact 확인
- [ ] **iOS:** 콤보 x3+ -> Heavy Impact 확인
- [ ] **iOS:** 콤보 x5+ -> Heavy Impact x2 (100ms 간격) 확인
- [ ] **iOS:** 매칭 실패 -> Notification Error 확인
- [ ] **iOS:** 최고 점수 갱신 -> Notification Success 확인
- [ ] **iOS:** 버튼 클릭 -> Selection 확인
- [ ] **Android:** 각 이벤트별 진동 시간(ms) 정확성 확인
- [ ] **Android:** 패턴 진동 정확성 확인 (콤보 x5+, 매칭 실패)
- [ ] **WebGL:** Navigator.vibrate() 지원 브라우저에서 동작 확인
- [ ] **WebGL:** 미지원 브라우저에서 시각적 폴백(화면 흔들림) 확인
- [ ] 설정에서 햅틱 ON/OFF 토글 동작 확인
- [ ] 햅틱 설정 저장/복원 확인 (PlayerPrefs)

### 8.5 리소스 관리 테스트

- [ ] SFX 프리로드 완료 후 첫 재생 지연 없음 확인
- [ ] BGM 씬 전환 시 이전 트랙 메모리 해제 확인
- [ ] Addressables 로드 실패 시 null 안전 처리 확인
- [ ] 장시간 플레이 시 메모리 누수 없음 확인 (Profiler)
- [ ] 플랫폼별 오디오 포맷 확인 (Android: OGG, iOS: AAC/ADPCM, WebGL: OGG)

### 8.6 성능 테스트

- [ ] BGM 크로스페이드 시 프레임 드롭 없음 확인
- [ ] SFX 8채널 동시 재생 시 CPU 부하 측정
- [ ] 모바일 기기(저사양)에서 오디오 지연 없음 확인
- [ ] WebGL 빌드에서 오디오 재생 안정성 확인
- [ ] 메모리 사용량: BGM 스트리밍, SFX Compressed In Memory 확인

---

## 구현 우선순위 및 일정 가이드

| 순서 | 항목 | 난이도 | 예상 소요 | 선행 의존성 |
|------|------|--------|----------|------------|
| 1 | AudioMixer 에셋 구성 (4.2) | 하 | 0.5일 | 없음 |
| 2 | BGMTrackData / SFXClipData SO (2.1, 3.1) | 하 | 0.5일 | 없음 |
| 3 | AudioAddressableLoader (6.1) | 상 | 1.5일 | Addressables 패키지 |
| 4 | VolumeController (4.1) | 중 | 1일 | AudioMixer 에셋 |
| 5 | BGMManager 코어 + 크로스페이드 (2.2, 2.3) | 중 | 1.5일 | AudioAddressableLoader, VolumeController |
| 6 | 씬별 BGM 전환 (2.4) | 하 | 0.5일 | BGMManager 코어 |
| 7 | 콤보 BGM 전환 (2.5) | 중 | 0.5일 | BGMManager 크로스페이드 |
| 8 | PitchModulator (3.3) | 중 | 0.5일 | SFXClipData |
| 9 | SFXManager 코어 + 풀링 (3.2) | 중 | 1.5일 | AudioAddressableLoader, PitchModulator |
| 10 | 머지/콤보 SFX 전용 메서드 (3.4) | 하 | 0.5일 | SFXManager 코어 |
| 11 | AudioManager 싱글톤 통합 (7.1) | 중 | 1일 | 모든 하위 매니저 |
| 12 | 볼륨 설정 UI 연동 (4.3) | 하 | 0.5일 | VolumeController, UI 레이아웃 |
| 13 | HapticManager + 플랫폼 Provider (5.1~5.4) | 중 | 2일 | 네이티브 플러그인 |
| 14 | Addressables 에셋 그룹 구성 (6.2) | 중 | 1일 | 오디오 에셋 준비 |
| 15 | 통합 테스트 (8.1~8.6) | 중 | 2일 | 전체 시스템 |
| | **합계** | | **약 15일** | |

---

## 파일 구조 (예상)

```
Assets/
├── Audio/
│   ├── Mixers/
│   │   └── MainAudioMixer.mixer
│   ├── Data/
│   │   ├── BGMTrackDatabase.asset
│   │   ├── SFXClipDatabase.asset
│   │   ├── Tracks/
│   │   │   ├── BGM_01_SunnyPuzzle.asset
│   │   │   ├── BGM_02_ChillMerge.asset
│   │   │   ├── BGM_03_ComboVibes.asset
│   │   │   └── BGM_04_ShopMelody.asset
│   │   └── Clips/
│   │       ├── SFX_01_TapSelect.asset
│   │       ├── SFX_02_TapDeselect.asset
│   │       └── ... (15종)
│   └── Clips/
│       ├── BGM/
│       │   ├── bgm_sunny_puzzle.ogg
│       │   ├── bgm_chill_merge.ogg
│       │   ├── bgm_combo_vibes.ogg
│       │   └── bgm_shop_melody.ogg
│       └── SFX/
│           ├── tap_select.wav
│           ├── tap_deselect.wav
│           ├── merge.wav
│           └── ... (15종)
├── Plugins/
│   ├── iOS/
│   │   └── HapticPlugin.mm
│   └── WebGL/
│       └── HapticPlugin.jslib
├── Prefabs/
│   └── AudioManager.prefab
└── Scripts/
    └── Audio/
        ├── AudioManager.cs
        ├── BGMManager.cs
        ├── SFXManager.cs
        ├── VolumeController.cs
        ├── HapticManager.cs
        ├── PitchModulator.cs
        ├── AudioAddressableLoader.cs
        ├── Data/
        │   ├── BGMTrackData.cs
        │   ├── BGMTrackDatabase.cs
        │   ├── SFXClipData.cs
        │   └── SFXClipDatabase.cs
        ├── Haptic/
        │   ├── IHapticProvider.cs
        │   ├── IOSHapticProvider.cs
        │   ├── AndroidHapticProvider.cs
        │   ├── WebGLHapticProvider.cs
        │   └── DummyHapticProvider.cs
        └── UI/
            └── VolumeSettingsUI.cs
```
