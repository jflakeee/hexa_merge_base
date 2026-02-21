#if UNITY_EDITOR
using System.IO;
using UnityEngine;
using UnityEngine.UI;
using UnityEngine.EventSystems;
using UnityEditor;

// Runtime namespaces
using HexaMerge.Game;
using HexaMerge.Core;
using HexaMerge.UI;
using HexaMerge.Audio;
using HexaMerge.Animation;
using HexaMerge.Input;

/// <summary>
/// Editor-only utility that builds the entire HexaMerge game scene
/// from scratch via  HexaMerge > Setup Game Scene.
/// Compatible with Unity 2020.3 (C# 7.3).
/// </summary>
public static class SceneSetup
{
    // ------------------------------------------------------------------ colours
    private static readonly Color Pink   = HexColor("#E91E63");
    private static readonly Color Purple = HexColor("#7B1FA2");
    private static readonly Color Grey   = new Color(0.6f, 0.6f, 0.6f, 1f);
    private static readonly Color Black  = Color.black;
    private static readonly Color White  = Color.white;

    // ------------------------------------------------------------------ entry
    [MenuItem("HexaMerge/Setup Game Scene")]
    public static void SetupGameScene()
    {
        // ---- 0. Ensure folders exist
        EnsureFolder("Assets/Prefabs");
        EnsureFolder("Assets/ScriptableObjects");

        // ---- 1. Main Camera
        Camera mainCam = SetupMainCamera();

        // ---- 2. Canvas ("GameCanvas")
        Canvas canvas = SetupCanvas(mainCam);
        RectTransform canvasRT = canvas.GetComponent<RectTransform>();

        // ---- 3. HUD
        GameObject hud = SetupHUD(canvasRT);

        // ---- 4. Board Container
        RectTransform boardContainer = SetupBoardContainer(canvasRT);

        // ---- 5. Ad Banner
        SetupAdBanner(canvasRT);

        // ---- 6. HexCell prefab
        GameObject hexCellPrefab = CreateHexCellPrefab();

        // ---- 7. SplashEffect prefab
        GameObject splashPrefab = CreateSplashEffectPrefab();

        // ---- 8. Manager objects
        SetupManagers(boardContainer, splashPrefab);

        // ---- 9. Controllers wired to Canvas / BoardContainer
        SetupControllers(canvas, boardContainer, hud, hexCellPrefab);

        // ---- 9b. Wire ThemeManager to background image and camera
        WireThemeManager(canvasRT, mainCam);

        // ---- 10. TileColorConfig ScriptableObject
        TileColorConfig colorConfig = CreateTileColorConfig();
        WireTileColorConfig(colorConfig);

        // ---- 11. Screen objects (GameOver, Pause)
        SetupScreens(canvasRT);

        // ---- finalise
        EditorUtility.SetDirty(canvas.gameObject);
        AssetDatabase.SaveAssets();
        AssetDatabase.Refresh();

        // Save scene file for build pipeline
        EnsureFolder("Assets/Scenes");
        var scene = UnityEditor.SceneManagement.EditorSceneManager.GetActiveScene();
        UnityEditor.SceneManagement.EditorSceneManager.SaveScene(scene, "Assets/Scenes/GameScene.unity");
        Debug.Log("[SceneSetup] Scene saved to Assets/Scenes/GameScene.unity");
        Debug.Log("[SceneSetup] Game scene setup complete.");
    }

    // ==================================================================
    // 1. Main Camera
    // ==================================================================
    private static Camera SetupMainCamera()
    {
        DestroyExisting("Main Camera");
        GameObject camGO = new GameObject("Main Camera");
        camGO.tag = "MainCamera";
        Camera cam = camGO.AddComponent<Camera>();
        cam.clearFlags = CameraClearFlags.SolidColor;
        cam.backgroundColor = Black;
        cam.orthographic = true;
        camGO.AddComponent<AudioListener>();
        Undo.RegisterCreatedObjectUndo(camGO, "Create Main Camera");
        return cam;
    }

    // ==================================================================
    // 2. Canvas ("GameCanvas")
    // ==================================================================
    private static Canvas SetupCanvas(Camera cam)
    {
        DestroyExisting("GameCanvas");
        DestroyExisting("EventSystem");

        // --- Canvas
        GameObject canvasGO = new GameObject("GameCanvas");
        Canvas canvas = canvasGO.AddComponent<Canvas>();
        canvas.renderMode = RenderMode.ScreenSpaceCamera;
        canvas.worldCamera = cam;

        CanvasScaler scaler = canvasGO.AddComponent<CanvasScaler>();
        scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
        scaler.referenceResolution = new Vector2(1080f, 1920f);
        scaler.matchWidthOrHeight = 0.5f;

        canvasGO.AddComponent<GraphicRaycaster>();
        canvasGO.AddComponent<CanvasGroup>();

        // Black background image
        GameObject bgGO = CreateUIObject("Background", canvasGO.transform);
        StretchFull(bgGO.GetComponent<RectTransform>());
        Image bgImg = bgGO.AddComponent<Image>();
        bgImg.color = Black;
        bgImg.raycastTarget = false;

        // --- EventSystem
        if (Object.FindObjectOfType<EventSystem>() == null)
        {
            GameObject esGO = new GameObject("EventSystem");
            esGO.AddComponent<EventSystem>();
            esGO.AddComponent<StandaloneInputModule>();
            Undo.RegisterCreatedObjectUndo(esGO, "Create EventSystem");
        }

        Undo.RegisterCreatedObjectUndo(canvasGO, "Create GameCanvas");
        return canvas;
    }

