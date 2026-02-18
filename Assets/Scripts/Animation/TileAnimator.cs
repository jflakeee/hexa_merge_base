namespace HexaMerge.Animation
{
    using UnityEngine;
    using UnityEngine.UI;
    using System;
    using System.Collections;
    using System.Collections.Generic;

    public class TileAnimator : MonoBehaviour
    {
        public static TileAnimator Instance { get; private set; }

        [Header("Spawn Animation")]
        [SerializeField] private float spawnDuration = 0.2f;
        [SerializeField] private AnimationCurve spawnCurve = AnimationCurve.EaseInOut(0, 0, 1, 1);

        [Header("Merge Animation")]
        [SerializeField] private float mergeDuration = 0.25f;
        [SerializeField] private float mergeScalePunch = 1.3f;
        [SerializeField] private AnimationCurve mergeCurve = AnimationCurve.EaseInOut(0, 0, 1, 1);

        [Header("Score Popup")]
        [SerializeField] private float popupDuration = 0.8f;
        [SerializeField] private float popupRiseDistance = 100f;

        [Header("Game Over")]
        [SerializeField] private float shakeIntensity = 8f;
        [SerializeField] private float shakeDuration = 0.5f;
        [SerializeField] private int shakeVibrato = 12;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }

            Instance = this;
        }

        // ----------------------------------------------------------------
        // Spawn: scale 0 -> 1 with EaseOutBack
        // ----------------------------------------------------------------

        public Coroutine PlaySpawnAnimation(RectTransform target, Action onComplete = null)
        {
            if (target == null) { onComplete?.Invoke(); return null; }
            return StartCoroutine(SpawnCoroutine(target, onComplete));
        }

        private IEnumerator SpawnCoroutine(RectTransform target, Action onComplete)
        {
            target.localScale = Vector3.zero;
            float elapsed = 0f;
            float elasticDuration = 0.35f;

            while (elapsed < elasticDuration)
            {
                elapsed += Time.deltaTime;
                float t = Mathf.Clamp01(elapsed / elasticDuration);
                float eased = EaseOutElastic(t);
                target.localScale = Vector3.one * eased;
                yield return null;
            }

            target.localScale = Vector3.one;
            onComplete?.Invoke();
        }

        // ----------------------------------------------------------------
        // Merge: sources move toward target, then scale punch on target
        // ----------------------------------------------------------------

        public Coroutine PlayMergeAnimation(
            List<RectTransform> sources,
            RectTransform target,
            Action onComplete = null)
        {
            if (target == null) { onComplete?.Invoke(); return null; }
            return StartCoroutine(MergeCoroutine(sources, target, onComplete));
        }

        private IEnumerator MergeCoroutine(
            List<RectTransform> sources,
            RectTransform target,
            Action onComplete)
        {
            if (sources == null || sources.Count == 0)
            {
                yield return StartCoroutine(ScalePunchCoroutine(target, null));
                onComplete?.Invoke();
                yield break;
            }

            Vector2 targetPos = target.anchoredPosition;

            // Cache start positions
            var startPositions = new Vector2[sources.Count];
            for (int i = 0; i < sources.Count; i++)
            {
                startPositions[i] = sources[i] != null
                    ? sources[i].anchoredPosition
                    : targetPos;
            }

            // Animate all sources toward target simultaneously
            float elapsed = 0f;
            while (elapsed < mergeDuration)
            {
                elapsed += Time.deltaTime;
                float t = Mathf.Clamp01(elapsed / mergeDuration);
                float eased = mergeCurve.Evaluate(t);

                for (int i = 0; i < sources.Count; i++)
                {
                    if (sources[i] == null) continue;
                    sources[i].anchoredPosition = Vector2.Lerp(startPositions[i], targetPos, eased);
                    // Shrink as they approach
                    float scale = Mathf.Lerp(1f, 0f, eased);
                    sources[i].localScale = Vector3.one * scale;
                }

                yield return null;
            }

            // Hide sources
            for (int i = 0; i < sources.Count; i++)
            {
                if (sources[i] != null)
                    sources[i].gameObject.SetActive(false);
            }

            // Scale punch on the result tile
            yield return StartCoroutine(ScalePunchCoroutine(target, null));
            onComplete?.Invoke();
        }

        // ----------------------------------------------------------------
        // Single Merge Step: source -> target (sequential merge)
        // ----------------------------------------------------------------

        public Coroutine PlaySingleMergeStep(
            RectTransform source,
            RectTransform target,
            Action onComplete = null)
        {
            if (source == null || target == null) { onComplete?.Invoke(); return null; }
            return StartCoroutine(SingleMergeStepCoroutine(source, target, onComplete));
        }

        private IEnumerator SingleMergeStepCoroutine(
            RectTransform source, RectTransform target, Action onComplete)
        {
            Vector2 startPos = source.anchoredPosition;
            Vector2 targetPos = target.anchoredPosition;
            float duration = 0.15f;
            float elapsed = 0f;

            while (elapsed < duration)
            {
                elapsed += Time.deltaTime;
                float t = Mathf.Clamp01(elapsed / duration);
                float eased = mergeCurve.Evaluate(t);
                source.anchoredPosition = Vector2.Lerp(startPos, targetPos, eased);
                source.localScale = Vector3.one * Mathf.Lerp(1f, 0f, eased);
                yield return null;
            }

            source.gameObject.SetActive(false);

            // Mini scale punch on target
            yield return StartCoroutine(MiniScalePunch(target));
            onComplete?.Invoke();
        }

        private IEnumerator MiniScalePunch(RectTransform target)
        {
            float dur = 0.05f;
            yield return StartCoroutine(AnimateScale(target, Vector3.one,
                Vector3.one * 1.15f, dur, null, null));
            yield return StartCoroutine(AnimateScale(target, Vector3.one * 1.15f,
                Vector3.one, dur, null, null));
        }

        // ----------------------------------------------------------------
        // Simultaneous Disappear: all sources shrink in place at once
        // ----------------------------------------------------------------

        public Coroutine PlaySimultaneousDisappear(
            List<RectTransform> sources, Action onComplete = null)
        {
            if (sources == null || sources.Count == 0)
            {
                onComplete?.Invoke();
                return null;
            }
            return StartCoroutine(SimultaneousDisappearCoroutine(sources, onComplete));
        }

        private IEnumerator SimultaneousDisappearCoroutine(
            List<RectTransform> sources, Action onComplete)
        {
            float duration = 0.15f;
            float elapsed = 0f;

            while (elapsed < duration)
            {
                elapsed += Time.deltaTime;
                float t = Mathf.Clamp01(elapsed / duration);
                float scale = Mathf.Lerp(1f, 0f, t);

                for (int i = 0; i < sources.Count; i++)
                {
                    if (sources[i] != null)
                        sources[i].localScale = Vector3.one * scale;
                }
                yield return null;
            }

            for (int i = 0; i < sources.Count; i++)
            {
                if (sources[i] != null)
                    sources[i].gameObject.SetActive(false);
            }
            onComplete?.Invoke();
        }

        // ----------------------------------------------------------------
        // Scale Punch: 1 -> mergeScalePunch -> 1
        // ----------------------------------------------------------------

        public Coroutine PlayScalePunch(RectTransform target, Action onComplete = null)
        {
            if (target == null) { onComplete?.Invoke(); return null; }
            return StartCoroutine(ScalePunchCoroutine(target, onComplete));
        }

        private IEnumerator ScalePunchCoroutine(RectTransform target, Action onComplete)
        {
            float halfDuration = mergeDuration * 0.5f;

            // Phase 1: 1 -> mergeScalePunch
            yield return StartCoroutine(AnimateScale(
                target,
                Vector3.one,
                Vector3.one * mergeScalePunch,
                halfDuration,
                null,
                null));

            // Phase 2: mergeScalePunch -> 1
            yield return StartCoroutine(AnimateScale(
                target,
                Vector3.one * mergeScalePunch,
                Vector3.one,
                halfDuration,
                null,
                null));

            onComplete?.Invoke();
        }

        // ----------------------------------------------------------------
        // Score Popup: rise upward + fade out
        // ----------------------------------------------------------------

        public Coroutine PlayScorePopup(RectTransform popup, Action onComplete = null)
        {
            if (popup == null) { onComplete?.Invoke(); return null; }
            return StartCoroutine(ScorePopupCoroutine(popup, onComplete));
        }

        private IEnumerator ScorePopupCoroutine(RectTransform popup, Action onComplete)
        {
            CanvasGroup cg = popup.GetComponent<CanvasGroup>();
            if (cg == null) cg = popup.gameObject.AddComponent<CanvasGroup>();

            Vector2 startPos = popup.anchoredPosition;
            Vector2 endPos = startPos + Vector2.up * popupRiseDistance;
            cg.alpha = 1f;
            popup.localScale = Vector3.one;

            float elapsed = 0f;
            while (elapsed < popupDuration)
            {
                elapsed += Time.deltaTime;
                float t = Mathf.Clamp01(elapsed / popupDuration);

                popup.anchoredPosition = Vector2.Lerp(startPos, endPos, t);
                cg.alpha = 1f - EaseInQuad(t);

                // Slight scale-up at start
                float scaleT = t < 0.2f ? Mathf.Lerp(0.5f, 1.2f, t / 0.2f) : Mathf.Lerp(1.2f, 1f, (t - 0.2f) / 0.8f);
                popup.localScale = Vector3.one * scaleT;

                yield return null;
            }

            cg.alpha = 0f;
            popup.gameObject.SetActive(false);
            onComplete?.Invoke();
        }

        // ----------------------------------------------------------------
        // Game Over: board shake
        // ----------------------------------------------------------------

        public Coroutine PlayGameOverAnimation(RectTransform board, Action onComplete = null)
        {
            if (board == null) { onComplete?.Invoke(); return null; }
            return StartCoroutine(GameOverCoroutine(board, onComplete));
        }

        private IEnumerator GameOverCoroutine(RectTransform board, Action onComplete)
        {
            Vector2 originalPos = board.anchoredPosition;
            float elapsed = 0f;

            while (elapsed < shakeDuration)
            {
                elapsed += Time.deltaTime;
                float t = Mathf.Clamp01(elapsed / shakeDuration);
                float decay = 1f - t;

                // High-frequency sine-based shake
                float freq = shakeVibrato * Mathf.PI * 2f;
                float offsetX = Mathf.Sin(elapsed * freq) * shakeIntensity * decay;
                float offsetY = Mathf.Cos(elapsed * freq * 0.7f) * shakeIntensity * decay * 0.5f;

                board.anchoredPosition = originalPos + new Vector2(offsetX, offsetY);
                yield return null;
            }

            board.anchoredPosition = originalPos;
            onComplete?.Invoke();
        }

        // ----------------------------------------------------------------
        // Crown Transition: old crown fades out, new crown bounces in
        // ----------------------------------------------------------------

        [Header("Crown Animation")]
        [SerializeField] private float crownDuration = 0.35f;

        public Coroutine PlayCrownTransition(
            RectTransform oldCrown,
            RectTransform newCrown,
            Action onComplete = null)
        {
            return StartCoroutine(CrownTransitionCoroutine(oldCrown, newCrown, onComplete));
        }

        private IEnumerator CrownTransitionCoroutine(
            RectTransform oldCrown,
            RectTransform newCrown,
            Action onComplete)
        {
            // Phase 1: Fade out old crown (if exists)
            if (oldCrown != null)
            {
                CanvasGroup oldCg = oldCrown.GetComponent<CanvasGroup>();
                if (oldCg == null) oldCg = oldCrown.gameObject.AddComponent<CanvasGroup>();

                float elapsed = 0f;
                float halfDur = crownDuration * 0.4f;
                while (elapsed < halfDur)
                {
                    elapsed += Time.deltaTime;
                    float t = Mathf.Clamp01(elapsed / halfDur);
                    oldCg.alpha = 1f - t;
                    oldCrown.localScale = Vector3.one * Mathf.Lerp(1f, 0.5f, t);
                    yield return null;
                }

                oldCrown.gameObject.SetActive(false);
                oldCg.alpha = 1f;
                oldCrown.localScale = Vector3.one;
            }

            // Phase 2: Bounce in new crown
            if (newCrown != null)
            {
                newCrown.gameObject.SetActive(true);
                newCrown.localScale = Vector3.zero;

                CanvasGroup newCg = newCrown.GetComponent<CanvasGroup>();
                if (newCg == null) newCg = newCrown.gameObject.AddComponent<CanvasGroup>();
                newCg.alpha = 1f;

                float elapsed = 0f;
                float halfDur = crownDuration * 0.6f;
                while (elapsed < halfDur)
                {
                    elapsed += Time.deltaTime;
                    float t = Mathf.Clamp01(elapsed / halfDur);
                    float eased = EaseOutBack(t);
                    newCrown.localScale = Vector3.one * eased;
                    yield return null;
                }

                newCrown.localScale = Vector3.one;
            }

            onComplete?.Invoke();
        }

        // ----------------------------------------------------------------
        // Utility: AnimateScale
        // ----------------------------------------------------------------

        private IEnumerator AnimateScale(
            RectTransform target,
            Vector3 from,
            Vector3 to,
            float duration,
            AnimationCurve curve,
            Action onComplete)
        {
            if (target == null) { onComplete?.Invoke(); yield break; }

            target.localScale = from;
            float elapsed = 0f;

            while (elapsed < duration)
            {
                elapsed += Time.deltaTime;
                float t = Mathf.Clamp01(elapsed / duration);
                float eased = curve != null ? curve.Evaluate(t) : EaseOutQuad(t);
                target.localScale = Vector3.LerpUnclamped(from, to, eased);
                yield return null;
            }

            target.localScale = to;
            onComplete?.Invoke();
        }

        // ----------------------------------------------------------------
        // Utility: AnimatePosition
        // ----------------------------------------------------------------

        private IEnumerator AnimatePosition(
            RectTransform target,
            Vector2 from,
            Vector2 to,
            float duration,
            AnimationCurve curve,
            Action onComplete)
        {
            if (target == null) { onComplete?.Invoke(); yield break; }

            target.anchoredPosition = from;
            float elapsed = 0f;

            while (elapsed < duration)
            {
                elapsed += Time.deltaTime;
                float t = Mathf.Clamp01(elapsed / duration);
                float eased = curve != null ? curve.Evaluate(t) : EaseOutQuad(t);
                target.anchoredPosition = Vector2.LerpUnclamped(from, to, eased);
                yield return null;
            }

            target.anchoredPosition = to;
            onComplete?.Invoke();
        }

        // ----------------------------------------------------------------
        // Easing Functions
        // ----------------------------------------------------------------

        private static float EaseOutBack(float t)
        {
            const float c1 = 1.70158f;
            const float c3 = c1 + 1f;
            return 1f + c3 * Mathf.Pow(t - 1f, 3f) + c1 * Mathf.Pow(t - 1f, 2f);
        }

        private static float EaseOutQuad(float t)
        {
            return 1f - (1f - t) * (1f - t);
        }

        private static float EaseInQuad(float t)
        {
            return t * t;
        }

        private static float EaseInOutQuad(float t)
        {
            return t < 0.5f
                ? 2f * t * t
                : 1f - Mathf.Pow(-2f * t + 2f, 2f) * 0.5f;
        }

        private static float EaseOutElastic(float t)
        {
            if (t <= 0f) return 0f;
            if (t >= 1f) return 1f;
            float p = 0.3f;
            return Mathf.Pow(2f, -10f * t) * Mathf.Sin((t - p / 4f) * (2f * Mathf.PI) / p) + 1f;
        }
    }
}
