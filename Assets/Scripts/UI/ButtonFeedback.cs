namespace HexaMerge.UI
{
    using HexaMerge.Audio;
    using UnityEngine;
    using UnityEngine.UI;
    using UnityEngine.EventSystems;
    using System.Collections;

    /// <summary>
    /// 버튼에 부착하여 탭/클릭 시 시각 피드백(스케일 펀치)과 사운드를 재생합니다.
    /// </summary>
    [RequireComponent(typeof(Button))]
    public class ButtonFeedback : MonoBehaviour, IPointerDownHandler, IPointerUpHandler
    {
        [Header("Scale Feedback")]
        [SerializeField] private float pressScale = 0.9f;
        [SerializeField] private float releasePunchScale = 1.1f;
        [SerializeField] private float pressDuration = 0.08f;
        [SerializeField] private float releaseDuration = 0.12f;

        [Header("Audio")]
        [SerializeField] private bool playClickSound = true;

        private RectTransform rectTransform;
        private Coroutine currentAnimation;

        private void Awake()
        {
            rectTransform = (RectTransform)transform;
        }

        public void OnPointerDown(PointerEventData eventData)
        {
            if (currentAnimation != null)
                StopCoroutine(currentAnimation);

            currentAnimation = StartCoroutine(AnimateScale(pressScale, pressDuration));
        }

        public void OnPointerUp(PointerEventData eventData)
        {
            if (currentAnimation != null)
                StopCoroutine(currentAnimation);

            currentAnimation = StartCoroutine(ReleaseAnimation());

            if (playClickSound && AudioManager.Instance != null)
            {
                AudioManager.Instance.PlaySFX(SFXType.ButtonClick);
            }
        }

        private IEnumerator ReleaseAnimation()
        {
            // Phase 1: punch up
            yield return AnimateScale(releasePunchScale, releaseDuration * 0.4f);

            // Phase 2: settle back to normal
            yield return AnimateScale(1f, releaseDuration * 0.6f);

            currentAnimation = null;
        }

        private IEnumerator AnimateScale(float targetScale, float duration)
        {
            Vector3 startScale = rectTransform.localScale;
            Vector3 endScale = Vector3.one * targetScale;
            float elapsed = 0f;

            while (elapsed < duration)
            {
                elapsed += Time.unscaledDeltaTime;
                float t = Mathf.Clamp01(elapsed / duration);
                rectTransform.localScale = Vector3.Lerp(startScale, endScale, t);
                yield return null;
            }

            rectTransform.localScale = endScale;
        }

        private void OnDisable()
        {
            if (currentAnimation != null)
            {
                StopCoroutine(currentAnimation);
                currentAnimation = null;
            }
            rectTransform.localScale = Vector3.one;
        }
    }
}