    // ==================================================================
    // 3. HUD
    // ==================================================================
    private static GameObject SetupHUD(RectTransform canvasRT)
    {
        GameObject hud = CreateUIObject("HUD", canvasRT);
        RectTransform hudRT = hud.GetComponent<RectTransform>();
        // top anchor, stretch horizontal
        hudRT.anchorMin = new Vector2(0f, 1f);
        hudRT.anchorMax = new Vector2(1f, 1f);
        hudRT.pivot = new Vector2(0.5f, 1f);
        hudRT.offsetMin = new Vector2(0f, -350f); // bottom edge 350px from top
        hudRT.offsetMax = new Vector2(0f, 0f);

        HUDManager hudMgr = hud.AddComponent<HUDManager>();

        // ---- Logo: "X" white + "UP" pink (two TMP texts side by side)
        GameObject logoContainer = CreateUIObject("LogoContainer", hudRT);
        RectTransform logoRT = logoContainer.GetComponent<RectTransform>();
        SetAnchored(logoRT, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(0.5f, 1f),
                    new Vector2(200f, 60f), new Vector2(0f, -20f));

        HorizontalLayoutGroup logoLayout = logoContainer.AddComponent<HorizontalLayoutGroup>();
        logoLayout.childAlignment = TextAnchor.MiddleCenter;
        logoLayout.spacing = 0f;
        logoLayout.childControlWidth = true;
        logoLayout.childControlHeight = true;
        logoLayout.childForceExpandWidth = false;
        logoLayout.childForceExpandHeight = false;

        Text logoX = CreateTMPText("LogoX", logoContainer.transform, "X", 48f, White, FontStyle.Bold);
        LayoutElement leX = logoX.gameObject.AddComponent<LayoutElement>();
        leX.preferredWidth = 50f;

        Text logoUP = CreateTMPText("LogoUP", logoContainer.transform, "UP", 48f, Pink, FontStyle.Bold);
        LayoutElement leUP = logoUP.gameObject.AddComponent<LayoutElement>();
        leUP.preferredWidth = 80f;

        // ---- SCORE label
        Text scoreLabel = CreateTMPText("ScoreLabel", hudRT, "SCORE", 24f, White, FontStyle.Bold);
        RectTransform scoreLabelRT = scoreLabel.GetComponent<RectTransform>();
        SetAnchored(scoreLabelRT, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(0.5f, 1f),
                    new Vector2(300f, 40f), new Vector2(0f, -100f));

        // ---- Score value
        Text scoreText = CreateTMPText("ScoreText", hudRT, "0", 64f, Pink, FontStyle.Bold);
        RectTransform scoreTextRT = scoreText.GetComponent<RectTransform>();
        SetAnchored(scoreTextRT, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(0.5f, 1f),
                    new Vector2(400f, 80f), new Vector2(0f, -150f));

        // ---- HI-SCORE label
        Text hiLabel = CreateTMPText("HiScoreLabel", hudRT, "HI-SCORE", 20f, Grey, FontStyle.Normal);
        RectTransform hiLabelRT = hiLabel.GetComponent<RectTransform>();
        SetAnchored(hiLabelRT, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(0.5f, 1f),
                    new Vector2(300f, 30f), new Vector2(0f, -230f));

        // ---- High score value
        Text hiScoreText = CreateTMPText("HighScoreText", hudRT, "0", 28f, Grey, FontStyle.Normal);
        RectTransform hiScoreTextRT = hiScoreText.GetComponent<RectTransform>();
        SetAnchored(hiScoreTextRT, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(0.5f, 1f),
                    new Vector2(300f, 40f), new Vector2(0f, -265f));

        // Pink hexagon sprite for HUD buttons
        Sprite hexBtnSprite = CreateHexButtonSprite(64);

        // ---- Sound button (left, pink hexagon)
        GameObject soundBtn = CreateButtonObject("SoundButton", hudRT, new Vector2(60f, 60f));
        RectTransform soundBtnRT = soundBtn.GetComponent<RectTransform>();
        SetAnchored(soundBtnRT, new Vector2(0f, 1f), new Vector2(0f, 1f), new Vector2(0f, 1f),
                    new Vector2(60f, 60f), new Vector2(50f, -30f));
        Image soundImg = soundBtn.GetComponent<Image>();
        soundImg.color = Pink;
        soundImg.sprite = hexBtnSprite;
        Text soundLabel = CreateTMPText("Icon", soundBtn.transform, "\u266A", 28f, White, FontStyle.Normal);
        StretchFull(soundLabel.GetComponent<RectTransform>());

        // ---- Menu button (right, pink hexagon)
        GameObject menuBtn = CreateButtonObject("MenuButton", hudRT, new Vector2(60f, 60f));
        RectTransform menuBtnRT = menuBtn.GetComponent<RectTransform>();
        SetAnchored(menuBtnRT, new Vector2(1f, 1f), new Vector2(1f, 1f), new Vector2(1f, 1f),
                    new Vector2(60f, 60f), new Vector2(-50f, -30f));
        Image menuImg = menuBtn.GetComponent<Image>();
        menuImg.color = Pink;
        menuImg.sprite = hexBtnSprite;
        Text menuLabel = CreateTMPText("Icon", menuBtn.transform, "\u2630", 28f, White, FontStyle.Normal);
        StretchFull(menuLabel.GetComponent<RectTransform>());

        // ---- Help button (right, below menu, pink hexagon)
        GameObject helpBtn = CreateButtonObject("HelpButton", hudRT, new Vector2(60f, 60f));
        RectTransform helpBtnRT = helpBtn.GetComponent<RectTransform>();
        SetAnchored(helpBtnRT, new Vector2(1f, 1f), new Vector2(1f, 1f), new Vector2(1f, 1f),
                    new Vector2(60f, 60f), new Vector2(-50f, -100f));
        Image helpImg = helpBtn.GetComponent<Image>();
        helpImg.color = Pink;
        helpImg.sprite = hexBtnSprite;
        Text helpLabel = CreateTMPText("Icon", helpBtn.transform, "?", 28f, White, FontStyle.Bold);
        StretchFull(helpLabel.GetComponent<RectTransform>());

        // ---- Wire HUDManager fields via SerializedObject
        SerializedObject soHud = new SerializedObject(hudMgr);
        soHud.FindProperty("scoreText").objectReferenceValue      = scoreText;
        soHud.FindProperty("highScoreText").objectReferenceValue   = hiScoreText;
        soHud.FindProperty("soundButton").objectReferenceValue     = soundBtn.GetComponent<Button>();
        soHud.FindProperty("menuButton").objectReferenceValue      = menuBtn.GetComponent<Button>();
        soHud.FindProperty("helpButton").objectReferenceValue      = helpBtn.GetComponent<Button>();
        soHud.ApplyModifiedPropertiesWithoutUndo();

        return hud;
    }

    // ==================================================================
    // 4. Board Container
    // ==================================================================
    private static RectTransform SetupBoardContainer(RectTransform canvasRT)
    {
        GameObject board = CreateUIObject("BoardContainer", canvasRT);
        RectTransform rt = board.GetComponent<RectTransform>();
        // Stretch from below HUD (top -350) to bottom of screen
        rt.anchorMin = new Vector2(0f, 0f);
        rt.anchorMax = new Vector2(1f, 1f);
        rt.pivot     = new Vector2(0.5f, 0.5f);
        rt.offsetMin = new Vector2(0f, 0f);     // left, bottom
        rt.offsetMax = new Vector2(0f, -400f);   // right, top (400px from top = below HUD + margin)
        return rt;
    }

    // ==================================================================
    // 5. Ad Banner
    // ==================================================================
    private static void SetupAdBanner(RectTransform canvasRT)
    {
        GameObject adGO = CreateUIObject("AdBanner", canvasRT);
        RectTransform rt = adGO.GetComponent<RectTransform>();
        rt.anchorMin = new Vector2(0f, 0f);
        rt.anchorMax = new Vector2(1f, 0f);
        rt.pivot     = new Vector2(0.5f, 0f);
        rt.sizeDelta = new Vector2(0f, 100f);
        rt.anchoredPosition = Vector2.zero;

        Image img = adGO.AddComponent<Image>();
        img.color = new Color(0.15f, 0.15f, 0.15f, 1f);
        img.raycastTarget = false;

        Text adLabel = CreateTMPText("AdLabel", rt, "AD BANNER", 20f, Grey, FontStyle.Normal);
        StretchFull(adLabel.GetComponent<RectTransform>());
    }

