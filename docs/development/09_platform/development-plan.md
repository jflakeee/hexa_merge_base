# 09. 플랫폼 배포 및 인프라 개발 계획서

> **프로젝트**: Hexa Merge Basic
> **기반 설계문서**: `docs/design/03_monetization-platform-design.md` (섹션 3~7)
> **플랫폼**: WebGL + Android
> **엔진**: Unity 6 LTS
> **작성일**: 2026-02-13
> **문서 버전**: 1.0

---

## 목차

1. [WebGL 빌드 설정 및 최적화](#1-webgl-빌드-설정-및-최적화)
2. [Android 빌드 설정](#2-android-빌드-설정)
3. [데이터 저장 및 동기화 구현](#3-데이터-저장-및-동기화-구현)
4. [Firebase 연동](#4-firebase-연동)
5. [보안 구현](#5-보안-구현)
6. [CI/CD 파이프라인](#6-cicd-파이프라인)

---

## 1. WebGL 빌드 설정 및 최적화

> 설계문서 참조: 섹션 4 "웹 배포 설계"

### 1.1 Unity WebGL Player Settings 구성

- [ ] **WebGL Player Settings 적용**

  **구현 설명**: Unity Editor의 Player Settings에서 WebGL 빌드에 필요한 모든 설정값을 적용한다. 해상도, 색상 공간, 스크립팅 백엔드, 압축 포맷 등을 설계문서 기준으로 설정한다.

  **필요한 클래스/메서드**:
  - `PlayerSettings.WebGL.*` (에디터 스크립트에서 자동화 시)
  - `EditorUserBuildSettings.SwitchActiveBuildTarget()`

  **설정 예시** (`Assets/Editor/BuildSettings/WebGLBuildConfig.cs`):
  ```csharp
  using UnityEditor;

  public static class WebGLBuildConfig
  {
      [MenuItem("Build/Apply WebGL Settings")]
      public static void ApplySettings()
      {
          // Resolution and Presentation
          PlayerSettings.defaultWebScreenWidth = 720;
          PlayerSettings.defaultWebScreenHeight = 1280;
          PlayerSettings.runInBackground = true;

          // Other Settings
          PlayerSettings.colorSpace = ColorSpace.Gamma;
          PlayerSettings.SetScriptingBackend(
              BuildTargetGroup.WebGL, ScriptingBackend.IL2CPP);
          PlayerSettings.SetApiCompatibilityLevel(
              BuildTargetGroup.WebGL, ApiCompatibilityLevel.NET_Standard_2_1);
          PlayerSettings.stripEngineCode = true;

          // Publishing Settings
          PlayerSettings.WebGL.compressionFormat = WebGLCompressionFormat.Brotli;
          PlayerSettings.WebGL.decompressionFallback = true;
          PlayerSettings.WebGL.nameFilesAsHashes = true;
          PlayerSettings.WebGL.dataCaching = true;
          PlayerSettings.WebGL.exceptionSupport =
              WebGLExceptionSupport.ExplicitlyThrownExceptionsOnly;

          // Memory
          PlayerSettings.WebGL.memorySize = 256;

          UnityEngine.Debug.Log("[WebGLBuildConfig] WebGL 설정 적용 완료");
      }
  }
  ```

  **예상 난이도**: 하
  **의존성**: 없음

---

### 1.2 커스텀 WebGL 템플릿

- [ ] **반응형 커스텀 WebGL 템플릿 작성**

  **구현 설명**: Unity 기본 WebGL 템플릿 대신 모바일 반응형 레이아웃을 지원하는 커스텀 템플릿을 작성한다. 세로 모드(portrait) 기본 대응, 로딩 프로그레스 바, 브라우저 호환성 체크 스크립트를 포함한다.

  **필요한 파일 목록**:
  - `Assets/WebGLTemplates/HexaMerge/index.html`
  - `Assets/WebGLTemplates/HexaMerge/style.css`
  - `Assets/WebGLTemplates/HexaMerge/script.js`
  - `Assets/WebGLTemplates/HexaMerge/thumbnail.png`

  **코드 스니펫** (`index.html` 핵심 부분):
  ```html
  <!DOCTYPE html>
  <html lang="ko">
  <head>
    <meta charset="utf-8">
    <meta name="viewport"
          content="width=device-width, initial-scale=1.0, user-scalable=no">
    <title>Hexa Merge Basic</title>
    <link rel="manifest" href="manifest.json">
    <style>
      /* 반응형 캔버스 컨테이너 */
      #unity-container {
        width: 100vw;
        height: 100vh;
        max-width: 720px;
        margin: 0 auto;
        position: relative;
      }
      #unity-canvas {
        width: 100%;
        height: 100%;
        background-color: #1A1A2E;
      }
      /* 로딩 프로그레스 바 */
      #unity-loading-bar {
        position: absolute;
        left: 50%; top: 50%;
        transform: translate(-50%, -50%);
        width: 80%;
      }
      #unity-progress-bar-full {
        height: 6px;
        background: #4A90D9;
        border-radius: 3px;
        transition: width 0.3s;
      }
    </style>
  </head>
  <body>
    <div id="unity-container">
      <canvas id="unity-canvas" tabindex="-1"></canvas>
      <div id="unity-loading-bar">
        <div id="unity-progress-bar-empty">
          <div id="unity-progress-bar-full" style="width: 0%"></div>
        </div>
        <p id="loading-tip">게임을 불러오는 중...</p>
      </div>
    </div>
    <script>
      // 브라우저 호환성 체크
      function checkBrowserSupport() {
        var hasWebGL = (function() {
          try {
            var c = document.createElement('canvas');
            return !!c.getContext('webgl2');
          } catch(e) { return false; }
        })();
        var hasWasm = typeof WebAssembly === 'object';
        return hasWebGL && hasWasm;
      }

      if (!checkBrowserSupport()) {
        document.getElementById('unity-loading-bar').innerHTML =
          '<p>이 브라우저는 지원되지 않습니다.<br>' +
          '<a href="https://www.google.com/chrome/">Chrome</a> 또는 ' +
          '<a href="https://www.mozilla.org/firefox/">Firefox</a>를 ' +
          '사용해주세요.</p>';
      }
    </script>
    <script src="Build/{{{ LOADER_FILENAME }}}"></script>
    <script>
      createUnityInstance(
        document.querySelector("#unity-canvas"),
        {
          dataUrl: "Build/{{{ DATA_FILENAME }}}",
          frameworkUrl: "Build/{{{ FRAMEWORK_FILENAME }}}",
          codeUrl: "Build/{{{ CODE_FILENAME }}}",
          streamingAssetsUrl: "StreamingAssets",
          companyName: "{{{ COMPANY_NAME }}}",
          productName: "{{{ PRODUCT_NAME }}}",
          productVersion: "{{{ PRODUCT_VERSION }}}",
        },
        (progress) => {
          var bar = document.getElementById("unity-progress-bar-full");
          bar.style.width = (100 * progress) + "%";
        }
      ).then((instance) => {
        document.getElementById("unity-loading-bar").style.display = "none";
      });
    </script>
  </body>
  </html>
  ```

  **예상 난이도**: 중
  **의존성**: 없음

---

### 1.3 WebGL JavaScript 브릿지 플러그인

- [ ] **IndexedDB jslib 플러그인 구현**

  **구현 설명**: Unity WebGL에서 IndexedDB에 접근하기 위한 JavaScript 브릿지 플러그인을 작성한다. C#에서 `[DllImport("__Internal")]`을 통해 호출한다.

  **필요한 클래스/메서드**:
  - `Assets/Plugins/WebGL/IndexedDBPlugin.jslib` (JavaScript 측)
  - `WebGLStorageBridge.cs` (C# 측)
    - `SaveToIndexedDB(string key, string encryptedJson)`
    - `LoadFromIndexedDB(string key, Action<string> callback)`
    - `DeleteFromIndexedDB(string key)`

  **코드 스니펫** (`IndexedDBPlugin.jslib`):
  ```javascript
  mergeInto(LibraryManager.library, {

    InitIndexedDB: function() {
      var request = indexedDB.open("HexaMergeDB", 1);
      request.onupgradeneeded = function(event) {
        var db = event.target.result;
        if (!db.objectStoreNames.contains("GameData")) {
          db.createObjectStore("GameData");
        }
      };
      request.onsuccess = function(event) {
        window._hexaDB = event.target.result;
        console.log("[IndexedDB] DB 초기화 완료");
      };
      request.onerror = function(event) {
        console.error("[IndexedDB] DB 초기화 실패:", event.target.error);
      };
    },

    SaveToIndexedDB: function(keyPtr, valuePtr) {
      var key = UTF8ToString(keyPtr);
      var value = UTF8ToString(valuePtr);
      if (!window._hexaDB) { console.error("DB 미초기화"); return; }
      var tx = window._hexaDB.transaction("GameData", "readwrite");
      var store = tx.objectStore("GameData");
      store.put(value, key);
    },

    LoadFromIndexedDB: function(keyPtr, callbackObjPtr, callbackMethodPtr) {
      var key = UTF8ToString(keyPtr);
      if (!window._hexaDB) { return; }
      var tx = window._hexaDB.transaction("GameData", "readonly");
      var store = tx.objectStore("GameData");
      var request = store.get(key);
      request.onsuccess = function(event) {
        var result = event.target.result || "";
        var bufferSize = lengthBytesUTF8(result) + 1;
        var buffer = _malloc(bufferSize);
        stringToUTF8(result, buffer, bufferSize);
        dynCall_vi(callbackMethodPtr, buffer);
        _free(buffer);
      };
    }
  });
  ```

  **코드 스니펫** (`WebGLStorageBridge.cs`):
  ```csharp
  using System;
  using System.Runtime.InteropServices;
  using UnityEngine;

  public class WebGLStorageBridge : MonoBehaviour
  {
  #if UNITY_WEBGL && !UNITY_EDITOR
      [DllImport("__Internal")]
      private static extern void InitIndexedDB();

      [DllImport("__Internal")]
      private static extern void SaveToIndexedDB(string key, string value);

      [DllImport("__Internal")]
      private static extern void LoadFromIndexedDB(
          string key, IntPtr callbackObj, IntPtr callbackMethod);
  #endif

      public void Initialize()
      {
  #if UNITY_WEBGL && !UNITY_EDITOR
          InitIndexedDB();
  #endif
      }

      public void Save(string key, string encryptedJson)
      {
  #if UNITY_WEBGL && !UNITY_EDITOR
          SaveToIndexedDB(key, encryptedJson);
  #else
          // 에디터 폴백: PlayerPrefs 사용
          PlayerPrefs.SetString(key, encryptedJson);
          PlayerPrefs.Save();
  #endif
      }
  }
  ```

  **예상 난이도**: 중
  **의존성**: 없음

---

### 1.4 로딩 최적화

- [ ] **Addressable Assets 설정 및 초기 로드 크기 최소화**

  **구현 설명**: Unity Addressables 패키지를 사용하여 에셋을 그룹별로 분리하고, 초기 로드 시 필수 에셋만 포함되도록 구성한다. 목표 초기 로드 크기는 압축 후 10MB 이하이다.

  **필요한 클래스/메서드**:
  - `AddressableAssetSettings` (Unity Addressables)
  - `Addressables.LoadAssetAsync<T>()`
  - `Addressables.LoadSceneAsync()`
  - `AssetLoadManager.cs`
    - `PreloadEssentialAssets()`
    - `LoadAssetGroup(string groupName)`
    - `GetLoadProgress() : float`

  **코드 스니펫** (`AssetLoadManager.cs`):
  ```csharp
  using System.Collections;
  using UnityEngine;
  using UnityEngine.AddressableAssets;
  using UnityEngine.ResourceManagement.AsyncOperations;

  public class AssetLoadManager : MonoBehaviour
  {
      public static AssetLoadManager Instance { get; private set; }

      private float _currentProgress;
      public float CurrentProgress => _currentProgress;

      private void Awake()
      {
          if (Instance == null) Instance = this;
          else { Destroy(gameObject); return; }
          DontDestroyOnLoad(gameObject);
      }

      /// <summary>
      /// 게임 시작 시 필수 에셋만 먼저 로드
      /// </summary>
      public IEnumerator PreloadEssentialAssets()
      {
          // 핵심 UI 아틀라스 로드
          var uiHandle = Addressables.LoadAssetAsync<SpriteAtlas>("UI_Core_Atlas");
          yield return uiHandle;
          _currentProgress = 0.3f;

          // 핵사 블록 스프라이트 로드
          var blockHandle = Addressables.LoadAssetAsync<SpriteAtlas>("HexBlock_Atlas");
          yield return blockHandle;
          _currentProgress = 0.6f;

          // 사운드 뱅크 로드
          var audioHandle = Addressables.LoadAssetAsync<AudioClip>("SFX_Core");
          yield return audioHandle;
          _currentProgress = 1.0f;
      }

      /// <summary>
      /// 테마 등 추가 에셋 그룹을 온디맨드로 로드
      /// </summary>
      public IEnumerator LoadAssetGroup(string groupLabel)
      {
          var handle = Addressables.DownloadDependenciesAsync(groupLabel);
          while (!handle.IsDone)
          {
              _currentProgress = handle.PercentComplete;
              yield return null;
          }

          if (handle.Status == AsyncOperationStatus.Succeeded)
              Debug.Log($"[AssetLoadManager] '{groupLabel}' 그룹 로드 완료");
          else
              Debug.LogError($"[AssetLoadManager] '{groupLabel}' 그룹 로드 실패");

          Addressables.Release(handle);
      }
  }
  ```

  **예상 난이도**: 중
  **의존성**: `com.unity.addressables` 패키지

---

- [ ] **텍스처 아틀라스 및 에셋 최적화**

  **구현 설명**: 드로우 콜을 최소화하기 위해 스프라이트를 텍스처 아틀라스로 묶고, 오디오는 Vorbis 압축을 적용한다. 한글 폰트는 사용 문자만 서브셋으로 포함한다.

  **필요한 클래스/메서드**:
  - `SpriteAtlas` (Unity SpriteAtlas)
  - `AudioImporter` 설정 (에디터 스크립트)
  - `TMPro.TMP_FontAsset` (폰트 서브셋)

  **설정 예시** (에디터 스크립트 `Assets/Editor/AssetOptimizer.cs`):
  ```csharp
  using UnityEditor;
  using UnityEditor.U2D;
  using UnityEngine;

  public static class AssetOptimizer
  {
      [MenuItem("Build/Optimize WebGL Assets")]
      public static void OptimizeForWebGL()
      {
          // 오디오 에셋 일괄 최적화
          string[] audioGuids = AssetDatabase.FindAssets("t:AudioClip",
              new[] { "Assets/Audio" });

          foreach (string guid in audioGuids)
          {
              string path = AssetDatabase.GUIDToAssetPath(guid);
              AudioImporter importer = AssetImporter.GetAtPath(path) as AudioImporter;
              if (importer == null) continue;

              var settings = importer.defaultSampleSettings;
              settings.compressionFormat = AudioCompressionFormat.Vorbis;
              settings.quality = 0.5f; // 50% 품질 (용량 절감)
              settings.loadType = AudioClipLoadType.CompressedInMemory;
              importer.defaultSampleSettings = settings;
              importer.SaveAndReimport();
          }

          Debug.Log("[AssetOptimizer] 오디오 에셋 최적화 완료");
      }
  }
  ```

  **예상 난이도**: 하
  **의존성**: 없음

---

### 1.5 호스팅 및 서버 설정

- [ ] **Firebase Hosting 배포 설정**

  **구현 설명**: Unity WebGL 빌드 결과물을 Firebase Hosting에 배포한다. MIME 타입, 캐시 정책, Brotli Content-Encoding 헤더를 `firebase.json`에 설정한다.

  **필요한 파일**:
  - `firebase.json`
  - `.firebaserc`

  **설정 예시** (`firebase.json`):
  ```json
  {
    "hosting": {
      "public": "build/webgl",
      "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
      "headers": [
        {
          "source": "**/*.wasm",
          "headers": [
            { "key": "Content-Type", "value": "application/wasm" },
            { "key": "Cache-Control",
              "value": "public, max-age=31536000, immutable" }
          ]
        },
        {
          "source": "**/*.data.br",
          "headers": [
            { "key": "Content-Type", "value": "application/octet-stream" },
            { "key": "Content-Encoding", "value": "br" },
            { "key": "Cache-Control",
              "value": "public, max-age=31536000, immutable" }
          ]
        },
        {
          "source": "**/*.js.br",
          "headers": [
            { "key": "Content-Type", "value": "application/javascript" },
            { "key": "Content-Encoding", "value": "br" },
            { "key": "Cache-Control",
              "value": "public, max-age=31536000, immutable" }
          ]
        },
        {
          "source": "**/*.wasm.br",
          "headers": [
            { "key": "Content-Type", "value": "application/wasm" },
            { "key": "Content-Encoding", "value": "br" },
            { "key": "Cache-Control",
              "value": "public, max-age=31536000, immutable" }
          ]
        },
        {
          "source": "**/*.html",
          "headers": [
            { "key": "Cache-Control", "value": "no-cache" },
            { "key": "Content-Security-Policy",
              "value": "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://pagead2.googlesyndication.com; connect-src 'self' https://*.firebaseio.com https://*.googleapis.com; frame-src https://js.stripe.com;" }
          ]
        }
      ],
      "rewrites": [
        { "source": "/api/**", "function": "api" }
      ]
    }
  }
  ```

  **예상 난이도**: 하
  **의존성**: Firebase CLI 설치

---

- [ ] **PWA manifest.json 및 Service Worker 작성**

  **구현 설명**: 홈 화면 추가와 정적 리소스 캐시를 위한 PWA 기본 설정을 구현한다. 오프라인 게임 실행은 미지원하되, 정적 에셋 캐시로 재방문 시 로딩 속도를 개선한다.

  **필요한 파일**:
  - `manifest.json`
  - `service-worker.js`

  **코드 스니펫** (`service-worker.js`):
  ```javascript
  const CACHE_NAME = 'hexa-merge-v1';
  const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/style.css',
    '/icons/icon-192.png',
    '/icons/icon-512.png'
  ];

  self.addEventListener('install', (event) => {
    event.waitUntil(
      caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
    );
  });

  self.addEventListener('fetch', (event) => {
    // .wasm, .data, .framework.js 등 Unity 빌드 파일은
    // 네트워크 우선, 캐시 폴백 전략 적용
    if (event.request.url.includes('/Build/')) {
      event.respondWith(
        caches.open(CACHE_NAME).then((cache) =>
          fetch(event.request)
            .then((response) => {
              cache.put(event.request, response.clone());
              return response;
            })
            .catch(() => cache.match(event.request))
        )
      );
      return;
    }
    // 기타 정적 에셋은 캐시 우선
    event.respondWith(
      caches.match(event.request).then((r) => r || fetch(event.request))
    );
  });
  ```

  **예상 난이도**: 하
  **의존성**: 1.2 커스텀 WebGL 템플릿

---

### 1.6 SEO 및 메타데이터

- [ ] **Open Graph, Twitter Card, JSON-LD 구조화 데이터 적용**

  **구현 설명**: 검색엔진 최적화와 소셜 미디어 공유를 위해 index.html에 메타 태그, OG 태그, JSON-LD 구조화 데이터를 삽입한다. `robots.txt`와 `sitemap.xml`도 작성한다.

  **필요한 파일**:
  - `index.html` 내 `<head>` 섹션 (1.2에서 작성한 템플릿에 통합)
  - `robots.txt`
  - `sitemap.xml`

  **설정 예시** (`robots.txt`):
  ```
  User-agent: *
  Allow: /
  Disallow: /Build/
  Disallow: /StreamingAssets/
  Sitemap: https://hexamerge.example.com/sitemap.xml
  ```

  **예상 난이도**: 하
  **의존성**: 1.2 커스텀 WebGL 템플릿

---

## 2. Android 빌드 설정

> 설계문서 참조: 섹션 5 "안드로이드 배포 설계"

### 2.1 Unity Android Player Settings

- [ ] **Android Player Settings 자동화 스크립트 구성**

  **구현 설명**: Android 빌드에 필요한 Player Settings를 에디터 스크립트로 자동 적용한다. Package Name, SDK 버전, 아키텍처, 빌드 포맷(AAB) 등을 포함한다.

  **필요한 클래스/메서드**:
  - `PlayerSettings.Android.*`
  - `PlayerSettings.SetScriptingBackend()`
  - `EditorUserBuildSettings.androidBuildType`
  - `EditorUserBuildSettings.buildAppBundle`

  **코드 스니펫** (`Assets/Editor/BuildSettings/AndroidBuildConfig.cs`):
  ```csharp
  using UnityEditor;
  using UnityEditor.Build;
  using UnityEngine;

  public static class AndroidBuildConfig
  {
      [MenuItem("Build/Apply Android Settings")]
      public static void ApplySettings()
      {
          // 기본 정보
          PlayerSettings.companyName = "HexaMerge";
          PlayerSettings.productName = "Hexa Merge Basic";
          PlayerSettings.SetApplicationIdentifier(
              BuildTargetGroup.Android, "com.hexamerge.basic");
          PlayerSettings.bundleVersion = "1.0.0";
          PlayerSettings.Android.bundleVersionCode = 1;

          // SDK 버전
          PlayerSettings.Android.minSdkVersion = AndroidSdkVersions.AndroidApiLevel24;
          PlayerSettings.Android.targetSdkVersion =
              (AndroidSdkVersions)35; // API 35

          // 스크립팅 백엔드
          PlayerSettings.SetScriptingBackend(
              BuildTargetGroup.Android, ScriptingBackend.IL2CPP);
          PlayerSettings.SetApiCompatibilityLevel(
              BuildTargetGroup.Android, ApiCompatibilityLevel.NET_Standard_2_1);

          // 아키텍처 (ARMv7 + ARM64)
          PlayerSettings.Android.targetArchitectures =
              AndroidArchitecture.ARMv7 | AndroidArchitecture.ARM64;

          // 빌드 설정
          EditorUserBuildSettings.buildAppBundle = true; // AAB 포맷
          PlayerSettings.Android.useCustomKeystore = true;
          PlayerSettings.stripEngineCode = true;

          // 권한 관련
          PlayerSettings.Android.forceInternetPermission = true;

          Debug.Log("[AndroidBuildConfig] Android 설정 적용 완료");
      }
  }
  ```

  **예상 난이도**: 하
  **의존성**: 없음

---

### 2.2 ProGuard/R8 규칙 설정

- [ ] **ProGuard 규칙 파일 작성**

  **구현 설명**: AAB/APK 릴리스 빌드 시 Java/Kotlin 코드 난독화에서 Google Play Billing, AdMob, Firebase, Unity 관련 클래스가 제거되지 않도록 ProGuard keep 규칙을 추가한다.

  **필요한 파일**:
  - `Assets/Plugins/Android/proguard-user.txt`

  **설정 예시** (`proguard-user.txt`):
  ```proguard
  # ===== Google Play Billing =====
  -keep class com.android.vending.billing.** { *; }
  -keep class com.android.billingclient.** { *; }

  # ===== Google AdMob =====
  -keep class com.google.android.gms.ads.** { *; }
  -keep class com.google.ads.mediation.** { *; }

  # ===== Unity Ads =====
  -keep class com.unity3d.services.** { *; }
  -keep class com.unity3d.ads.** { *; }

  # ===== Unity Engine =====
  -keep class com.unity3d.** { *; }
  -dontwarn com.unity3d.**

  # ===== Firebase =====
  -keep class com.google.firebase.** { *; }
  -dontwarn com.google.firebase.**
  -keep class com.google.android.gms.** { *; }
  -dontwarn com.google.android.gms.**

  # ===== Google Play Games Services =====
  -keep class com.google.android.gms.games.** { *; }

  # ===== 게임 데이터 직렬화 클래스 =====
  -keep class com.hexamerge.basic.data.** { *; }

  # ===== 일반 규칙 =====
  -keepattributes Signature
  -keepattributes *Annotation*
  -keepattributes EnclosingMethod
  -keepattributes InnerClasses
  ```

  **예상 난이도**: 하
  **의존성**: 없음

---

### 2.3 Gradle 템플릿 설정

- [ ] **Custom Gradle Template 활성화 및 구성**

  **구현 설명**: Unity의 Custom Gradle Template을 활성화하여 Firebase, Play Billing, AdMob 등의 네이티브 종속성을 선언한다.

  **필요한 파일**:
  - `Assets/Plugins/Android/mainTemplate.gradle`
  - `Assets/Plugins/Android/gradleTemplate.properties`
  - `Assets/Plugins/Android/settingsTemplate.gradle` (필요시)

  **설정 예시** (`mainTemplate.gradle` 핵심 부분):
  ```groovy
  dependencies {
      implementation fileTree(dir: 'libs', include: ['*.jar'])

      // Google Play Billing Library 7.x
      implementation 'com.android.billingclient:billing:7.0.0'

      // Firebase BoM
      implementation platform('com.google.firebase:firebase-bom:33.0.0')
      implementation 'com.google.firebase:firebase-analytics'
      implementation 'com.google.firebase:firebase-crashlytics'
      implementation 'com.google.firebase:firebase-auth'
      implementation 'com.google.firebase:firebase-firestore'
      implementation 'com.google.firebase:firebase-config'

      // Google AdMob
      implementation 'com.google.android.gms:play-services-ads:23.0.0'

      // Google Play Games Services
      implementation 'com.google.android.gms:play-services-games-v2:20.0.0'

      // 기타
      **DEPS**
  }
  ```

  **예상 난이도**: 중
  **의존성**: Firebase 프로젝트 설정 완료

---

### 2.4 키스토어 및 앱 서명

- [ ] **업로드 키 생성 및 Play App Signing 등록**

  **구현 설명**: AAB 업로드용 키스토어를 `keytool`로 생성하고, Google Play Console에서 Play App Signing을 활성화한다. 키스토어 비밀번호는 CI/CD 환경변수로 관리한다.

  **필요한 도구/설정**:
  - `keytool` (JDK 포함)
  - Unity Player Settings > Publishing Settings > Keystore
  - CI/CD 시크릿 변수: `KEYSTORE_FILE`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`

  **실행 예시** (키 생성):
  ```bash
  keytool -genkeypair \
    -alias hexamerge-upload \
    -keyalg RSA \
    -keysize 2048 \
    -validity 10000 \
    -keystore hexamerge-upload.keystore \
    -storepass "${KEYSTORE_PASSWORD}" \
    -keypass "${KEY_PASSWORD}" \
    -dname "CN=HexaMerge, OU=Dev, O=HexaMerge, L=Seoul, ST=Seoul, C=KR"
  ```

  **Unity 설정 스크립트** (CI 빌드용):
  ```csharp
  public static void ConfigureKeystore()
  {
      PlayerSettings.Android.useCustomKeystore = true;
      PlayerSettings.Android.keystoreName =
          Environment.GetEnvironmentVariable("KEYSTORE_FILE");
      PlayerSettings.Android.keystorePass =
          Environment.GetEnvironmentVariable("KEYSTORE_PASSWORD");
      PlayerSettings.Android.keyaliasName =
          Environment.GetEnvironmentVariable("KEY_ALIAS");
      PlayerSettings.Android.keyaliasPass =
          Environment.GetEnvironmentVariable("KEY_PASSWORD");
  }
  ```

  **예상 난이도**: 중
  **의존성**: Google Play Console 계정

---

### 2.5 Android 네트워크 보안 설정

- [ ] **network_security_config.xml 작성 및 Certificate Pinning 적용**

  **구현 설명**: Android 앱에서 API 서버 통신 시 Certificate Pinning을 적용하여 MITM 공격을 방어한다. 디버그 빌드에서는 로컬 테스트를 위해 핀을 우회한다.

  **필요한 파일**:
  - `Assets/Plugins/Android/res/xml/network_security_config.xml`
  - `Assets/Plugins/Android/AndroidManifest.xml` (application 태그에 속성 추가)

  **설정 예시** (`network_security_config.xml`):
  ```xml
  <?xml version="1.0" encoding="utf-8"?>
  <network-security-config>
      <!-- API 서버 Certificate Pinning -->
      <domain-config>
          <domain includeSubdomains="true">api.hexamerge.example.com</domain>
          <pin-set expiration="2027-01-01">
              <!-- 기본 핀 (SHA-256) -->
              <pin digest="SHA-256">
                  AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=
              </pin>
              <!-- 백업 핀 -->
              <pin digest="SHA-256">
                  BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=
              </pin>
          </pin-set>
      </domain-config>

      <!-- Firebase 도메인은 시스템 CA 사용 -->
      <domain-config>
          <domain includeSubdomains="true">firebaseio.com</domain>
          <domain includeSubdomains="true">googleapis.com</domain>
          <trust-anchors>
              <certificates src="system" />
          </trust-anchors>
      </domain-config>

      <!-- 디버그 빌드에서는 사용자 CA 허용 -->
      <debug-overrides>
          <trust-anchors>
              <certificates src="user" />
          </trust-anchors>
      </debug-overrides>
  </network-security-config>
  ```

  **예상 난이도**: 중
  **의존성**: API 서버 SSL 인증서 해시 확보

---

## 3. 데이터 저장 및 동기화 구현

> 설계문서 참조: 섹션 3 "데이터 저장 및 동기화"

### 3.1 저장 데이터 모델 정의

- [ ] **SaveData 직렬화 클래스 구현**

  **구현 설명**: 게임 진행, 재화, 구매, 통계 데이터를 하나의 직렬화 클래스로 정의한다. JSON 직렬화를 위해 `[System.Serializable]` 어트리뷰트를 사용하며, 버전 필드를 포함하여 향후 마이그레이션을 지원한다.

  **필요한 클래스/메서드**:
  - `SaveData.cs` (데이터 모델)
  - `SaveDataMigrator.cs` (버전 마이그레이션)

  **코드 스니펫** (`SaveData.cs`):
  ```csharp
  using System;
  using System.Collections.Generic;

  [System.Serializable]
  public class SaveData
  {
      // 버전 관리
      public int version = 1;
      public long lastSaveTimestamp;

      // 진행 데이터
      public int highScore;
      public int totalGamesPlayed;
      public int totalMerges;

      // 재화
      public int coins;
      public int hints;
      public List<ItemData> items = new List<ItemData>();

      // 구매 기록
      public List<string> purchasedProducts = new List<string>();
      public bool adsRemoved;

      // 통계
      public string lastLoginDate;
      public int consecutiveLoginDays;

      // 테마
      public string selectedTheme = "default";

      /// <summary>
      /// 기본값으로 초기화된 SaveData 생성
      /// </summary>
      public static SaveData CreateDefault()
      {
          return new SaveData
          {
              version = 1,
              lastSaveTimestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
              highScore = 0,
              coins = 0,
              hints = 3, // 초기 힌트 3개
              items = new List<ItemData>(),
              purchasedProducts = new List<string>(),
              adsRemoved = false,
              lastLoginDate = DateTime.UtcNow.ToString("yyyy-MM-dd"),
              consecutiveLoginDays = 1,
              selectedTheme = "default"
          };
      }
  }

  [System.Serializable]
  public class ItemData
  {
      public string itemId;
      public int count;
  }
  ```

  **코드 스니펫** (`SaveDataMigrator.cs`):
  ```csharp
  using UnityEngine;

  public static class SaveDataMigrator
  {
      public const int CURRENT_VERSION = 1;

      /// <summary>
      /// 이전 버전 세이브 데이터를 현재 버전으로 마이그레이션
      /// </summary>
      public static SaveData Migrate(SaveData data)
      {
          if (data.version >= CURRENT_VERSION)
              return data;

          // v0 -> v1 마이그레이션 예시
          if (data.version == 0)
          {
              data.selectedTheme = "default";
              data.consecutiveLoginDays = 1;
              data.version = 1;
              Debug.Log("[SaveDataMigrator] v0 -> v1 마이그레이션 완료");
          }

          // 향후 추가 마이그레이션:
          // if (data.version == 1) { ... data.version = 2; }

          return data;
      }
  }
  ```

  **예상 난이도**: 하
  **의존성**: 없음

---

### 3.2 플랫폼별 로컬 저장 구현

- [ ] **ISaveStorage 인터페이스 및 플랫폼별 구현체 작성**

  **구현 설명**: 로컬 저장을 추상화하는 인터페이스를 정의하고, Android(암호화 파일)와 WebGL(IndexedDB)에 대한 구현체를 각각 작성한다. 에디터용 Mock 구현체도 제공한다.

  **필요한 클래스/메서드**:
  - `ISaveStorage` (인터페이스)
    - `Save(string key, string data) : bool`
    - `Load(string key) : string`
    - `Delete(string key) : bool`
    - `HasKey(string key) : bool`
  - `AndroidSaveStorage` (Android 구현체)
  - `WebGLSaveStorage` (WebGL 구현체)
  - `EditorSaveStorage` (에디터 구현체)

  **코드 스니펫** (`ISaveStorage.cs` 및 `AndroidSaveStorage.cs`):
  ```csharp
  // ---- ISaveStorage.cs ----
  public interface ISaveStorage
  {
      bool Save(string key, string jsonData);
      string Load(string key);
      bool Delete(string key);
      bool HasKey(string key);
  }

  // ---- AndroidSaveStorage.cs ----
  using System;
  using System.IO;
  using UnityEngine;

  public class AndroidSaveStorage : ISaveStorage
  {
      private readonly string _saveDirectory;
      private readonly IDataEncryptor _encryptor;

      public AndroidSaveStorage(IDataEncryptor encryptor)
      {
          _encryptor = encryptor;
          _saveDirectory = Path.Combine(
              Application.persistentDataPath, "save");

          if (!Directory.Exists(_saveDirectory))
              Directory.CreateDirectory(_saveDirectory);
      }

      public bool Save(string key, string jsonData)
      {
          try
          {
              string filePath = GetFilePath(key);
              string backupPath = filePath + ".bak";

              // 기존 파일을 백업
              if (File.Exists(filePath))
                  File.Copy(filePath, backupPath, overwrite: true);

              // 암호화 후 저장
              string encrypted = _encryptor.Encrypt(jsonData);
              File.WriteAllText(filePath, encrypted);
              return true;
          }
          catch (Exception ex)
          {
              Debug.LogError(
                  $"[AndroidSaveStorage] 저장 실패 key={key}: {ex.Message}");
              return false;
          }
      }

      public string Load(string key)
      {
          string filePath = GetFilePath(key);
          if (!File.Exists(filePath)) return null;

          try
          {
              string encrypted = File.ReadAllText(filePath);
              return _encryptor.Decrypt(encrypted);
          }
          catch (Exception ex)
          {
              Debug.LogWarning(
                  $"[AndroidSaveStorage] 로드 실패, 백업 시도: {ex.Message}");
              return TryLoadBackup(key);
          }
      }

      public bool Delete(string key)
      {
          string filePath = GetFilePath(key);
          if (File.Exists(filePath)) { File.Delete(filePath); return true; }
          return false;
      }

      public bool HasKey(string key) => File.Exists(GetFilePath(key));

      private string GetFilePath(string key) =>
          Path.Combine(_saveDirectory, $"{key}.sav");

      private string TryLoadBackup(string key)
      {
          string backupPath = GetFilePath(key) + ".bak";
          if (!File.Exists(backupPath)) return null;
          try
          {
              string encrypted = File.ReadAllText(backupPath);
              return _encryptor.Decrypt(encrypted);
          }
          catch { return null; }
      }
  }
  ```

  **예상 난이도**: 중
  **의존성**: 5.3 AES-256 암호화 모듈

---

### 3.3 설정값 저장 (경량 데이터)

- [ ] **PlayerPrefs / LocalStorage 래퍼 구현**

  **구현 설명**: 음악 볼륨, 효과음 볼륨, 언어 등 간단한 설정값은 Android에서 PlayerPrefs, WebGL에서 LocalStorage를 사용한다. 네임스페이스 접두어(`hexa_`)를 붙여 키 충돌을 방지한다.

  **필요한 클래스/메서드**:
  - `GameSettings.cs`
    - `GetFloat(string key, float defaultValue) : float`
    - `SetFloat(string key, float value)`
    - `GetString(string key, string defaultValue) : string`
    - `SetString(string key, string value)`
    - `Save()`

  **코드 스니펫** (`GameSettings.cs`):
  ```csharp
  using UnityEngine;

  public static class GameSettings
  {
      private const string PREFIX = "hexa_";

      // 음악 볼륨 (0.0 ~ 1.0)
      public static float MusicVolume
      {
          get => PlayerPrefs.GetFloat(PREFIX + "musicVolume", 0.8f);
          set { PlayerPrefs.SetFloat(PREFIX + "musicVolume", value); }
      }

      // 효과음 볼륨 (0.0 ~ 1.0)
      public static float SfxVolume
      {
          get => PlayerPrefs.GetFloat(PREFIX + "sfxVolume", 1.0f);
          set { PlayerPrefs.SetFloat(PREFIX + "sfxVolume", value); }
      }

      // 언어 설정
      public static string Language
      {
          get => PlayerPrefs.GetString(PREFIX + "language", "ko");
          set { PlayerPrefs.SetString(PREFIX + "language", value); }
      }

      public static void Save() => PlayerPrefs.Save();
  }
  ```

  **예상 난이도**: 하
  **의존성**: 없음

---

### 3.4 클라우드 저장 구현

- [ ] **ICloudSaveService 인터페이스 및 플랫폼별 구현체**

  **구현 설명**: 클라우드 저장을 추상화하는 인터페이스를 정의한다. Android에서는 Google Play Games Services의 Saved Games API를 사용하고, WebGL에서는 Firebase Firestore를 사용한다.

  **필요한 클래스/메서드**:
  - `ICloudSaveService` (인터페이스)
    - `SaveAsync(SaveData data) : Task<bool>`
    - `LoadAsync() : Task<SaveData>`
    - `IsAuthenticated : bool`
  - `PlayGamesSaveService` (Android 구현체)
  - `FirestoreSaveService` (WebGL 구현체)
  - `NullCloudSaveService` (미인증 시 폴백)

  **코드 스니펫** (`ICloudSaveService.cs` 및 `FirestoreSaveService.cs`):
  ```csharp
  // ---- ICloudSaveService.cs ----
  using System.Threading.Tasks;

  public interface ICloudSaveService
  {
      bool IsAuthenticated { get; }
      Task<bool> SaveAsync(SaveData data);
      Task<SaveData> LoadAsync();
  }

  // ---- FirestoreSaveService.cs ----
  using System;
  using System.Threading.Tasks;
  using Firebase.Auth;
  using Firebase.Firestore;
  using UnityEngine;

  public class FirestoreSaveService : ICloudSaveService
  {
      private FirebaseFirestore _db;
      private FirebaseAuth _auth;

      public bool IsAuthenticated => _auth?.CurrentUser != null;

      public void Initialize()
      {
          _auth = FirebaseAuth.DefaultInstance;
          _db = FirebaseFirestore.DefaultInstance;
      }

      public async Task<bool> SaveAsync(SaveData data)
      {
          if (!IsAuthenticated)
          {
              Debug.LogWarning("[FirestoreSave] 미인증 상태, 클라우드 저장 건너뜀");
              return false;
          }

          try
          {
              string uid = _auth.CurrentUser.UserId;
              data.lastSaveTimestamp =
                  DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
              string json = JsonUtility.ToJson(data);

              DocumentReference docRef =
                  _db.Collection("users").Document(uid)
                     .Collection("save").Document("gamedata");

              await docRef.SetAsync(new {
                  data = json,
                  updatedAt = FieldValue.ServerTimestamp
              });

              Debug.Log("[FirestoreSave] 클라우드 저장 성공");
              return true;
          }
          catch (Exception ex)
          {
              Debug.LogError($"[FirestoreSave] 저장 실패: {ex.Message}");
              return false;
          }
      }

      public async Task<SaveData> LoadAsync()
      {
          if (!IsAuthenticated) return null;

          try
          {
              string uid = _auth.CurrentUser.UserId;
              DocumentReference docRef =
                  _db.Collection("users").Document(uid)
                     .Collection("save").Document("gamedata");

              DocumentSnapshot snapshot = await docRef.GetSnapshotAsync();
              if (!snapshot.Exists) return null;

              string json = snapshot.GetValue<string>("data");
              SaveData loaded = JsonUtility.FromJson<SaveData>(json);
              return SaveDataMigrator.Migrate(loaded);
          }
          catch (Exception ex)
          {
              Debug.LogError($"[FirestoreSave] 로드 실패: {ex.Message}");
              return null;
          }
      }
  }
  ```

  **예상 난이도**: 상
  **의존성**: Firebase Auth 초기화 완료, Firebase Firestore SDK

---

### 3.5 데이터 동기화 관리자

- [ ] **DataSyncManager 구현 (로컬-클라우드 동기화 + 충돌 해결)**

  **구현 설명**: 앱 시작, 게임 오버, 구매 완료 등 트리거 시점에 로컬과 클라우드 데이터를 비교하여 동기화한다. 충돌 시 데이터 유형별 해결 정책(높은 값 우선, 서버 우선, 합집합 등)을 적용한다.

  **필요한 클래스/메서드**:
  - `DataSyncManager.cs`
    - `SyncAsync() : Task`
    - `ForceSaveToCloud() : Task`
    - `ResolveConflict(SaveData local, SaveData cloud) : SaveData`
  - `SyncStatus` (enum): `Idle`, `Syncing`, `Completed`, `Failed`

  **코드 스니펫** (`DataSyncManager.cs`):
  ```csharp
  using System;
  using System.Collections.Generic;
  using System.Linq;
  using System.Threading.Tasks;
  using UnityEngine;

  public class DataSyncManager
  {
      private readonly ISaveStorage _localStorage;
      private readonly ICloudSaveService _cloudService;

      public SyncStatus Status { get; private set; } = SyncStatus.Idle;
      public event Action<SyncStatus> OnSyncStatusChanged;

      public DataSyncManager(
          ISaveStorage localStorage, ICloudSaveService cloudService)
      {
          _localStorage = localStorage;
          _cloudService = cloudService;
      }

      public async Task SyncAsync()
      {
          if (Status == SyncStatus.Syncing) return;
          Status = SyncStatus.Syncing;
          OnSyncStatusChanged?.Invoke(Status);

          try
          {
              // 1. 로컬 데이터 로드
              string localJson = _localStorage.Load("gamedata");
              SaveData localData = localJson != null
                  ? JsonUtility.FromJson<SaveData>(localJson)
                  : null;

              // 2. 클라우드 데이터 로드
              SaveData cloudData = await _cloudService.LoadAsync();

              // 3. 동기화 판단
              SaveData resolved = ResolveConflict(localData, cloudData);

              // 4. 양쪽 모두 갱신
              string resolvedJson = JsonUtility.ToJson(resolved);
              _localStorage.Save("gamedata", resolvedJson);
              await _cloudService.SaveAsync(resolved);

              Status = SyncStatus.Completed;
              Debug.Log("[DataSync] 동기화 완료");
          }
          catch (Exception ex)
          {
              Status = SyncStatus.Failed;
              Debug.LogError($"[DataSync] 동기화 실패: {ex.Message}");
          }
          finally
          {
              OnSyncStatusChanged?.Invoke(Status);
          }
      }

      /// <summary>
      /// 충돌 해결 정책 적용
      /// </summary>
      public SaveData ResolveConflict(SaveData local, SaveData cloud)
      {
          // 한쪽만 존재하는 경우
          if (local == null && cloud == null)
              return SaveData.CreateDefault();
          if (local == null) return cloud;
          if (cloud == null) return local;

          // 양쪽 모두 존재: 필드별 충돌 해결
          SaveData resolved = new SaveData();
          resolved.version = SaveDataMigrator.CURRENT_VERSION;
          resolved.lastSaveTimestamp =
              DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

          // 최고 점수: 높은 값 우선
          resolved.highScore = Mathf.Max(local.highScore, cloud.highScore);

          // 코인: 서버(클라우드) 우선
          resolved.coins = cloud.coins;

          // 힌트: 서버(클라우드) 우선
          resolved.hints = cloud.hints;

          // 아이템: 서버 우선
          resolved.items = cloud.items;

          // 구매 기록: 합집합
          var allProducts = new HashSet<string>(local.purchasedProducts);
          allProducts.UnionWith(cloud.purchasedProducts);
          resolved.purchasedProducts = allProducts.ToList();

          // 광고 제거: OR (한쪽이라도 구매했으면 유지)
          resolved.adsRemoved = local.adsRemoved || cloud.adsRemoved;

          // 통계: 높은 값 우선
          resolved.totalGamesPlayed =
              Mathf.Max(local.totalGamesPlayed, cloud.totalGamesPlayed);
          resolved.totalMerges =
              Mathf.Max(local.totalMerges, cloud.totalMerges);
          resolved.consecutiveLoginDays =
              Mathf.Max(local.consecutiveLoginDays,
                        cloud.consecutiveLoginDays);

          // 설정: 로컬 우선
          resolved.selectedTheme = local.selectedTheme;

          return resolved;
      }
  }

  public enum SyncStatus
  {
      Idle,
      Syncing,
      Completed,
      Failed
  }
  ```

  **예상 난이도**: 상
  **의존성**: 3.2 로컬 저장, 3.4 클라우드 저장

---

### 3.6 오프라인 동기화 큐

- [ ] **OfflineSyncQueue 구현 (오프라인 시 동기화 대기열)**

  **구현 설명**: 오프라인 상태에서 발생한 데이터 변경을 큐에 저장하고, 네트워크 복구 시 순서대로 동기화를 실행한다.

  **필요한 클래스/메서드**:
  - `OfflineSyncQueue.cs`
    - `Enqueue(SyncOperation op)`
    - `ProcessQueue() : Task`
    - `GetPendingCount() : int`
  - `SyncOperation` (직렬화 가능한 구조체)

  **코드 스니펫** (`OfflineSyncQueue.cs`):
  ```csharp
  using System;
  using System.Collections.Generic;
  using System.Threading.Tasks;
  using UnityEngine;

  [System.Serializable]
  public class SyncOperation
  {
      public string operationType; // "save", "purchase", "score"
      public string payload;       // JSON 직렬화된 데이터
      public long timestamp;
  }

  public class OfflineSyncQueue
  {
      private Queue<SyncOperation> _queue = new Queue<SyncOperation>();
      private readonly ISaveStorage _localStorage;
      private const string QUEUE_KEY = "sync_queue";

      public int PendingCount => _queue.Count;

      public OfflineSyncQueue(ISaveStorage storage)
      {
          _localStorage = storage;
          LoadQueueFromDisk();
      }

      public void Enqueue(SyncOperation op)
      {
          op.timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
          _queue.Enqueue(op);
          SaveQueueToDisk();
          Debug.Log($"[OfflineSyncQueue] 큐 추가: {op.operationType}" +
                    $" (대기 {_queue.Count}건)");
      }

      public async Task ProcessQueue(ICloudSaveService cloudService)
      {
          while (_queue.Count > 0)
          {
              SyncOperation op = _queue.Peek();
              try
              {
                  // 작업 유형별 처리
                  bool success = op.operationType switch
                  {
                      "save" => await ProcessSaveOp(cloudService, op),
                      _ => false
                  };

                  if (success)
                  {
                      _queue.Dequeue();
                      SaveQueueToDisk();
                  }
                  else break; // 실패 시 중단, 다음 기회에 재시도
              }
              catch (Exception ex)
              {
                  Debug.LogWarning(
                      $"[OfflineSyncQueue] 처리 실패: {ex.Message}");
                  break;
              }
          }
      }

      private async Task<bool> ProcessSaveOp(
          ICloudSaveService cloudService, SyncOperation op)
      {
          SaveData data = JsonUtility.FromJson<SaveData>(op.payload);
          return await cloudService.SaveAsync(data);
      }

      private void SaveQueueToDisk()
      {
          var wrapper = new SyncQueueWrapper {
              operations = new List<SyncOperation>(_queue)
          };
          string json = JsonUtility.ToJson(wrapper);
          _localStorage.Save(QUEUE_KEY, json);
      }

      private void LoadQueueFromDisk()
      {
          string json = _localStorage.Load(QUEUE_KEY);
          if (string.IsNullOrEmpty(json)) return;
          var wrapper = JsonUtility.FromJson<SyncQueueWrapper>(json);
          _queue = new Queue<SyncOperation>(wrapper.operations);
      }
  }

  [System.Serializable]
  public class SyncQueueWrapper
  {
      public List<SyncOperation> operations;
  }
  ```

  **예상 난이도**: 중
  **의존성**: 3.2 로컬 저장, 3.4 클라우드 저장

---

## 4. Firebase 연동

> 설계문서 참조: 섹션 6 "분석 및 추적"

### 4.1 Firebase 프로젝트 초기화

- [ ] **Firebase 프로젝트 생성 및 Unity SDK 설치**

  **구현 설명**: Firebase Console에서 프로젝트를 생성하고, Android 앱과 WebGL 웹 앱을 등록한다. Unity Firebase SDK를 임포트하고 초기화 코드를 작성한다.

  **필요한 파일/패키지**:
  - `Assets/StreamingAssets/google-services.json` (Android)
  - `Assets/StreamingAssets/firebase-config.json` (WebGL 자체 관리)
  - Firebase Unity SDK 패키지:
    - `FirebaseAnalytics.unitypackage`
    - `FirebaseCrashlytics.unitypackage`
    - `FirebaseAuth.unitypackage`
    - `FirebaseFirestore.unitypackage`
    - `FirebaseRemoteConfig.unitypackage`

  **코드 스니펫** (`FirebaseInitializer.cs`):
  ```csharp
  using System;
  using System.Threading.Tasks;
  using Firebase;
  using Firebase.Analytics;
  using Firebase.Crashlytics;
  using UnityEngine;

  public class FirebaseInitializer : MonoBehaviour
  {
      public static FirebaseInitializer Instance { get; private set; }
      public bool IsInitialized { get; private set; }

      public event Action OnFirebaseReady;

      private void Awake()
      {
          if (Instance == null) { Instance = this; DontDestroyOnLoad(gameObject); }
          else { Destroy(gameObject); return; }
      }

      private async void Start()
      {
          await InitializeFirebase();
      }

      private async Task InitializeFirebase()
      {
          try
          {
              var dependencyStatus = await
                  FirebaseApp.CheckAndFixDependenciesAsync();

              if (dependencyStatus == DependencyStatus.Available)
              {
                  FirebaseApp app = FirebaseApp.DefaultInstance;

                  // Crashlytics 활성화
                  Crashlytics.ReportUncaughtExceptionsAsFatal = true;

                  // Analytics 기본 사용자 속성 설정
                  FirebaseAnalytics.SetUserProperty(
                      "platform", Application.platform.ToString());
                  FirebaseAnalytics.SetUserProperty(
                      "app_version", Application.version);

                  IsInitialized = true;
                  OnFirebaseReady?.Invoke();
                  Debug.Log("[Firebase] 초기화 완료");
              }
              else
              {
                  Debug.LogError(
                      $"[Firebase] 종속성 해결 실패: {dependencyStatus}");
              }
          }
          catch (Exception ex)
          {
              Debug.LogError($"[Firebase] 초기화 예외: {ex.Message}");
          }
      }
  }
  ```

  **예상 난이도**: 중
  **의존성**: Firebase Console 프로젝트 생성

---

### 4.2 Firebase Analytics 이벤트 추적

- [ ] **AnalyticsService 구현 (커스텀 이벤트 래퍼)**

  **구현 설명**: 설계문서에 정의된 게임플레이, 수익화, 사용자 행동 이벤트를 통합 관리하는 Analytics 서비스를 구현한다. GDPR 동의 여부에 따라 수집을 활성화/비활성화한다.

  **필요한 클래스/메서드**:
  - `AnalyticsService.cs`
    - `LogGameStart(string mode, string theme)`
    - `LogGameOver(int score, int maxNumber, float duration, int merges)`
    - `LogAdImpression(string adType, string triggerPoint, string network)`
    - `LogPurchaseCompleted(string productId, float price, string currency)`
    - `SetUserTier(string tier)`
    - `SetAnalyticsEnabled(bool enabled)`

  **코드 스니펫** (`AnalyticsService.cs`):
  ```csharp
  using Firebase.Analytics;
  using UnityEngine;

  public static class AnalyticsService
  {
      private static bool _isEnabled = true;

      public static void SetAnalyticsEnabled(bool enabled)
      {
          _isEnabled = enabled;
          FirebaseAnalytics.SetAnalyticsCollectionEnabled(enabled);
          Debug.Log($"[Analytics] 수집 {(enabled ? "활성화" : "비활성화")}");
      }

      // ===== 게임플레이 이벤트 =====

      public static void LogGameStart(string mode, string theme)
      {
          if (!_isEnabled) return;
          FirebaseAnalytics.LogEvent("game_start",
              new Parameter("mode", mode),
              new Parameter("theme", theme));
      }

      public static void LogGameOver(
          int score, int maxNumber, float durationSec, int totalMerges)
      {
          if (!_isEnabled) return;
          FirebaseAnalytics.LogEvent("game_over",
              new Parameter("score", score),
              new Parameter("max_number", maxNumber),
              new Parameter("duration_sec", (long)durationSec),
              new Parameter("total_merges", totalMerges));
      }

      public static void LogMergeBlock(
          int fromNumber, int toNumber, int comboCount)
      {
          if (!_isEnabled) return;
          FirebaseAnalytics.LogEvent("merge_block",
              new Parameter("from_number", fromNumber),
              new Parameter("to_number", toNumber),
              new Parameter("combo_count", comboCount));
      }

      public static void LogHighScore(int previousScore, int newScore)
      {
          if (!_isEnabled) return;
          FirebaseAnalytics.LogEvent("high_score",
              new Parameter("previous_score", previousScore),
              new Parameter("new_score", newScore));
      }

      // ===== 수익화 이벤트 =====

      public static void LogAdImpression(
          string adType, string triggerPoint, string network)
      {
          if (!_isEnabled) return;
          FirebaseAnalytics.LogEvent("ad_impression",
              new Parameter("ad_type", adType),
              new Parameter("trigger_point", triggerPoint),
              new Parameter("network", network));
      }

      public static void LogAdFailed(
          string errorCode, string network, string triggerPoint)
      {
          if (!_isEnabled) return;
          FirebaseAnalytics.LogEvent("ad_failed",
              new Parameter("error_code", errorCode),
              new Parameter("network", network),
              new Parameter("trigger_point", triggerPoint));
      }

      public static void LogPurchaseCompleted(
          string productId, float price, string currency, string txId)
      {
          if (!_isEnabled) return;
          FirebaseAnalytics.LogEvent("purchase_completed",
              new Parameter("product_id", productId),
              new Parameter("price", (double)price),
              new Parameter("currency", currency),
              new Parameter("transaction_id", txId));
      }

      // ===== 사용자 행동 이벤트 =====

      public static void LogSessionStart(string platform, string version)
      {
          if (!_isEnabled) return;
          FirebaseAnalytics.LogEvent("session_start",
              new Parameter("platform", platform),
              new Parameter("version", version));
      }

      public static void LogTutorialComplete(float durationSec)
      {
          if (!_isEnabled) return;
          FirebaseAnalytics.LogEvent("tutorial_complete",
              new Parameter("duration_sec", (long)durationSec));
      }

      public static void LogDailyLogin(int consecutiveDays, string rewardType)
      {
          if (!_isEnabled) return;
          FirebaseAnalytics.LogEvent("daily_login",
              new Parameter("consecutive_days", consecutiveDays),
              new Parameter("reward_type", rewardType));
      }

      // ===== 사용자 속성 =====

      public static void SetUserTier(string tier)
      {
          FirebaseAnalytics.SetUserProperty("user_tier", tier);
      }

      public static void SetTotalSpend(float amountUsd)
      {
          FirebaseAnalytics.SetUserProperty(
              "total_spend", amountUsd.ToString("F2"));
      }
  }
  ```

  **예상 난이도**: 중
  **의존성**: 4.1 Firebase 초기화

---

### 4.3 Firebase Crashlytics

- [ ] **Crashlytics 커스텀 키 및 비치명적 오류 로깅 구현**

  **구현 설명**: 크래시 발생 시 디버그에 유용한 커스텀 키(마지막 화면, 점수, 메모리 등)를 설정하고, 광고 실패/결제 오류 등 비치명적 오류를 기록한다.

  **필요한 클래스/메서드**:
  - `CrashlyticsService.cs`
    - `SetCustomKey(string key, string value)`
    - `LogNonFatal(Exception ex, string context)`
    - `UpdateGameState(string screen, int score)`

  **코드 스니펫** (`CrashlyticsService.cs`):
  ```csharp
  using System;
  using Firebase.Crashlytics;
  using UnityEngine;

  public static class CrashlyticsService
  {
      /// <summary>
      /// 게임 상태를 Crashlytics 커스텀 키로 업데이트
      /// </summary>
      public static void UpdateGameState(string screen, int score)
      {
          Crashlytics.SetCustomKey("last_screen", screen);
          Crashlytics.SetCustomKey("game_score", score.ToString());
          Crashlytics.SetCustomKey("memory_usage",
              $"{SystemInfo.systemMemorySize}MB");
      }

      /// <summary>
      /// 비치명적 오류 기록
      /// </summary>
      public static void LogNonFatal(Exception ex, string context)
      {
          Crashlytics.SetCustomKey("error_context", context);
          Crashlytics.LogException(ex);
          Debug.LogWarning(
              $"[Crashlytics] 비치명적 오류 기록: {context} - {ex.Message}");
      }

      /// <summary>
      /// 광고 실패 기록
      /// </summary>
      public static void LogAdFailure(
          string network, string errorCode, string triggerPoint)
      {
          Crashlytics.SetCustomKey("ad_network", network);
          Crashlytics.Log(
              $"Ad load failed: network={network}," +
              $" error={errorCode}, trigger={triggerPoint}");
      }

      /// <summary>
      /// 세션 정보 갱신
      /// </summary>
      public static void SetSessionInfo(float durationSec)
      {
          Crashlytics.SetCustomKey(
              "session_duration", $"{durationSec:F0}s");
      }
  }
  ```

  **예상 난이도**: 하
  **의존성**: 4.1 Firebase 초기화

---

### 4.4 WebGL용 Firebase JS 브릿지

- [ ] **Firebase JS SDK를 WebGL에서 사용하기 위한 jslib 플러그인**

  **구현 설명**: WebGL 빌드에서는 Firebase Native SDK가 동작하지 않으므로, Firebase JS SDK(Modular v9)를 사용하는 jslib 플러그인을 작성하여 Analytics/Auth/Firestore를 호출한다.

  **필요한 파일**:
  - `Assets/Plugins/WebGL/FirebaseBridge.jslib`
  - `Assets/WebGLTemplates/HexaMerge/firebase-init.js` (index.html에 포함)

  **코드 스니펫** (`FirebaseBridge.jslib` 핵심 부분):
  ```javascript
  mergeInto(LibraryManager.library, {

    FirebaseLogEvent: function(eventNamePtr, paramsJsonPtr) {
      var eventName = UTF8ToString(eventNamePtr);
      var paramsJson = UTF8ToString(paramsJsonPtr);

      if (typeof window._firebaseAnalytics !== 'undefined') {
        var params = JSON.parse(paramsJson);
        // Firebase JS SDK v9 modular
        import('firebase/analytics').then(function(mod) {
          mod.logEvent(window._firebaseAnalytics, eventName, params);
        });
      }
    },

    FirebaseSetUserProperty: function(namePtr, valuePtr) {
      var name = UTF8ToString(namePtr);
      var value = UTF8ToString(valuePtr);

      if (typeof window._firebaseAnalytics !== 'undefined') {
        import('firebase/analytics').then(function(mod) {
          mod.setUserProperties(
            window._firebaseAnalytics, { [name]: value });
        });
      }
    },

    FirebaseSignInAnonymously: function() {
      if (typeof window._firebaseAuth !== 'undefined') {
        import('firebase/auth').then(function(mod) {
          mod.signInAnonymously(window._firebaseAuth)
            .then(function(result) {
              var uid = result.user.uid;
              // Unity로 콜백
              SendMessage('FirebaseInitializer',
                'OnAuthSuccess', uid);
            })
            .catch(function(error) {
              SendMessage('FirebaseInitializer',
                'OnAuthFailed', error.message);
            });
        });
      }
    }
  });
  ```

  **예상 난이도**: 상
  **의존성**: 4.1 Firebase 프로젝트, 1.2 커스텀 WebGL 템플릿

---

### 4.5 Firebase Remote Config (A/B 테스트)

- [ ] **Remote Config 초기화 및 값 적용 로직 구현**

  **구현 설명**: Firebase Remote Config를 사용하여 서버에서 게임 밸런스 값을 동적으로 변경하고, A/B 테스트를 수행한다. 앱 시작 시 fetch하여 적용한다.

  **필요한 클래스/메서드**:
  - `RemoteConfigService.cs`
    - `FetchAndActivate() : Task`
    - `GetInt(string key, int defaultValue) : int`
    - `GetString(string key, string defaultValue) : string`
    - `GetFloat(string key, float defaultValue) : float`

  **코드 스니펫** (`RemoteConfigService.cs`):
  ```csharp
  using System;
  using System.Collections.Generic;
  using System.Threading.Tasks;
  using Firebase.RemoteConfig;
  using UnityEngine;

  public class RemoteConfigService
  {
      private FirebaseRemoteConfig _config;
      private bool _isReady;

      // 기본값 정의
      private readonly Dictionary<string, object> _defaults = new()
      {
          { "hint_recovery_minutes", 10 },
          { "daily_ad_limit", 20 },
          { "ad_cooldown_same_trigger_sec", 180 },
          { "continue_popup_delay_sec", 0 },
          { "starter_pack_price_usd", 2.99 },
          { "daily_login_reward_type", "coins" },
          { "daily_login_reward_amount", 50 },
          { "score_boost_duration_sec", 60 },
      };

      public async Task Initialize()
      {
          _config = FirebaseRemoteConfig.DefaultInstance;

          await _config.SetDefaultsAsync(_defaults);

          var settings = new ConfigSettings
          {
              // 개발 중에는 짧은 캐시, 프로덕션은 12시간
              MinimumFetchIntervalInMilliseconds =
                  Debug.isDebugBuild ? 0 : 43200000
          };
          await _config.SetConfigSettingsAsync(settings);

          await FetchAndActivate();
      }

      public async Task FetchAndActivate()
      {
          try
          {
              await _config.FetchAsync(TimeSpan.Zero);
              bool activated = await _config.ActivateAsync();
              _isReady = true;
              Debug.Log($"[RemoteConfig] Fetch 완료, " +
                        $"활성화={activated}");
          }
          catch (Exception ex)
          {
              Debug.LogWarning(
                  $"[RemoteConfig] Fetch 실패 (기본값 사용): {ex.Message}");
              _isReady = true; // 기본값으로 진행
          }
      }

      public int GetInt(string key, int defaultValue = 0) =>
          _isReady
              ? (int)_config.GetValue(key).LongValue
              : defaultValue;

      public string GetString(string key, string defaultValue = "") =>
          _isReady
              ? _config.GetValue(key).StringValue
              : defaultValue;

      public float GetFloat(string key, float defaultValue = 0f) =>
          _isReady
              ? (float)_config.GetValue(key).DoubleValue
              : defaultValue;
  }
  ```

  **예상 난이도**: 중
  **의존성**: 4.1 Firebase 초기화

---

## 5. 보안 구현

> 설계문서 참조: 섹션 7 "보안"

### 5.1 데이터 암호화

- [ ] **AES-256 암호화/복호화 모듈 구현**

  **구현 설명**: 로컬 저장 데이터(세이브 파일, IndexedDB 값)를 AES-256-CBC로 암호화한다. 키는 기기 고유 값 + 앱 비밀 키 조합으로 파생한다.

  **필요한 클래스/메서드**:
  - `IDataEncryptor` (인터페이스)
    - `Encrypt(string plainText) : string`
    - `Decrypt(string cipherText) : string`
  - `AesDataEncryptor` (구현체)

  **코드 스니펫** (`AesDataEncryptor.cs`):
  ```csharp
  using System;
  using System.IO;
  using System.Security.Cryptography;
  using System.Text;
  using UnityEngine;

  public interface IDataEncryptor
  {
      string Encrypt(string plainText);
      string Decrypt(string cipherText);
  }

  public class AesDataEncryptor : IDataEncryptor
  {
      private readonly byte[] _key;   // 32 bytes (AES-256)
      private const int IV_SIZE = 16; // 128 bits

      public AesDataEncryptor()
      {
          // 기기 고유 값 + 앱 비밀 키로 키 파생
          string deviceId = SystemInfo.deviceUniqueIdentifier;
          string appSecret = "HexaMerge_S3cr3t_K3y_2026!";
          string combined = deviceId + appSecret;

          using (var sha256 = SHA256.Create())
          {
              _key = sha256.ComputeHash(
                  Encoding.UTF8.GetBytes(combined));
          }
      }

      public string Encrypt(string plainText)
      {
          using (var aes = Aes.Create())
          {
              aes.Key = _key;
              aes.Mode = CipherMode.CBC;
              aes.Padding = PaddingMode.PKCS7;
              aes.GenerateIV();

              using (var encryptor = aes.CreateEncryptor())
              using (var ms = new MemoryStream())
              {
                  // IV를 앞에 저장
                  ms.Write(aes.IV, 0, IV_SIZE);

                  using (var cs = new CryptoStream(
                      ms, encryptor, CryptoStreamMode.Write))
                  using (var sw = new StreamWriter(cs, Encoding.UTF8))
                  {
                      sw.Write(plainText);
                  }
                  return Convert.ToBase64String(ms.ToArray());
              }
          }
      }

      public string Decrypt(string cipherText)
      {
          byte[] fullCipher = Convert.FromBase64String(cipherText);

          byte[] iv = new byte[IV_SIZE];
          Array.Copy(fullCipher, 0, iv, 0, IV_SIZE);

          byte[] cipherBytes = new byte[fullCipher.Length - IV_SIZE];
          Array.Copy(fullCipher, IV_SIZE, cipherBytes, 0, cipherBytes.Length);

          using (var aes = Aes.Create())
          {
              aes.Key = _key;
              aes.IV = iv;
              aes.Mode = CipherMode.CBC;
              aes.Padding = PaddingMode.PKCS7;

              using (var decryptor = aes.CreateDecryptor())
              using (var ms = new MemoryStream(cipherBytes))
              using (var cs = new CryptoStream(
                  ms, decryptor, CryptoStreamMode.Read))
              using (var sr = new StreamReader(cs, Encoding.UTF8))
              {
                  return sr.ReadToEnd();
              }
          }
      }
  }
  ```

  **예상 난이도**: 중
  **의존성**: 없음

---

### 5.2 메모리 값 보호 (Anti-Cheat)

- [ ] **SecureInt / SecureFloat 구현 (메모리 값 XOR 암호화)**

  **구현 설명**: 점수, 코인 등 중요 정수/실수 값을 메모리에 평문으로 저장하지 않고 XOR + 솔트 방식으로 암호화한다. 메모리 스캐너(GameGuardian 등)에 의한 값 검색을 방지한다.

  **필요한 클래스/메서드**:
  - `SecureInt` (struct)
  - `SecureFloat` (struct)

  **코드 스니펫** (`SecureInt.cs`):
  ```csharp
  using System;
  using System.Security.Cryptography;
  using UnityEngine;

  [System.Serializable]
  public struct SecureInt
  {
      private int _encrypted;
      private int _key;
      private int _checksum;

      private static readonly int CHECKSUM_SALT =
          new System.Random().Next(int.MinValue, int.MaxValue);

      /// <summary>
      /// 현재 값을 읽거나 설정한다.
      /// </summary>
      public int Value
      {
          get
          {
              int decrypted = _encrypted ^ _key;
              if (ComputeChecksum(decrypted) != _checksum)
              {
                  // 변조 감지
                  Debug.LogError("[SecureInt] 메모리 변조 감지!");
                  OnTamperDetected?.Invoke();
                  return 0;
              }
              return decrypted;
          }
          set
          {
              _key = GenerateKey();
              _encrypted = value ^ _key;
              _checksum = ComputeChecksum(value);
          }
      }

      public static event Action OnTamperDetected;

      public SecureInt(int initialValue) : this()
      {
          Value = initialValue;
      }

      private static int GenerateKey()
      {
          byte[] bytes = new byte[4];
          using (var rng = RandomNumberGenerator.Create())
          {
              rng.GetBytes(bytes);
          }
          return BitConverter.ToInt32(bytes, 0);
      }

      private static int ComputeChecksum(int value)
      {
          return (value * 31 + 17) ^ CHECKSUM_SALT;
      }

      // 암시적 변환 연산자
      public static implicit operator int(SecureInt s) => s.Value;

      public override string ToString() => Value.ToString();
  }
  ```

  **예상 난이도**: 중
  **의존성**: 없음

---

### 5.3 스피드핵 감지

- [ ] **TimeValidator 구현 (스피드핵 감지 로직)**

  **구현 설명**: `Time.deltaTime`과 `Time.realtimeSinceStartup`의 비율을 모니터링하여 스피드핵 사용 여부를 판단한다. 비정상적인 시간 가속이 감지되면 이벤트를 로깅한다.

  **필요한 클래스/메서드**:
  - `TimeValidator.cs`
    - `Update()` (매 프레임 검증)
    - `IsSpeedHackDetected() : bool`

  **코드 스니펫** (`TimeValidator.cs`):
  ```csharp
  using UnityEngine;

  public class TimeValidator : MonoBehaviour
  {
      // 허용 오차 범위 (1.0 = 정상, 1.5 = 50% 가속까지 허용)
      private const float SPEED_THRESHOLD = 1.5f;
      private const int CHECK_INTERVAL_FRAMES = 60; // 60프레임마다 체크

      private float _lastRealTime;
      private float _lastGameTime;
      private int _frameCounter;
      private int _warningCount;

      public bool IsSpeedHackDetected { get; private set; }
      public event System.Action OnSpeedHackDetected;

      private void Start()
      {
          _lastRealTime = Time.realtimeSinceStartup;
          _lastGameTime = Time.time;
      }

      private void Update()
      {
          _frameCounter++;
          if (_frameCounter < CHECK_INTERVAL_FRAMES) return;
          _frameCounter = 0;

          float realElapsed = Time.realtimeSinceStartup - _lastRealTime;
          float gameElapsed = Time.time - _lastGameTime;

          _lastRealTime = Time.realtimeSinceStartup;
          _lastGameTime = Time.time;

          // realtime이 0이면 비교 불가
          if (realElapsed <= 0.001f) return;

          float ratio = gameElapsed / realElapsed;

          if (ratio > SPEED_THRESHOLD)
          {
              _warningCount++;
              Debug.LogWarning(
                  $"[TimeValidator] 시간 가속 감지: " +
                  $"ratio={ratio:F2}, warnings={_warningCount}");

              if (_warningCount >= 3)
              {
                  IsSpeedHackDetected = true;
                  OnSpeedHackDetected?.Invoke();

                  // Analytics 이벤트 전송
                  AnalyticsService.LogGameOver(0, 0, 0, 0);
                  CrashlyticsService.LogNonFatal(
                      new System.Exception("SpeedHack detected"),
                      $"ratio={ratio:F2}");
              }
          }
          else
          {
              // 정상이면 경고 카운트 감소
              _warningCount = Mathf.Max(0, _warningCount - 1);
          }
      }
  }
  ```

  **예상 난이도**: 중
  **의존성**: 4.2 AnalyticsService, 4.3 CrashlyticsService

---

### 5.4 루트/에뮬레이터 감지

- [ ] **DeviceIntegrityChecker 구현 (Android 루트/에뮬레이터 감지)**

  **구현 설명**: Android에서 루팅된 기기와 에뮬레이터를 감지한다. 감지 시 게임을 차단하지 않고 경고만 표시하며, 리더보드 등록에만 제한을 건다.

  **필요한 클래스/메서드**:
  - `DeviceIntegrityChecker.cs`
    - `IsRooted() : bool`
    - `IsEmulator() : bool`
    - `GetIntegrityReport() : DeviceIntegrityReport`

  **코드 스니펫** (`DeviceIntegrityChecker.cs`):
  ```csharp
  using UnityEngine;

  public static class DeviceIntegrityChecker
  {
      public struct DeviceIntegrityReport
      {
          public bool isRooted;
          public bool isEmulator;
          public bool isDebuggerAttached;
      }

      public static DeviceIntegrityReport CheckIntegrity()
      {
          var report = new DeviceIntegrityReport();

  #if UNITY_ANDROID && !UNITY_EDITOR
          report.isRooted = CheckRoot();
          report.isEmulator = CheckEmulator();
          report.isDebuggerAttached = CheckDebugger();
  #endif

          return report;
      }

  #if UNITY_ANDROID && !UNITY_EDITOR
      private static bool CheckRoot()
      {
          // su 바이너리 존재 확인
          string[] rootPaths = {
              "/system/app/Superuser.apk",
              "/system/bin/su",
              "/system/xbin/su",
              "/sbin/su",
              "/data/local/xbin/su",
              "/data/local/bin/su"
          };

          using (var javaFile = new AndroidJavaClass("java.io.File"))
          {
              foreach (string path in rootPaths)
              {
                  using (var file = new AndroidJavaObject("java.io.File", path))
                  {
                      if (file.Call<bool>("exists"))
                          return true;
                  }
              }
          }
          return false;
      }

      private static bool CheckEmulator()
      {
          string model = SystemInfo.deviceModel.ToLower();
          string device = SystemInfo.deviceName.ToLower();

          bool hasEmulatorMarker =
              model.Contains("sdk") ||
              model.Contains("emulator") ||
              model.Contains("google_sdk") ||
              device.Contains("generic") ||
              device.Contains("vbox") ||
              SystemInfo.deviceType == DeviceType.Desktop;

          return hasEmulatorMarker;
      }

      private static bool CheckDebugger()
      {
          using (var debug = new AndroidJavaClass("android.os.Debug"))
          {
              return debug.CallStatic<bool>("isDebuggerConnected");
          }
      }
  #endif
  }
  ```

  **예상 난이도**: 중
  **의존성**: 없음

---

### 5.5 점수 합리성 검증

- [ ] **ScoreValidator 구현 (클라이언트 + 서버 점수 검증)**

  **구현 설명**: 게임 종료 시 점수가 합리적인 범위 내에 있는지 검증한다. 플레이 시간 대비 최대 가능 점수, 합체 횟수 대비 점수, 이론적 최대 숫자 등을 체크한다.

  **필요한 클래스/메서드**:
  - `ScoreValidator.cs`
    - `ValidateScore(ScoreReport report) : ValidationResult`
  - `ScoreReport` (검증 데이터 구조체)
  - `ValidationResult` (검증 결과 enum)

  **코드 스니펫** (`ScoreValidator.cs`):
  ```csharp
  using UnityEngine;

  public enum ValidationResult
  {
      Valid,
      Suspicious,
      Invalid
  }

  [System.Serializable]
  public struct ScoreReport
  {
      public int finalScore;
      public int maxNumber;
      public int totalMerges;
      public float playDurationSec;
      public int continueCount;
  }

  public static class ScoreValidator
  {
      // 게임 밸런스 기반 상수
      private const int MAX_SCORE_PER_SECOND = 200;
      private const int MAX_POSSIBLE_NUMBER = 15;   // 이론적 최대
      private const float MIN_PLAY_DURATION = 10f;  // 최소 플레이 시간
      private const float MAX_SCORE_PER_MERGE = 500; // 합체당 최대 점수

      public static ValidationResult ValidateScore(ScoreReport report)
      {
          // 규칙 1: 플레이 시간 최소 검사
          if (report.playDurationSec < MIN_PLAY_DURATION
              && report.finalScore > 100)
          {
              Debug.LogWarning(
                  $"[ScoreValidator] 무효: 플레이 시간 {report.playDurationSec}s" +
                  $" 점수 {report.finalScore}");
              return ValidationResult.Invalid;
          }

          // 규칙 2: 이론적 최대 숫자 초과
          if (report.maxNumber > MAX_POSSIBLE_NUMBER)
          {
              Debug.LogWarning(
                  $"[ScoreValidator] 무효: 최대 숫자 {report.maxNumber}" +
                  $" > 이론적 최대 {MAX_POSSIBLE_NUMBER}");
              return ValidationResult.Invalid;
          }

          // 규칙 3: 초당 최대 점수 속도
          float scorePerSecond = report.finalScore /
              Mathf.Max(report.playDurationSec, 1f);
          if (scorePerSecond > MAX_SCORE_PER_SECOND)
          {
              Debug.LogWarning(
                  $"[ScoreValidator] 의심: 초당 점수 {scorePerSecond:F1}" +
                  $" > 최대 {MAX_SCORE_PER_SECOND}");
              return ValidationResult.Suspicious;
          }

          // 규칙 4: 합체 횟수 대비 점수 비정상
          if (report.totalMerges > 0)
          {
              float scorePerMerge = (float)report.finalScore / report.totalMerges;
              if (scorePerMerge > MAX_SCORE_PER_MERGE)
              {
                  Debug.LogWarning(
                      $"[ScoreValidator] 의심: 합체당 점수 {scorePerMerge:F1}" +
                      $" > 최대 {MAX_SCORE_PER_MERGE}");
                  return ValidationResult.Suspicious;
              }
          }

          return ValidationResult.Valid;
      }
  }
  ```

  **예상 난이도**: 중
  **의존성**: 없음

---

### 5.6 API 통신 보안

- [ ] **ApiClient 구현 (HMAC 서명 + JWT 인증 + 타임스탬프 검증)**

  **구현 설명**: 서버 API 호출 시 JWT 인증 토큰, HMAC-SHA256 요청 서명, 타임스탬프를 헤더에 포함한다. 서버에서는 5분 이내의 요청만 수락한다.

  **필요한 클래스/메서드**:
  - `SecureApiClient.cs`
    - `PostAsync<T>(string endpoint, object body) : Task<T>`
    - `GetAsync<T>(string endpoint) : Task<T>`
    - `ComputeHmac(string payload) : string`
    - `SetAuthToken(string jwt)`

  **코드 스니펫** (`SecureApiClient.cs`):
  ```csharp
  using System;
  using System.Net.Http;
  using System.Security.Cryptography;
  using System.Text;
  using System.Threading.Tasks;
  using UnityEngine;

  public class SecureApiClient
  {
      private readonly HttpClient _client;
      private string _authToken;
      private readonly string _hmacSecret;

      public SecureApiClient(string baseUrl, string hmacSecret)
      {
          _client = new HttpClient { BaseAddress = new Uri(baseUrl) };
          _hmacSecret = hmacSecret;
      }

      public void SetAuthToken(string jwt)
      {
          _authToken = jwt;
          _client.DefaultRequestHeaders.Authorization =
              new System.Net.Http.Headers.AuthenticationHeaderValue(
                  "Bearer", jwt);
      }

      public async Task<T> PostAsync<T>(string endpoint, object body)
      {
          string jsonBody = JsonUtility.ToJson(body);
          string timestamp = DateTimeOffset.UtcNow
              .ToUnixTimeMilliseconds().ToString();
          string requestId = Guid.NewGuid().ToString();

          // HMAC 서명 생성
          string signPayload = $"{endpoint}:{jsonBody}:{timestamp}";
          string signature = ComputeHmac(signPayload);

          var request = new HttpRequestMessage(
              HttpMethod.Post, endpoint)
          {
              Content = new StringContent(
                  jsonBody, Encoding.UTF8, "application/json")
          };

          request.Headers.Add("X-Request-ID", requestId);
          request.Headers.Add("X-Timestamp", timestamp);
          request.Headers.Add("X-Signature", signature);

          HttpResponseMessage response = await _client.SendAsync(request);
          string responseBody = await response.Content.ReadAsStringAsync();

          if (!response.IsSuccessStatusCode)
          {
              Debug.LogError(
                  $"[ApiClient] 요청 실패: {response.StatusCode}" +
                  $" - {responseBody}");
              throw new Exception($"API error: {response.StatusCode}");
          }

          return JsonUtility.FromJson<T>(responseBody);
      }

      private string ComputeHmac(string payload)
      {
          byte[] keyBytes = Encoding.UTF8.GetBytes(_hmacSecret);
          byte[] payloadBytes = Encoding.UTF8.GetBytes(payload);

          using (var hmac = new HMACSHA256(keyBytes))
          {
              byte[] hash = hmac.ComputeHash(payloadBytes);
              return Convert.ToBase64String(hash);
          }
      }
  }
  ```

  **예상 난이도**: 상
  **의존성**: Firebase Auth (JWT 토큰 발급)

---

### 5.7 민감 문자열 암호화

- [ ] **StringObfuscator 구현 (API 키, URL 런타임 복호화)**

  **구현 설명**: 빌드에 포함되는 API 키, 서버 URL 등 민감 문자열을 컴파일 시점에 암호화하고, 런타임에 복호화하여 사용한다. 디컴파일 시 평문 노출을 방지한다.

  **필요한 클래스/메서드**:
  - `StringObfuscator.cs`
    - `Obfuscate(string plain) : byte[]` (에디터 빌드 시)
    - `Deobfuscate(byte[] data) : string` (런타임)

  **코드 스니펫** (`StringObfuscator.cs`):
  ```csharp
  using System;
  using System.Text;

  public static class StringObfuscator
  {
      // 난독화 키 (빌드마다 변경 권장)
      private static readonly byte[] OBF_KEY = {
          0x48, 0x65, 0x78, 0x61, 0x4D, 0x65, 0x72, 0x67,
          0x65, 0x42, 0x61, 0x73, 0x69, 0x63, 0x32, 0x36
      };

      public static byte[] Obfuscate(string plain)
      {
          byte[] data = Encoding.UTF8.GetBytes(plain);
          byte[] result = new byte[data.Length];
          for (int i = 0; i < data.Length; i++)
          {
              result[i] = (byte)(data[i] ^ OBF_KEY[i % OBF_KEY.Length]);
          }
          return result;
      }

      public static string Deobfuscate(byte[] obfuscated)
      {
          byte[] result = new byte[obfuscated.Length];
          for (int i = 0; i < obfuscated.Length; i++)
          {
              result[i] = (byte)(obfuscated[i] ^ OBF_KEY[i % OBF_KEY.Length]);
          }
          return Encoding.UTF8.GetString(result);
      }
  }

  /// <summary>
  /// 암호화된 문자열을 ScriptableObject로 관리
  /// </summary>
  // [CreateAssetMenu(fileName = "SecureConfig",
  //    menuName = "Config/SecureConfig")]
  // public class SecureConfig : ScriptableObject
  // {
  //     [SerializeField] private byte[] apiBaseUrl;
  //     [SerializeField] private byte[] hmacSecret;
  //
  //     public string GetApiBaseUrl() =>
  //         StringObfuscator.Deobfuscate(apiBaseUrl);
  //     public string GetHmacSecret() =>
  //         StringObfuscator.Deobfuscate(hmacSecret);
  // }
  ```

  **예상 난이도**: 하
  **의존성**: 없음

---

## 6. CI/CD 파이프라인

### 6.1 GitHub Actions 워크플로우

- [ ] **Android AAB 빌드 워크플로우 구성**

  **구현 설명**: GitHub Actions에서 Unity Android AAB 빌드를 자동화한다. `main` 브랜치 push 또는 태그 생성 시 트리거되며, 빌드 결과물을 Artifact로 업로드한다.

  **필요한 파일**:
  - `.github/workflows/build-android.yml`
  - `Assets/Editor/BuildSettings/BuildScript.cs` (CLI 빌드 메서드)

  **설정 예시** (`.github/workflows/build-android.yml`):
  ```yaml
  name: Android Build

  on:
    push:
      tags: ['v*']
    workflow_dispatch:

  env:
    UNITY_VERSION: "6000.0.0f1"

  jobs:
    build-android:
      runs-on: ubuntu-latest
      timeout-minutes: 60

      steps:
        - name: Checkout
          uses: actions/checkout@v4
          with:
            lfs: true

        - name: Cache Library
          uses: actions/cache@v4
          with:
            path: Library
            key: Library-Android-${{ hashFiles('Assets/**', 'Packages/**') }}
            restore-keys: Library-Android-

        - name: Setup Unity
          uses: game-ci/unity-builder@v4
          env:
            UNITY_LICENSE: ${{ secrets.UNITY_LICENSE }}
          with:
            targetPlatform: Android
            buildMethod: BuildScript.BuildAndroidAAB
            versioning: Tag
            androidAppBundle: true
            androidKeystoreName: ${{ secrets.KEYSTORE_FILE }}
            androidKeystoreBase64: ${{ secrets.KEYSTORE_BASE64 }}
            androidKeystorePass: ${{ secrets.KEYSTORE_PASSWORD }}
            androidKeyaliasName: ${{ secrets.KEY_ALIAS }}
            androidKeyaliasPass: ${{ secrets.KEY_PASSWORD }}

        - name: Upload AAB
          uses: actions/upload-artifact@v4
          with:
            name: android-aab-${{ github.ref_name }}
            path: build/Android/*.aab
  ```

  **코드 스니펫** (`Assets/Editor/BuildSettings/BuildScript.cs`):
  ```csharp
  using UnityEditor;
  using UnityEngine;
  using System.IO;

  public static class BuildScript
  {
      private static readonly string[] GAME_SCENES = {
          "Assets/Scenes/Bootstrap.unity",
          "Assets/Scenes/MainMenu.unity",
          "Assets/Scenes/Game.unity"
      };

      public static void BuildAndroidAAB()
      {
          AndroidBuildConfig.ApplySettings();

          string buildPath = "build/Android/HexaMerge.aab";
          Directory.CreateDirectory(Path.GetDirectoryName(buildPath));

          var options = new BuildPlayerOptions
          {
              scenes = GAME_SCENES,
              locationPathName = buildPath,
              target = BuildTarget.Android,
              options = BuildOptions.None
          };

          var report = BuildPipeline.BuildPlayer(options);
          if (report.summary.result != UnityEditor.Build.Reporting.BuildResult.Succeeded)
          {
              Debug.LogError(
                  $"[Build] Android 빌드 실패: {report.summary.totalErrors} errors");
              EditorApplication.Exit(1);
          }
          else
          {
              Debug.Log("[Build] Android AAB 빌드 성공");
          }
      }

      public static void BuildWebGL()
      {
          WebGLBuildConfig.ApplySettings();

          string buildPath = "build/webgl";
          if (Directory.Exists(buildPath))
              Directory.Delete(buildPath, true);
          Directory.CreateDirectory(buildPath);

          var options = new BuildPlayerOptions
          {
              scenes = GAME_SCENES,
              locationPathName = buildPath,
              target = BuildTarget.WebGL,
              options = BuildOptions.None
          };

          var report = BuildPipeline.BuildPlayer(options);
          if (report.summary.result != UnityEditor.Build.Reporting.BuildResult.Succeeded)
          {
              Debug.LogError(
                  $"[Build] WebGL 빌드 실패: {report.summary.totalErrors} errors");
              EditorApplication.Exit(1);
          }
          else
          {
              Debug.Log("[Build] WebGL 빌드 성공");
          }
      }
  }
  ```

  **예상 난이도**: 상
  **의존성**: Unity 라이선스, GitHub Secrets 설정

---

- [ ] **WebGL 빌드 + Firebase Hosting 배포 워크플로우**

  **구현 설명**: WebGL 빌드 후 Firebase Hosting에 자동 배포한다. `main` 브랜치 push 시 프리뷰 채널에 배포, 태그 생성 시 라이브 채널에 배포한다.

  **필요한 파일**:
  - `.github/workflows/build-deploy-webgl.yml`

  **설정 예시** (`.github/workflows/build-deploy-webgl.yml`):
  ```yaml
  name: WebGL Build & Deploy

  on:
    push:
      branches: [main]
      tags: ['v*']
    workflow_dispatch:

  jobs:
    build-webgl:
      runs-on: ubuntu-latest
      timeout-minutes: 90

      steps:
        - name: Checkout
          uses: actions/checkout@v4
          with:
            lfs: true

        - name: Cache Library
          uses: actions/cache@v4
          with:
            path: Library
            key: Library-WebGL-${{ hashFiles('Assets/**', 'Packages/**') }}
            restore-keys: Library-WebGL-

        - name: Build WebGL
          uses: game-ci/unity-builder@v4
          env:
            UNITY_LICENSE: ${{ secrets.UNITY_LICENSE }}
          with:
            targetPlatform: WebGL
            buildMethod: BuildScript.BuildWebGL

        - name: Deploy to Firebase (Preview)
          if: github.ref == 'refs/heads/main'
          uses: FirebaseExtended/action-hosting-deploy@v0
          with:
            repoToken: ${{ secrets.GITHUB_TOKEN }}
            firebaseServiceAccount: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
            projectId: hexa-merge-basic
            channelId: preview

        - name: Deploy to Firebase (Live)
          if: startsWith(github.ref, 'refs/tags/v')
          uses: FirebaseExtended/action-hosting-deploy@v0
          with:
            repoToken: ${{ secrets.GITHUB_TOKEN }}
            firebaseServiceAccount: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
            projectId: hexa-merge-basic
            channelId: live
  ```

  **예상 난이도**: 상
  **의존성**: 6.1 Android 빌드 워크플로우 (공통 빌드 스크립트)

---

- [ ] **Google Play 자동 업로드 워크플로우**

  **구현 설명**: 태그 생성 시 빌드된 AAB를 Google Play Console 내부 테스트 트랙에 자동 업로드한다. `r8` 또는 `upload-google-play` 액션을 사용한다.

  **필요한 파일**:
  - `.github/workflows/build-android.yml` (기존 워크플로우에 step 추가)

  **설정 예시** (추가 step):
  ```yaml
        - name: Upload to Google Play (Internal Track)
          if: startsWith(github.ref, 'refs/tags/v')
          uses: r0adkll/upload-google-play@v1
          with:
            serviceAccountJsonPlainText: ${{ secrets.GOOGLE_PLAY_SERVICE_ACCOUNT }}
            packageName: com.hexamerge.basic
            releaseFiles: build/Android/*.aab
            track: internal
            status: completed
            changesNotSentForReview: true
  ```

  **예상 난이도**: 중
  **의존성**: Google Play Console 서비스 계정, 6.1 Android 빌드 워크플로우

---

### 6.2 빌드 버전 관리

- [ ] **자동 버전 넘버링 스크립트 구현**

  **구현 설명**: Git 태그 기반으로 `bundleVersion`(semver)과 `bundleVersionCode`(정수)를 자동 설정한다. CI 빌드 시 수동 버전 관리를 방지한다.

  **필요한 클래스/메서드**:
  - `Assets/Editor/BuildSettings/VersionManager.cs`
    - `ApplyVersionFromGitTag()`
    - `GetGitTag() : string`
    - `ComputeVersionCode(string semver) : int`

  **코드 스니펫** (`VersionManager.cs`):
  ```csharp
  using System.Diagnostics;
  using UnityEditor;
  using Debug = UnityEngine.Debug;

  public static class VersionManager
  {
      /// <summary>
      /// Git 태그에서 버전 정보를 읽어 Player Settings에 적용
      /// 태그 형식: v1.2.3
      /// </summary>
      public static void ApplyVersionFromGitTag()
      {
          string tag = GetGitTag();
          if (string.IsNullOrEmpty(tag) || !tag.StartsWith("v"))
          {
              Debug.LogWarning(
                  "[VersionManager] Git 태그 없음, 기본값 사용");
              return;
          }

          string semver = tag.Substring(1); // "v" 제거 -> "1.2.3"
          int versionCode = ComputeVersionCode(semver);

          PlayerSettings.bundleVersion = semver;
          PlayerSettings.Android.bundleVersionCode = versionCode;

          Debug.Log(
              $"[VersionManager] 버전 적용: {semver} (code={versionCode})");
      }

      private static string GetGitTag()
      {
          try
          {
              var proc = new Process
              {
                  StartInfo = new ProcessStartInfo
                  {
                      FileName = "git",
                      Arguments = "describe --tags --abbrev=0",
                      RedirectStandardOutput = true,
                      UseShellExecute = false,
                      CreateNoWindow = true
                  }
              };
              proc.Start();
              string output = proc.StandardOutput.ReadToEnd().Trim();
              proc.WaitForExit();
              return output;
          }
          catch { return null; }
      }

      /// <summary>
      /// "1.2.3" -> 10203 (major*10000 + minor*100 + patch)
      /// </summary>
      private static int ComputeVersionCode(string semver)
      {
          string[] parts = semver.Split('.');
          int major = parts.Length > 0 ? int.Parse(parts[0]) : 0;
          int minor = parts.Length > 1 ? int.Parse(parts[1]) : 0;
          int patch = parts.Length > 2 ? int.Parse(parts[2]) : 0;
          return major * 10000 + minor * 100 + patch;
      }
  }
  ```

  **예상 난이도**: 하
  **의존성**: Git 환경

---

## 구현 우선순위 및 일정 요약

| 우선순위 | 섹션 | 구현 항목 | 예상 기간 | 핵심 의존성 |
|---------|------|----------|----------|------------|
| 1 | 3.1 | SaveData 데이터 모델 정의 | 1일 | 없음 |
| 2 | 5.1 | AES-256 암호화 모듈 | 1일 | 없음 |
| 3 | 3.2 | 플랫폼별 로컬 저장 구현 | 3일 | 3.1, 5.1 |
| 4 | 3.3 | 설정값 저장 (경량) | 0.5일 | 없음 |
| 5 | 2.1 | Android Player Settings | 0.5일 | 없음 |
| 6 | 1.1 | WebGL Player Settings | 0.5일 | 없음 |
| 7 | 2.2 | ProGuard 규칙 | 0.5일 | 없음 |
| 8 | 2.3 | Gradle 템플릿 | 1일 | Firebase SDK |
| 9 | 4.1 | Firebase 초기화 | 2일 | Firebase Console |
| 10 | 4.2 | Analytics 이벤트 추적 | 2일 | 4.1 |
| 11 | 4.3 | Crashlytics 연동 | 1일 | 4.1 |
| 12 | 3.4 | 클라우드 저장 구현 | 3일 | 4.1 (Firebase Auth) |
| 13 | 3.5 | 데이터 동기화 관리자 | 3일 | 3.2, 3.4 |
| 14 | 3.6 | 오프라인 동기화 큐 | 2일 | 3.5 |
| 15 | 1.2 | 커스텀 WebGL 템플릿 | 2일 | 없음 |
| 16 | 1.3 | IndexedDB jslib 플러그인 | 2일 | 없음 |
| 17 | 4.4 | WebGL Firebase JS 브릿지 | 3일 | 4.1, 1.2 |
| 18 | 4.5 | Remote Config / A/B 테스트 | 2일 | 4.1 |
| 19 | 5.2 | SecureInt/SecureFloat | 1일 | 없음 |
| 20 | 5.3 | 스피드핵 감지 | 1일 | 없음 |
| 21 | 5.4 | 루트/에뮬레이터 감지 | 1일 | 없음 |
| 22 | 5.5 | 점수 합리성 검증 | 1일 | 없음 |
| 23 | 5.6 | API 통신 보안 | 2일 | Firebase Auth |
| 24 | 5.7 | 민감 문자열 암호화 | 0.5일 | 없음 |
| 25 | 1.4 | Addressable Assets 최적화 | 2일 | 없음 |
| 26 | 1.5 | Firebase Hosting 설정 | 1일 | Firebase CLI |
| 27 | 1.6 | SEO/메타데이터 | 0.5일 | 1.2 |
| 28 | 2.4 | 키스토어/앱 서명 | 1일 | Google Play Console |
| 29 | 2.5 | 네트워크 보안 설정 | 1일 | 5.6 |
| 30 | 6.1 | CI/CD 워크플로우 (Android) | 2일 | 전체 빌드 설정 |
| 31 | 6.1 | CI/CD 워크플로우 (WebGL) | 2일 | 전체 빌드 설정 |
| 32 | 6.2 | 빌드 버전 자동화 | 0.5일 | Git |

**총 예상 소요 기간**: 약 6~7주 (1인 기준)

---

## 의존성 그래프 (핵심)

```
[없음] ──> 3.1 SaveData 모델
[없음] ──> 5.1 AES-256 암호화
          │
          v
       3.2 로컬 저장 ──────────────────────┐
          │                                │
[Firebase Console] ──> 4.1 Firebase 초기화  │
                        │                  │
                        ├──> 4.2 Analytics │
                        ├──> 4.3 Crashlytics
                        └──> 3.4 클라우드 저장
                                  │        │
                                  v        v
                              3.5 동기화 관리자
                                  │
                                  v
                              3.6 오프라인 큐
```
