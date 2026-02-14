namespace HexaMerge.UI
{
    using UnityEngine;
    using System.Collections;
    using System.Collections.Generic;

    public enum ScreenType
    {
        None,
        MainMenu,
        Gameplay,
        Pause,
        Settings,
        Leaderboard,
        Shop
    }

    public class ScreenManager : MonoBehaviour
    {
        public static ScreenManager Instance { get; private set; }

        [System.Serializable]
        public struct ScreenEntry
        {
            public ScreenType type;
            public GameObject screenObject;
        }

        [SerializeField] private ScreenEntry[] screens;
        [SerializeField] private ScreenType initialScreen = ScreenType.Gameplay;
        [SerializeField] private float transitionDuration = 0.3f;

        private Dictionary<ScreenType, GameObject> screenLookup = new Dictionary<ScreenType, GameObject>();
        private ScreenType currentScreen = ScreenType.None;
        private bool isTransitioning;

        public ScreenType CurrentScreen => currentScreen;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;

            foreach (var entry in screens)
            {
                if (entry.screenObject != null)
                    screenLookup[entry.type] = entry.screenObject;
            }
        }

        private void Start()
        {
            HideAll();
            ShowScreen(initialScreen);
        }

        public void ShowScreen(ScreenType type)
        {
            if (isTransitioning || type == currentScreen) return;
            StartCoroutine(TransitionTo(type));
        }

        /// <summary>
        /// 진행 중인 전환을 강제 중단하고 즉시 새 전환을 시작한다 (테스트용).
        /// </summary>
        public void ForceShowScreen(ScreenType type)
        {
            StopAllCoroutines();
            isTransitioning = false;
            if (type == currentScreen) return;
            StartCoroutine(TransitionTo(type));
        }

        private IEnumerator TransitionTo(ScreenType type)
        {
            isTransitioning = true;

            if (currentScreen != ScreenType.None && screenLookup.ContainsKey(currentScreen))
            {
                var oldScreen = screenLookup[currentScreen];
                var oldCg = oldScreen.GetComponent<CanvasGroup>();
                if (oldCg != null)
                {
                    yield return FadeCanvasGroup(oldCg, 1f, 0f, transitionDuration);
                }
                oldScreen.SetActive(false);
            }

            currentScreen = type;

            if (screenLookup.ContainsKey(type))
            {
                var newScreen = screenLookup[type];
                newScreen.SetActive(true);
                var newCg = newScreen.GetComponent<CanvasGroup>();
                if (newCg != null)
                {
                    newCg.alpha = 0f;
                    yield return FadeCanvasGroup(newCg, 0f, 1f, transitionDuration);
                }
            }

            isTransitioning = false;
        }

        private IEnumerator FadeCanvasGroup(CanvasGroup cg, float from, float to, float duration)
        {
            float elapsed = 0f;
            while (elapsed < duration)
            {
                elapsed += Time.deltaTime;
                cg.alpha = Mathf.Lerp(from, to, elapsed / duration);
                yield return null;
            }
            cg.alpha = to;
        }

        private void HideAll()
        {
            foreach (var kvp in screenLookup)
            {
                kvp.Value.SetActive(false);
            }
        }

        public void GoBack()
        {
            if (currentScreen == ScreenType.Pause ||
                currentScreen == ScreenType.Settings ||
                currentScreen == ScreenType.Leaderboard ||
                currentScreen == ScreenType.Shop)
            {
                ShowScreen(ScreenType.Gameplay);
            }
        }
    }
}