    // ==================================================================
    // 6. HexCell Prefab
    // ==================================================================
    private static GameObject CreateHexCellPrefab()
    {
        string prefabPath = "Assets/Prefabs/HexCell.prefab";

        // Build in-scene temp
        GameObject cellGO = new GameObject("HexCell");
        RectTransform cellRT = cellGO.AddComponent<RectTransform>();
        cellRT.sizeDelta = new Vector2(80f, 80f);

        // hexBackground image
        Image bgImage = cellGO.AddComponent<Image>();
        bgImage.color = White;
        bgImage.sprite = null;
        bgImage.raycastTarget = true;

        // Button
        Button btn = cellGO.AddComponent<Button>();
        btn.targetGraphic = bgImage;

        // Child: HighlightOverlay (renders on top of hexBackground, below text)
        GameObject highlightGO = new GameObject("HighlightOverlay");
        highlightGO.transform.SetParent(cellGO.transform, false);
        RectTransform hlRT = highlightGO.AddComponent<RectTransform>();
        StretchFull(hlRT);
        Image hlImage = highlightGO.AddComponent<Image>();
        hlImage.color = new Color(1f, 1f, 1f, 0.7f);
        hlImage.sprite = null; // will be set at runtime by HexCellView
        hlImage.raycastTarget = false;

        // Child: ValueText
        GameObject valueTxtGO = new GameObject("ValueText");
        valueTxtGO.transform.SetParent(cellGO.transform, false);
        RectTransform valRT = valueTxtGO.AddComponent<RectTransform>();
        StretchFull(valRT);

        Text valTMP = valueTxtGO.AddComponent<Text>();
        valTMP.text = "";
        valTMP.fontSize = 32;
        valTMP.color = White;
        valTMP.fontStyle = FontStyle.Bold;
        valTMP.alignment = TextAnchor.MiddleCenter;
        valTMP.raycastTarget = false;
        valTMP.horizontalOverflow = HorizontalWrapMode.Overflow;
        valTMP.verticalOverflow = VerticalWrapMode.Overflow;
        valTMP.font = Resources.GetBuiltinResource<Font>("Arial.ttf");

        // Child: CrownIcon (top-center)
        GameObject crownGO = new GameObject("CrownIcon");
        crownGO.transform.SetParent(cellGO.transform, false);
        RectTransform crownRT = crownGO.AddComponent<RectTransform>();
        crownRT.anchorMin = new Vector2(0.5f, 1f);
        crownRT.anchorMax = new Vector2(0.5f, 1f);
        crownRT.pivot     = new Vector2(0.5f, 1f);
        crownRT.sizeDelta = new Vector2(28f, 28f);
        crownRT.anchoredPosition = new Vector2(0f, -2f);

        Image crownImg = crownGO.AddComponent<Image>();
        crownImg.color = new Color(0f, 0f, 0f, 0f); // transparent bg
        crownImg.raycastTarget = false;

        // Crown text child
        GameObject crownTextGO = new GameObject("CrownText");
        crownTextGO.transform.SetParent(crownGO.transform, false);
        RectTransform crownTextRT = crownTextGO.AddComponent<RectTransform>();
        StretchFull(crownTextRT);
        Text crownTxt = crownTextGO.AddComponent<Text>();
        crownTxt.text = "\u265B";
        crownTxt.fontSize = 20;
        crownTxt.color = new Color(1f, 0.84f, 0f, 1f); // gold
        crownTxt.fontStyle = FontStyle.Normal;
        crownTxt.alignment = TextAnchor.MiddleCenter;
        crownTxt.raycastTarget = false;
        crownTxt.horizontalOverflow = HorizontalWrapMode.Overflow;
        crownTxt.verticalOverflow = VerticalWrapMode.Overflow;
        crownTxt.font = Resources.GetBuiltinResource<Font>("Arial.ttf");

        crownGO.SetActive(false);

        // HexCellView component + field wiring
        HexCellView cellView = cellGO.AddComponent<HexCellView>();
        SerializedObject soCellView = new SerializedObject(cellView);
        soCellView.FindProperty("hexBackground").objectReferenceValue    = bgImage;
        soCellView.FindProperty("valueText").objectReferenceValue      = valTMP;
        soCellView.FindProperty("crownIcon").objectReferenceValue      = crownGO;
        soCellView.FindProperty("highlightOverlay").objectReferenceValue = hlImage;
        soCellView.FindProperty("button").objectReferenceValue         = btn;
        soCellView.ApplyModifiedPropertiesWithoutUndo();

        // Save as prefab
        GameObject prefab = PrefabUtility.SaveAsPrefabAsset(cellGO, prefabPath);
        Object.DestroyImmediate(cellGO);
        Debug.Log("[SceneSetup] HexCell prefab created at " + prefabPath);
        return prefab;
    }

    // ==================================================================
    // 7. SplashEffect Prefab
    // ==================================================================
    private static GameObject CreateSplashEffectPrefab()
    {
        string prefabPath = "Assets/Prefabs/SplashEffect.prefab";

        GameObject go = new GameObject("SplashEffect");
        RectTransform rt = go.AddComponent<RectTransform>();
        rt.sizeDelta = new Vector2(200f, 200f);

        Image img = go.AddComponent<Image>();
        img.color = White;
        img.sprite = null;
        img.raycastTarget = false;

        GameObject prefab = PrefabUtility.SaveAsPrefabAsset(go, prefabPath);
        Object.DestroyImmediate(go);
        Debug.Log("[SceneSetup] SplashEffect prefab created at " + prefabPath);
        return prefab;
    }

    // ==================================================================
    // 8. Manager objects
    // ==================================================================
    private static void SetupManagers(RectTransform boardContainer, GameObject splashPrefab)
    {
        // --- GameManager
        DestroyExisting("GameManager");
        GameObject gmGO = new GameObject("GameManager");
        gmGO.AddComponent<GameManager>();
        gmGO.AddComponent<WebGLBridge>();
        gmGO.AddComponent<ThemeManager>();
        Undo.RegisterCreatedObjectUndo(gmGO, "Create GameManager");

        // --- AudioManager + SFXInitializer
        DestroyExisting("AudioManager");
        GameObject amGO = new GameObject("AudioManager");
        amGO.AddComponent<AudioManager>();
        amGO.AddComponent<SFXInitializer>();
        Undo.RegisterCreatedObjectUndo(amGO, "Create AudioManager");

        // --- AdManager
        DestroyExisting("AdManager");
        GameObject adGO = new GameObject("AdManager");
        adGO.AddComponent<AdManager>();
        Undo.RegisterCreatedObjectUndo(adGO, "Create AdManager");

        // --- IAPManager
        DestroyExisting("IAPManager");
        GameObject iapGO = new GameObject("IAPManager");
        iapGO.AddComponent<IAPManager>();
        Undo.RegisterCreatedObjectUndo(iapGO, "Create IAPManager");

        // --- TileAnimator
        DestroyExisting("TileAnimator");
        GameObject taGO = new GameObject("TileAnimator");
        taGO.AddComponent<TileAnimator>();
        Undo.RegisterCreatedObjectUndo(taGO, "Create TileAnimator");

        // --- MergeEffect
        DestroyExisting("MergeEffect");
        GameObject meGO = new GameObject("MergeEffect");
        MergeEffect me = meGO.AddComponent<MergeEffect>();
        Undo.RegisterCreatedObjectUndo(meGO, "Create MergeEffect");

        // Wire MergeEffect fields
        SerializedObject soME = new SerializedObject(me);
        soME.FindProperty("effectContainer").objectReferenceValue = boardContainer;
        soME.FindProperty("splashPrefab").objectReferenceValue    = splashPrefab;
        soME.ApplyModifiedPropertiesWithoutUndo();

        // --- GDPRConsentManager
        DestroyExisting("GDPRConsentManager");
        GameObject gdprGO = new GameObject("GDPRConsentManager");
        gdprGO.AddComponent<GDPRConsentManager>();
        Undo.RegisterCreatedObjectUndo(gdprGO, "Create GDPRConsentManager");

        // --- InputManager
        DestroyExisting("InputManager");
        GameObject imGO = new GameObject("InputManager");
        imGO.AddComponent<InputManager>();
        Undo.RegisterCreatedObjectUndo(imGO, "Create InputManager");

        // --- TestBridge (E2E 테스트용)
        DestroyExisting("TestBridge");
        GameObject tbGO = new GameObject("TestBridge");
        tbGO.AddComponent<TestBridge>();
        Undo.RegisterCreatedObjectUndo(tbGO, "Create TestBridge");

        // --- HexaTestBridge (애니메이션 테스트용)
        DestroyExisting("HexaTestBridge");
        GameObject htbGO = new GameObject("HexaTestBridge");
        htbGO.AddComponent<HexaTestBridge>();
        Undo.RegisterCreatedObjectUndo(htbGO, "Create HexaTestBridge");
    }

    // ==================================================================
    // 9. Controllers (BoardRenderer, GameplayController, ResponsiveLayout)
    // ==================================================================
    private static void SetupControllers(
        Canvas canvas,
        RectTransform boardContainer,
        GameObject hud,
        GameObject hexCellPrefab)
    {
        // ---- HexBoardRenderer on BoardContainer
        HexBoardRenderer boardRenderer = boardContainer.gameObject.GetComponent<HexBoardRenderer>();
        if (boardRenderer == null)
            boardRenderer = boardContainer.gameObject.AddComponent<HexBoardRenderer>();

        SerializedObject soBR = new SerializedObject(boardRenderer);
        soBR.FindProperty("hexCellPrefab").objectReferenceValue  = hexCellPrefab;
        soBR.FindProperty("boardContainer").objectReferenceValue = boardContainer;
        soBR.FindProperty("hexSpacing").floatValue = 0f;
        soBR.ApplyModifiedPropertiesWithoutUndo();

        // ---- GameplayController on Canvas
        GameplayController gc = canvas.gameObject.GetComponent<GameplayController>();
        if (gc == null)
            gc = canvas.gameObject.AddComponent<GameplayController>();

        HUDManager hudMgr = hud.GetComponent<HUDManager>();

        SerializedObject soGC = new SerializedObject(gc);
        soGC.FindProperty("boardRenderer").objectReferenceValue = boardRenderer;
        soGC.FindProperty("hudManager").objectReferenceValue    = hudMgr;
        soGC.ApplyModifiedPropertiesWithoutUndo();

        // ---- ResponsiveLayout on Canvas
        ResponsiveLayout rl = canvas.gameObject.GetComponent<ResponsiveLayout>();
        if (rl == null)
            rl = canvas.gameObject.AddComponent<ResponsiveLayout>();

        SerializedObject soRL = new SerializedObject(rl);
        soRL.FindProperty("boardContainer").objectReferenceValue = boardContainer;
        soRL.FindProperty("boardRenderer").objectReferenceValue  = boardRenderer;
        soRL.FindProperty("hudContainer").objectReferenceValue   = hud.GetComponent<RectTransform>();
        soRL.ApplyModifiedPropertiesWithoutUndo();
    }

    // ==================================================================
    // 10. TileColorConfig ScriptableObject
    // ==================================================================
    private static TileColorConfig CreateTileColorConfig()
    {
        string assetPath = "Assets/ScriptableObjects/TileColorConfig.asset";

        // Delete existing
        TileColorConfig existing = AssetDatabase.LoadAssetAtPath<TileColorConfig>(assetPath);
        if (existing != null)
        {
            AssetDatabase.DeleteAsset(assetPath);
        }

        TileColorConfig config = ScriptableObject.CreateInstance<TileColorConfig>();
        // Trigger Reset() to populate default entries by simulating it manually
        // (ScriptableObject.CreateInstance won't call Reset, so we replicate the data)
        config.defaultTextColor = Color.white;
        config.emptyColor = new Color(0.22f, 0.22f, 0.24f, 1f);
        config.entries = new TileColorConfig.TileColorEntry[]
        {
            MakeColorEntry(2,     "#FFD700", "#FFFFFF"),
            MakeColorEntry(4,     "#FF6B35", "#FFFFFF"),
            MakeColorEntry(8,     "#EC407A", "#FFFFFF"),
            MakeColorEntry(16,    "#880E4F", "#FFFFFF"),
            MakeColorEntry(32,    "#C2185B", "#FFFFFF"),
            MakeColorEntry(64,    "#8E24AA", "#FFFFFF"),
            MakeColorEntry(128,   "#4A148C", "#FFFFFF"),
            MakeColorEntry(256,   "#7C4DFF", "#FFFFFF"),
            MakeColorEntry(512,   "#1976D2", "#FFFFFF"),
            MakeColorEntry(1024,  "#00897B", "#FFFFFF"),
            MakeColorEntry(2048,  "#9ACD32", "#333333"),
            MakeColorEntry(4096,  "#4CAF50", "#FFFFFF"),
            MakeColorEntry(8192,  "#00695C", "#FFFFFF"),
            MakeColorEntry(16384, "#FFB300", "#333333"),
            MakeColorEntry(32768, "#E64A19", "#FFFFFF"),
            MakeColorEntry(65536, "#E91E63", "#FFFFFF"),
        };

        AssetDatabase.CreateAsset(config, assetPath);
        AssetDatabase.SaveAssets();
        Debug.Log("[SceneSetup] TileColorConfig asset created at " + assetPath);
        return config;
    }

    private static void WireThemeManager(RectTransform canvasRT, Camera mainCam)
    {
        ThemeManager tm = Object.FindObjectOfType<ThemeManager>();
        if (tm == null) return;

        // Find the Background image in the canvas
        Transform bgTransform = canvasRT.Find("Background");
        Image bgImage = bgTransform != null ? bgTransform.GetComponent<Image>() : null;

        SerializedObject soTM = new SerializedObject(tm);
        soTM.FindProperty("backgroundImage").objectReferenceValue = bgImage;
        soTM.FindProperty("mainCamera").objectReferenceValue = mainCam;
        soTM.ApplyModifiedPropertiesWithoutUndo();
    }

    private static void WireTileColorConfig(TileColorConfig config)
    {
        GameManager gm = Object.FindObjectOfType<GameManager>();
        if (gm == null) return;

        SerializedObject soGM = new SerializedObject(gm);
        soGM.FindProperty("tileColorConfig").objectReferenceValue = config;
        soGM.ApplyModifiedPropertiesWithoutUndo();
        EditorUtility.SetDirty(gm);
    }

    // ==================================================================
    // 11. Screen objects (GameOver, Pause) + ScreenManager
    // ==================================================================
    private static void SetupScreens(RectTransform canvasRT)
    {
        // ---- GameOverScreen panel (XUP-style banner: board visible behind)
        DestroyExistingChild("GameOverScreen", canvasRT);
        GameObject goScreen = CreateScreenPanel("GameOverScreen", canvasRT);
        GameOverScreen gos = goScreen.AddComponent<GameOverScreen>();

        // Panel: light dim overlay so board remains visible
        GameObject goPanel = CreateUIObject("Panel", goScreen.transform);
        StretchFull(goPanel.GetComponent<RectTransform>());
        Image goPanelImg = goPanel.AddComponent<Image>();
        goPanelImg.color = new Color(0f, 0f, 0f, 0.3f);
        goPanelImg.raycastTarget = true;

        // Purple banner: "NO MOVES LEFT!"
        GameObject purpleBanner = CreateUIObject("PurpleBanner", goPanel.transform);
        RectTransform purpleBannerRT = purpleBanner.GetComponent<RectTransform>();
        purpleBannerRT.anchorMin = new Vector2(0.03f, 1f);
        purpleBannerRT.anchorMax = new Vector2(0.97f, 1f);
        purpleBannerRT.pivot = new Vector2(0.5f, 1f);
        purpleBannerRT.sizeDelta = new Vector2(0f, 140f);
        purpleBannerRT.anchoredPosition = new Vector2(0f, -170f);
        Image purpleBannerImg = purpleBanner.AddComponent<Image>();
        purpleBannerImg.color = new Color(0.55f, 0.15f, 0.72f, 0.92f);

        Text goTitle = CreateTMPText("Title", purpleBanner.transform, "NO MOVES LEFT!", 52f, White, FontStyle.Bold);
        StretchFull(goTitle.GetComponent<RectTransform>());

        // Dark score bar below purple banner
        GameObject scoreBar = CreateUIObject("ScoreBar", goPanel.transform);
        RectTransform scoreBarRT = scoreBar.GetComponent<RectTransform>();
        scoreBarRT.anchorMin = new Vector2(0.03f, 1f);
        scoreBarRT.anchorMax = new Vector2(0.97f, 1f);
        scoreBarRT.pivot = new Vector2(0.5f, 1f);
        scoreBarRT.sizeDelta = new Vector2(0f, 110f);
        scoreBarRT.anchoredPosition = new Vector2(0f, -310f);
        Image scoreBarImg = scoreBar.AddComponent<Image>();
        scoreBarImg.color = new Color(0.1f, 0.1f, 0.12f, 0.95f);

        // SCORE label (top-left of score bar)
        Text scoreLabel = CreateTMPText("ScoreLabel", scoreBar.transform, "SCORE", 22f, White, FontStyle.Bold);
        RectTransform scoreLabelRT = scoreLabel.GetComponent<RectTransform>();
        scoreLabelRT.anchorMin = new Vector2(0f, 0.55f);
        scoreLabelRT.anchorMax = new Vector2(0.5f, 1f);
        scoreLabelRT.offsetMin = Vector2.zero;
        scoreLabelRT.offsetMax = Vector2.zero;

        // Score value (bottom-left of score bar, pink)
        Text goFinalScore = CreateTMPText("FinalScoreText", scoreBar.transform, "0", 44f, Pink, FontStyle.Bold);
        RectTransform goFSRT = goFinalScore.GetComponent<RectTransform>();
        goFSRT.anchorMin = new Vector2(0f, 0f);
        goFSRT.anchorMax = new Vector2(0.5f, 0.6f);
        goFSRT.offsetMin = Vector2.zero;
        goFSRT.offsetMax = Vector2.zero;

        // HI-SCORE label (top-right of score bar)
        Text hiLabel = CreateTMPText("HiScoreLabel", scoreBar.transform, "HI-SCORE", 22f, Grey, FontStyle.Bold);
        RectTransform hiLabelRT = hiLabel.GetComponent<RectTransform>();
        hiLabelRT.anchorMin = new Vector2(0.5f, 0.55f);
        hiLabelRT.anchorMax = new Vector2(1f, 1f);
        hiLabelRT.offsetMin = Vector2.zero;
        hiLabelRT.offsetMax = Vector2.zero;

        // Hi-Score value (bottom-right of score bar, white)
        Text goHiScore = CreateTMPText("HighScoreText", scoreBar.transform, "0", 44f, White, FontStyle.Bold);
        RectTransform goHSRT = goHiScore.GetComponent<RectTransform>();
        goHSRT.anchorMin = new Vector2(0.5f, 0f);
        goHSRT.anchorMax = new Vector2(1f, 0.6f);
        goHSRT.offsetMin = Vector2.zero;
        goHSRT.offsetMax = Vector2.zero;

        // New record label (below score bar, gold)
        Text goNewRecord = CreateTMPText("NewRecordLabel", goPanel.transform, "NEW RECORD!", 32f,
                                                     new Color(1f, 0.84f, 0f, 1f), FontStyle.Bold);
        RectTransform goNRRT = goNewRecord.GetComponent<RectTransform>();
        SetAnchored(goNRRT, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(0.5f, 1f),
                    new Vector2(400f, 50f), new Vector2(0f, -430f));

        // Restart button (below banner area)
        GameObject goRestartBtn = CreateButtonObject("RestartButton", goPanel.transform, new Vector2(300f, 70f));
        RectTransform goRestBtnRT = goRestartBtn.GetComponent<RectTransform>();
        SetAnchored(goRestBtnRT, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(0.5f, 1f),
                    new Vector2(300f, 70f), new Vector2(0f, -500f));
        goRestartBtn.GetComponent<Image>().color = Pink;
        Text restartLabel = CreateTMPText("Label", goRestartBtn.transform, "RESTART", 28f, White, FontStyle.Bold);
        StretchFull(restartLabel.GetComponent<RectTransform>());

        // Watch ad button (below restart)
        GameObject goWatchAdBtn = CreateButtonObject("WatchAdButton", goPanel.transform, new Vector2(300f, 60f));
        RectTransform goAdBtnRT = goWatchAdBtn.GetComponent<RectTransform>();
        SetAnchored(goAdBtnRT, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(0.5f, 1f),
                    new Vector2(300f, 60f), new Vector2(0f, -585f));
        goWatchAdBtn.GetComponent<Image>().color = new Color(0.3f, 0.3f, 0.3f, 1f);
        Text adBtnLabel = CreateTMPText("Label", goWatchAdBtn.transform, "WATCH AD", 24f, White, FontStyle.Normal);
        StretchFull(adBtnLabel.GetComponent<RectTransform>());

        CanvasGroup goCG = goScreen.GetComponent<CanvasGroup>();

        // Wire GameOverScreen
        SerializedObject soGOS = new SerializedObject(gos);
        soGOS.FindProperty("panel").objectReferenceValue          = goPanel;
        soGOS.FindProperty("finalScoreText").objectReferenceValue = goFinalScore;
        soGOS.FindProperty("highScoreText").objectReferenceValue  = goHiScore;
        soGOS.FindProperty("newRecordLabel").objectReferenceValue = goNewRecord;
        soGOS.FindProperty("restartButton").objectReferenceValue  = goRestartBtn.GetComponent<Button>();
        soGOS.FindProperty("watchAdButton").objectReferenceValue  = goWatchAdBtn.GetComponent<Button>();
        soGOS.FindProperty("canvasGroup").objectReferenceValue    = goCG;
        soGOS.ApplyModifiedPropertiesWithoutUndo();

        // GameOverScreen은 Start()에서 이벤트 구독이 필요하므로 루트 GO를 활성 유지
        // panel 자식만 Hide()로 숨김 (Start()에서 처리)

        // ---- PauseScreen panel (benchmark-style MENU screen)
        DestroyExistingChild("PauseScreen", canvasRT);
        GameObject pauseScreen = CreateScreenPanel("PauseScreen", canvasRT);
        PauseScreen ps = pauseScreen.AddComponent<PauseScreen>();

        GameObject pPanel = CreateUIObject("Panel", pauseScreen.transform);
        StretchFull(pPanel.GetComponent<RectTransform>());
        Image pPanelImg = pPanel.AddComponent<Image>();
        pPanelImg.color = new Color(0f, 0f, 0f, 0.85f);

        // Purple "MENU" header bar
        GameObject menuHeader = CreateUIObject("MenuHeader", pPanel.transform);
        RectTransform menuHeaderRT = menuHeader.GetComponent<RectTransform>();
        menuHeaderRT.anchorMin = new Vector2(0.05f, 1f);
        menuHeaderRT.anchorMax = new Vector2(0.95f, 1f);
        menuHeaderRT.pivot = new Vector2(0.5f, 1f);
        menuHeaderRT.sizeDelta = new Vector2(0f, 80f);
        menuHeaderRT.anchoredPosition = new Vector2(0f, -200f);
        Image menuHeaderImg = menuHeader.AddComponent<Image>();
        menuHeaderImg.color = Purple;
        Text menuTitle = CreateTMPText("Title", menuHeader.transform, "MENU", 40f, White, FontStyle.Bold);
        StretchFull(menuTitle.GetComponent<RectTransform>());

        // 2x2 icon grid container
        float gridTop = -310f;
        float iconSize = 110f;
        float iconGap = 20f;
        float gridCenterX = 0f;

        // Row 1: Rate (star) | Favorite (heart)
        GameObject rateBtn = CreateButtonObject("RateButton", pPanel.transform, new Vector2(iconSize, iconSize));
        RectTransform rateBtnRT = rateBtn.GetComponent<RectTransform>();
        SetAnchored(rateBtnRT, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(0.5f, 0.5f),
                    new Vector2(iconSize, iconSize), new Vector2(gridCenterX - iconSize/2 - iconGap/2, gridTop));
        rateBtn.GetComponent<Image>().color = HexColor("#FF9800");
        Text rateIcon = CreateTMPText("Icon", rateBtn.transform, "*", 40f, White, FontStyle.Bold);
        StretchFull(rateIcon.GetComponent<RectTransform>());

        GameObject favBtn = CreateButtonObject("FavoriteButton", pPanel.transform, new Vector2(iconSize, iconSize));
        RectTransform favBtnRT = favBtn.GetComponent<RectTransform>();
        SetAnchored(favBtnRT, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(0.5f, 0.5f),
                    new Vector2(iconSize, iconSize), new Vector2(gridCenterX + iconSize/2 + iconGap/2, gridTop));
        favBtn.GetComponent<Image>().color = HexColor("#E91E63");
        Text favIcon = CreateTMPText("Icon", favBtn.transform, "<3", 36f, White, FontStyle.Bold);
        StretchFull(favIcon.GetComponent<RectTransform>());

        // Row 2: Theme (sun/moon) | Leaderboard (trophy)
        float row2Y = gridTop - iconSize - iconGap;
        GameObject themeBtn = CreateButtonObject("ThemeButton", pPanel.transform, new Vector2(iconSize, iconSize));
        RectTransform themeBtnRT = themeBtn.GetComponent<RectTransform>();
        SetAnchored(themeBtnRT, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(0.5f, 0.5f),
                    new Vector2(iconSize, iconSize), new Vector2(gridCenterX - iconSize/2 - iconGap/2, row2Y));
        themeBtn.GetComponent<Image>().color = HexColor("#1565C0");

        // Theme icon as Image child (procedurally created at runtime by PauseScreen)
        GameObject themeIconObj = CreateUIObject("ThemeIcon", themeBtn.transform);
        RectTransform themeIconRT = themeIconObj.GetComponent<RectTransform>();
        themeIconRT.anchorMin = new Vector2(0.2f, 0.2f);
        themeIconRT.anchorMax = new Vector2(0.8f, 0.8f);
        themeIconRT.offsetMin = Vector2.zero;
        themeIconRT.offsetMax = Vector2.zero;
        Image themeIconImg = themeIconObj.AddComponent<Image>();
        themeIconImg.color = White;
        themeIconImg.raycastTarget = false;

        GameObject lbBtn = CreateButtonObject("LeaderboardButton", pPanel.transform, new Vector2(iconSize, iconSize));
        RectTransform lbBtnRT = lbBtn.GetComponent<RectTransform>();
        SetAnchored(lbBtnRT, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(0.5f, 0.5f),
                    new Vector2(iconSize, iconSize), new Vector2(gridCenterX + iconSize/2 + iconGap/2, row2Y));
        lbBtn.GetComponent<Image>().color = HexColor("#4CAF50");
        Text lbIcon = CreateTMPText("Icon", lbBtn.transform, "#1", 36f, White, FontStyle.Bold);
        StretchFull(lbIcon.GetComponent<RectTransform>());

        // RESTART button (outlined style)
        float btnY = row2Y - iconSize/2 - 60f;
        GameObject pRestartBtn = CreateButtonObject("RestartButton", pPanel.transform, new Vector2(400f, 70f));
        RectTransform pRestartBtnRT = pRestartBtn.GetComponent<RectTransform>();
        SetAnchored(pRestartBtnRT, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(0.5f, 0.5f),
                    new Vector2(400f, 70f), new Vector2(0f, btnY));
        pRestartBtn.GetComponent<Image>().color = new Color(0.3f, 0.3f, 0.35f, 1f);
        Text pRestartLabel = CreateTMPText("Label", pRestartBtn.transform, "RESTART", 28f, White, FontStyle.Bold);
        StretchFull(pRestartLabel.GetComponent<RectTransform>());

        // CONTINUE button (pink)
        float contY = btnY - 90f;
        GameObject pContinueBtn = CreateButtonObject("ContinueButton", pPanel.transform, new Vector2(400f, 70f));
        RectTransform pContinueBtnRT = pContinueBtn.GetComponent<RectTransform>();
        SetAnchored(pContinueBtnRT, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(0.5f, 0.5f),
                    new Vector2(400f, 70f), new Vector2(0f, contY));
        pContinueBtn.GetComponent<Image>().color = Pink;
        Text pContinueLabel = CreateTMPText("Label", pContinueBtn.transform, "CONTINUE", 28f, White, FontStyle.Bold);
        StretchFull(pContinueLabel.GetComponent<RectTransform>());

        // Wire PauseScreen
        SerializedObject soPS = new SerializedObject(ps);
        soPS.FindProperty("continueButton").objectReferenceValue     = pContinueBtn.GetComponent<Button>();
        soPS.FindProperty("restartButton").objectReferenceValue      = pRestartBtn.GetComponent<Button>();
        soPS.FindProperty("rateButton").objectReferenceValue         = rateBtn.GetComponent<Button>();
        soPS.FindProperty("favoriteButton").objectReferenceValue     = favBtn.GetComponent<Button>();
        soPS.FindProperty("themeButton").objectReferenceValue        = themeBtn.GetComponent<Button>();
        soPS.FindProperty("leaderboardButton").objectReferenceValue  = lbBtn.GetComponent<Button>();
        soPS.FindProperty("themeButtonImage").objectReferenceValue   = themeIconImg;
        soPS.ApplyModifiedPropertiesWithoutUndo();

        pauseScreen.SetActive(false);

        // ---- ShopScreen panel
        DestroyExistingChild("ShopScreen", canvasRT);
        GameObject shopScreen = CreateScreenPanel("ShopScreen", canvasRT);
        shopScreen.AddComponent<ShopScreen>();
        GameObject shopPanel = CreateUIObject("Panel", shopScreen.transform);
        StretchFull(shopPanel.GetComponent<RectTransform>());
        Image shopPanelImg = shopPanel.AddComponent<Image>();
        shopPanelImg.color = new Color(0f, 0f, 0f, 0.9f);
        Text shopTitle = CreateTMPText("Title", shopPanel.transform, "SHOP", 48f, White, FontStyle.Bold);
        RectTransform shopTitleRT = shopTitle.GetComponent<RectTransform>();
        SetAnchored(shopTitleRT, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(0.5f, 1f),
                    new Vector2(400f, 60f), new Vector2(0f, -60f));
        shopScreen.SetActive(false);

        // ---- LeaderboardScreen panel (full UI with ScrollView)
        DestroyExistingChild("LeaderboardScreen", canvasRT);
        GameObject lbScreen = CreateScreenPanel("LeaderboardScreen", canvasRT);
        LeaderboardScreen lbs = lbScreen.AddComponent<LeaderboardScreen>();

        GameObject lbPanel = CreateUIObject("Panel", lbScreen.transform);
        StretchFull(lbPanel.GetComponent<RectTransform>());
        Image lbPanelImg = lbPanel.AddComponent<Image>();
        lbPanelImg.color = new Color(0f, 0f, 0f, 0.9f);

        // Purple header
        GameObject lbHeader = CreateUIObject("Header", lbPanel.transform);
        RectTransform lbHeaderRT = lbHeader.GetComponent<RectTransform>();
        lbHeaderRT.anchorMin = new Vector2(0.05f, 1f);
        lbHeaderRT.anchorMax = new Vector2(0.95f, 1f);
        lbHeaderRT.pivot = new Vector2(0.5f, 1f);
        lbHeaderRT.sizeDelta = new Vector2(0f, 80f);
        lbHeaderRT.anchoredPosition = new Vector2(0f, -80f);
        Image lbHeaderImg = lbHeader.AddComponent<Image>();
        lbHeaderImg.color = Purple;
        Text lbTitle = CreateTMPText("Title", lbHeader.transform, "LEADERBOARD", 36f, White, FontStyle.Bold);
        StretchFull(lbTitle.GetComponent<RectTransform>());

        // ScrollView area for entries
        GameObject scrollView = CreateUIObject("ScrollView", lbPanel.transform);
        RectTransform scrollRT = scrollView.GetComponent<RectTransform>();
        scrollRT.anchorMin = new Vector2(0.05f, 0.15f);
        scrollRT.anchorMax = new Vector2(0.95f, 1f);
        scrollRT.pivot = new Vector2(0.5f, 1f);
        scrollRT.offsetMin = new Vector2(0f, 0f);
        scrollRT.offsetMax = new Vector2(0f, -180f);
        ScrollRect scrollRect = scrollView.AddComponent<ScrollRect>();
        scrollRect.horizontal = false;
        Image scrollBg = scrollView.AddComponent<Image>();
        scrollBg.color = new Color(0.1f, 0.1f, 0.12f, 0.5f);
        scrollView.AddComponent<Mask>().showMaskGraphic = true;

        // Content container (vertical layout)
        GameObject content = CreateUIObject("Content", scrollView.transform);
        RectTransform contentRT = content.GetComponent<RectTransform>();
        contentRT.anchorMin = new Vector2(0f, 1f);
        contentRT.anchorMax = new Vector2(1f, 1f);
        contentRT.pivot = new Vector2(0.5f, 1f);
        contentRT.sizeDelta = new Vector2(0f, 0f);
        contentRT.anchoredPosition = Vector2.zero;
        VerticalLayoutGroup vlg = content.AddComponent<VerticalLayoutGroup>();
        vlg.spacing = 4f;
        vlg.childAlignment = TextAnchor.UpperCenter;
        vlg.childControlWidth = true;
        vlg.childControlHeight = false;
        vlg.childForceExpandWidth = true;
        vlg.childForceExpandHeight = false;
        ContentSizeFitter csf = content.AddComponent<ContentSizeFitter>();
        csf.verticalFit = ContentSizeFitter.FitMode.PreferredSize;
        scrollRect.content = contentRT;

        // Entry prefab (created in-scene, then saved as prefab)
        GameObject entryPrefab = CreateUIObject("LeaderboardEntry", content.transform);
        RectTransform entryRT = entryPrefab.GetComponent<RectTransform>();
        entryRT.sizeDelta = new Vector2(0f, 60f);
        Image entryBg = entryPrefab.AddComponent<Image>();
        entryBg.color = new Color(0.15f, 0.15f, 0.18f, 0.8f);
        LayoutElement entryLE = entryPrefab.AddComponent<LayoutElement>();
        entryLE.preferredHeight = 60f;

        // Rank text (left)
        Text rankText = CreateTMPText("RankText", entryPrefab.transform, "#1", 24f, Pink, FontStyle.Bold);
        RectTransform rankRT = rankText.GetComponent<RectTransform>();
        rankRT.anchorMin = new Vector2(0f, 0f);
        rankRT.anchorMax = new Vector2(0.15f, 1f);
        rankRT.offsetMin = Vector2.zero;
        rankRT.offsetMax = Vector2.zero;

        // Score text (center)
        Text entryScoreText = CreateTMPText("ScoreText", entryPrefab.transform, "0", 26f, White, FontStyle.Bold);
        RectTransform entryScoreRT = entryScoreText.GetComponent<RectTransform>();
        entryScoreRT.anchorMin = new Vector2(0.15f, 0f);
        entryScoreRT.anchorMax = new Vector2(0.65f, 1f);
        entryScoreRT.offsetMin = Vector2.zero;
        entryScoreRT.offsetMax = Vector2.zero;

        // Date text (right)
        Text dateText = CreateTMPText("DateText", entryPrefab.transform, "", 18f, Grey, FontStyle.Normal);
        RectTransform dateRT = dateText.GetComponent<RectTransform>();
        dateRT.anchorMin = new Vector2(0.65f, 0f);
        dateRT.anchorMax = new Vector2(1f, 1f);
        dateRT.offsetMin = Vector2.zero;
        dateRT.offsetMax = Vector2.zero;

        entryPrefab.SetActive(false);

        // Close button (bottom)
        GameObject lbCloseBtn = CreateButtonObject("CloseButton", lbPanel.transform, new Vector2(400f, 70f));
        RectTransform lbCloseBtnRT = lbCloseBtn.GetComponent<RectTransform>();
        SetAnchored(lbCloseBtnRT, new Vector2(0.5f, 0f), new Vector2(0.5f, 0f), new Vector2(0.5f, 0f),
                    new Vector2(400f, 70f), new Vector2(0f, 40f));
        lbCloseBtn.GetComponent<Image>().color = Pink;
        Text lbCloseLabel = CreateTMPText("Label", lbCloseBtn.transform, "CLOSE", 28f, White, FontStyle.Bold);
        StretchFull(lbCloseLabel.GetComponent<RectTransform>());

        // Wire LeaderboardScreen
        SerializedObject soLB = new SerializedObject(lbs);
        soLB.FindProperty("entryContainer").objectReferenceValue = content.transform;
        soLB.FindProperty("entryPrefab").objectReferenceValue    = entryPrefab;
        soLB.FindProperty("closeButton").objectReferenceValue    = lbCloseBtn.GetComponent<Button>();
        soLB.FindProperty("titleText").objectReferenceValue      = lbTitle;
        soLB.ApplyModifiedPropertiesWithoutUndo();

        lbScreen.SetActive(false);

        // ---- HowToPlayScreen panel
        DestroyExistingChild("HowToPlayScreen", canvasRT);
        GameObject htpScreen = CreateScreenPanel("HowToPlayScreen", canvasRT);
        HowToPlayScreen htps = htpScreen.AddComponent<HowToPlayScreen>();

        GameObject htpPanel = CreateUIObject("Panel", htpScreen.transform);
        StretchFull(htpPanel.GetComponent<RectTransform>());
        Image htpPanelImg = htpPanel.AddComponent<Image>();
        htpPanelImg.color = new Color(0f, 0f, 0f, 0.9f);

        // Purple "HOW TO PLAY?" header
        GameObject htpHeader = CreateUIObject("Header", htpPanel.transform);
        RectTransform htpHeaderRT = htpHeader.GetComponent<RectTransform>();
        htpHeaderRT.anchorMin = new Vector2(0.05f, 1f);
        htpHeaderRT.anchorMax = new Vector2(0.95f, 1f);
        htpHeaderRT.pivot = new Vector2(0.5f, 1f);
        htpHeaderRT.sizeDelta = new Vector2(0f, 80f);
        htpHeaderRT.anchoredPosition = new Vector2(0f, -120f);
        Image htpHeaderImg = htpHeader.AddComponent<Image>();
        htpHeaderImg.color = Purple;
        Text htpTitle = CreateTMPText("Title", htpHeader.transform, "HOW TO PLAY?", 36f, White, FontStyle.Bold);
        StretchFull(htpTitle.GetComponent<RectTransform>());

        // Step 1: "TAP a number"
        float stepY = -240f;
        float stepH = 140f;
        Text step1Label = CreateTMPText("Step1", htpPanel.transform, "1. TAP a number block\n   to start a merge", 28f, White, FontStyle.Normal);
        RectTransform step1RT = step1Label.GetComponent<RectTransform>();
        step1Label.alignment = TextAnchor.MiddleLeft;
        SetAnchored(step1RT, new Vector2(0.1f, 1f), new Vector2(0.9f, 1f), new Vector2(0.5f, 1f),
                    new Vector2(0f, stepH), new Vector2(0f, stepY));

        // Step 2: "MATCH adjacent same numbers"
        Text step2Label = CreateTMPText("Step2", htpPanel.transform, "2. MATCH adjacent blocks\n   with the same number", 28f, White, FontStyle.Normal);
        RectTransform step2RT = step2Label.GetComponent<RectTransform>();
        step2Label.alignment = TextAnchor.MiddleLeft;
        SetAnchored(step2RT, new Vector2(0.1f, 1f), new Vector2(0.9f, 1f), new Vector2(0.5f, 1f),
                    new Vector2(0f, stepH), new Vector2(0f, stepY - stepH));

        // Step 3: "MERGE to create bigger numbers"
        Text step3Label = CreateTMPText("Step3", htpPanel.transform, "3. MERGE to create\n   bigger numbers!", 28f, White, FontStyle.Normal);
        RectTransform step3RT = step3Label.GetComponent<RectTransform>();
        step3Label.alignment = TextAnchor.MiddleLeft;
        SetAnchored(step3RT, new Vector2(0.1f, 1f), new Vector2(0.9f, 1f), new Vector2(0.5f, 1f),
                    new Vector2(0f, stepH), new Vector2(0f, stepY - stepH * 2));

        // Example: "4 + 4 + 4 = 32"
        Text exampleText = CreateTMPText("Example", htpPanel.transform,
            "Example:  4 + 4 + 4 = 32", 24f, Pink, FontStyle.Bold);
        RectTransform exRT = exampleText.GetComponent<RectTransform>();
        SetAnchored(exRT, new Vector2(0.1f, 1f), new Vector2(0.9f, 1f), new Vector2(0.5f, 1f),
                    new Vector2(0f, 50f), new Vector2(0f, stepY - stepH * 3));

        // GOT IT button
        GameObject gotItBtn = CreateButtonObject("GotItButton", htpPanel.transform, new Vector2(400f, 70f));
        RectTransform gotItBtnRT = gotItBtn.GetComponent<RectTransform>();
        SetAnchored(gotItBtnRT, new Vector2(0.5f, 0f), new Vector2(0.5f, 0f), new Vector2(0.5f, 0f),
                    new Vector2(400f, 70f), new Vector2(0f, 60f));
        gotItBtn.GetComponent<Image>().color = Pink;
        Text gotItLabel = CreateTMPText("Label", gotItBtn.transform, "GOT IT!", 28f, White, FontStyle.Bold);
        StretchFull(gotItLabel.GetComponent<RectTransform>());

        // Wire HowToPlayScreen
        SerializedObject soHTP = new SerializedObject(htps);
        soHTP.FindProperty("gotItButton").objectReferenceValue = gotItBtn.GetComponent<Button>();
        soHTP.ApplyModifiedPropertiesWithoutUndo();

        htpScreen.SetActive(false);

        // ---- ScreenManager on Canvas
        ScreenManager sm = canvasRT.gameObject.GetComponent<ScreenManager>();
        if (sm == null)
            sm = canvasRT.gameObject.AddComponent<ScreenManager>();

        SerializedObject soSM = new SerializedObject(sm);
        SerializedProperty screensProp = soSM.FindProperty("screens");
        screensProp.arraySize = 4;

        // Entry 0 : Pause
        SerializedProperty entry0 = screensProp.GetArrayElementAtIndex(0);
        entry0.FindPropertyRelative("type").enumValueIndex = (int)ScreenType.Pause;
        entry0.FindPropertyRelative("screenObject").objectReferenceValue = pauseScreen;

        // Entry 1 : Shop
        SerializedProperty entry1 = screensProp.GetArrayElementAtIndex(1);
        entry1.FindPropertyRelative("type").enumValueIndex = (int)ScreenType.Shop;
        entry1.FindPropertyRelative("screenObject").objectReferenceValue = shopScreen;

        // Entry 2 : Leaderboard
        SerializedProperty entry2 = screensProp.GetArrayElementAtIndex(2);
        entry2.FindPropertyRelative("type").enumValueIndex = (int)ScreenType.Leaderboard;
        entry2.FindPropertyRelative("screenObject").objectReferenceValue = lbScreen;

        // Entry 3 : HowToPlay
        SerializedProperty entry3 = screensProp.GetArrayElementAtIndex(3);
        entry3.FindPropertyRelative("type").enumValueIndex = (int)ScreenType.HowToPlay;
        entry3.FindPropertyRelative("screenObject").objectReferenceValue = htpScreen;

        // GameOverScreen은 자체 이벤트 관리 (OnStateChanged 구독)이므로 ScreenManager에 등록하지 않음

        soSM.FindProperty("initialScreen").enumValueIndex = (int)ScreenType.Gameplay;
        soSM.ApplyModifiedPropertiesWithoutUndo();
    }

    // ==================================================================
    // Helper: create a screen panel (stretch-full, CanvasGroup, inactive)
    // ==================================================================
    private static GameObject CreateScreenPanel(string name, RectTransform parent)
    {
        GameObject go = CreateUIObject(name, parent);
        StretchFull(go.GetComponent<RectTransform>());
        go.AddComponent<CanvasGroup>();
        return go;
    }

    // ==================================================================
    //  Helper utilities
    // ==================================================================

    private static void DestroyExisting(string name)
    {
        GameObject existing = GameObject.Find(name);
        if (existing != null)
        {
            Undo.DestroyObjectImmediate(existing);
        }
    }

    private static void DestroyExistingChild(string name, Transform parent)
    {
        Transform child = parent.Find(name);
        if (child != null)
        {
            Undo.DestroyObjectImmediate(child.gameObject);
        }
    }

    private static GameObject CreateUIObject(string name, Transform parent)
    {
        GameObject go = new GameObject(name);
        go.transform.SetParent(parent, false);
        go.AddComponent<RectTransform>();
        return go;
    }

    private static Text CreateTMPText(
        string name,
        Transform parent,
        string text,
        float fontSize,
        Color color,
        FontStyle style)
    {
        GameObject go = CreateUIObject(name, parent);
        Text txt = go.AddComponent<Text>();
        txt.text = text;
        txt.fontSize = (int)fontSize;
        txt.color = color;
        txt.fontStyle = style;
        txt.alignment = TextAnchor.MiddleCenter;
        txt.raycastTarget = false;
        txt.horizontalOverflow = HorizontalWrapMode.Overflow;
        txt.verticalOverflow = VerticalWrapMode.Overflow;
        txt.font = Resources.GetBuiltinResource<Font>("Arial.ttf");
        return txt;
    }

    private static GameObject CreateButtonObject(string name, Transform parent, Vector2 size)
    {
        GameObject go = CreateUIObject(name, parent);
        RectTransform rt = go.GetComponent<RectTransform>();
        rt.sizeDelta = size;

        Image img = go.AddComponent<Image>();
        img.color = White;
        img.raycastTarget = true;

        Button btn = go.AddComponent<Button>();
        btn.targetGraphic = img;

        return go;
    }

    private static void StretchFull(RectTransform rt)
    {
        rt.anchorMin = Vector2.zero;
        rt.anchorMax = Vector2.one;
        rt.offsetMin = Vector2.zero;
        rt.offsetMax = Vector2.zero;
    }

    private static void SetAnchored(
        RectTransform rt,
        Vector2 anchorMin,
        Vector2 anchorMax,
        Vector2 pivot,
        Vector2 sizeDelta,
        Vector2 anchoredPosition)
    {
        rt.anchorMin = anchorMin;
        rt.anchorMax = anchorMax;
        rt.pivot = pivot;
        rt.sizeDelta = sizeDelta;
        rt.anchoredPosition = anchoredPosition;
    }

    private static Color HexColor(string hex)
    {
        ColorUtility.TryParseHtmlString(hex, out Color c);
        return c;
    }

    private static TileColorConfig.TileColorEntry MakeColorEntry(int value, string hexBg, string hexText)
    {
        ColorUtility.TryParseHtmlString(hexBg, out Color bg);
        ColorUtility.TryParseHtmlString(hexText, out Color txt);
        TileColorConfig.TileColorEntry entry = new TileColorConfig.TileColorEntry();
        entry.value = value;
        entry.color = bg;
        entry.textColor = txt;
        return entry;
    }

    private static Sprite CreateHexButtonSprite(int size)
    {
        int texW = size;
        int texH = Mathf.RoundToInt(size * Mathf.Sqrt(3f) / 2f);
        Texture2D tex = new Texture2D(texW, texH, TextureFormat.RGBA32, false);
        Color32[] pixels = new Color32[texW * texH];
        Color32 white = new Color32(255, 255, 255, 255);
        Color32 clear = new Color32(0, 0, 0, 0);

        float cx = texW * 0.5f;
        float cy = texH * 0.5f;
        float radiusX = texW * 0.5f;
        float radiusY = texH * 0.5f;

        float[] vx = new float[6];
        float[] vy = new float[6];
        for (int i = 0; i < 6; i++)
        {
            float angle = Mathf.Deg2Rad * (60f * i);
            vx[i] = cx + radiusX * Mathf.Cos(angle);
            vy[i] = cy + radiusY * Mathf.Sin(angle);
        }

        for (int y = 0; y < texH; y++)
        {
            for (int x = 0; x < texW; x++)
            {
                pixels[y * texW + x] = PointInHexBtn(x + 0.5f, y + 0.5f, vx, vy) ? white : clear;
            }
        }

        tex.SetPixels32(pixels);
        tex.Apply();
        return Sprite.Create(tex, new Rect(0, 0, texW, texH), new Vector2(0.5f, 0.5f), 100f);
    }

    private static bool PointInHexBtn(float px, float py, float[] vx, float[] vy)
    {
        bool inside = false;
        for (int i = 0, j = 5; i < 6; j = i++)
        {
            if (((vy[i] > py) != (vy[j] > py)) &&
                (px < (vx[j] - vx[i]) * (py - vy[i]) / (vy[j] - vy[i]) + vx[i]))
            {
                inside = !inside;
            }
        }
        return inside;
    }

    private static void EnsureFolder(string path)
    {
        if (AssetDatabase.IsValidFolder(path)) return;

        string[] parts = path.Split('/');
        string current = parts[0]; // "Assets"
        for (int i = 1; i < parts.Length; i++)
        {
            string next = current + "/" + parts[i];
            if (!AssetDatabase.IsValidFolder(next))
            {
                AssetDatabase.CreateFolder(current, parts[i]);
            }
            current = next;
        }
    }
}
#endif
