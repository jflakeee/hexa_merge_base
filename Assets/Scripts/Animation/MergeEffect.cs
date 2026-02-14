namespace HexaMerge.Animation
{
    using UnityEngine;
    using UnityEngine.UI;
    using System.Collections;

    public class MergeEffect : MonoBehaviour
    {
        public static MergeEffect Instance { get; private set; }

        [Header("Splash Effect")]
        [SerializeField] private GameObject splashPrefab;
        [SerializeField] private RectTransform effectContainer;
        [SerializeField] private int splashPoolSize = 10;

        [Header("Splash Settings")]
        [SerializeField] private float splashDuration = 0.4f;
        [SerializeField] private float splashMaxScale = 2.5f;
        [SerializeField] private int splashParticleCount = 6;

        [Header("Particle Settings")]
        [SerializeField] private float particleDuration = 0.5f;
        [SerializeField] private float particleSpeed = 200f;
        [SerializeField] private float particleSize = 12f;

        private GameObject[] splashPool;
        private int poolIndex;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }

            Instance = this;
            InitializePool();
        }

        // ----------------------------------------------------------------
        // Splash at merge position (color-matched)
        // ----------------------------------------------------------------

        public void PlayMergeSplash(Vector2 position, Color color, float scale = 1f)
        {
            GameObject splash = GetFromPool();
            if (splash == null) return;
            StartCoroutine(SplashCoroutine(splash, position, color, scale));
        }

        private IEnumerator SplashCoroutine(GameObject splash, Vector2 position, Color color, float scale)
        {
            splash.SetActive(true);

            RectTransform rt = splash.GetComponent<RectTransform>();
            Image img = splash.GetComponent<Image>();

            rt.anchoredPosition = position;
            rt.localScale = Vector3.zero;

            Color startColor = color;
            startColor.a = 0.8f;
            if (img != null) img.color = startColor;

            float elapsed = 0f;
            float targetScale = splashMaxScale * scale;

            while (elapsed < splashDuration)
            {
                elapsed += Time.deltaTime;
                float t = Mathf.Clamp01(elapsed / splashDuration);

                // Scale up with ease-out
                float eased = EaseOutQuad(t);
                rt.localScale = Vector3.one * Mathf.Lerp(0f, targetScale, eased);

                // Fade out
                if (img != null)
                {
                    Color c = startColor;
                    c.a = Mathf.Lerp(0.8f, 0f, t);
                    img.color = c;
                }

                yield return null;
            }

            splash.SetActive(false);
            rt.localScale = Vector3.zero;
        }

        // ----------------------------------------------------------------
        // Particle burst: radial debris flying outward
        // ----------------------------------------------------------------

        public void PlayParticleBurst(Vector2 position, Color color, int count)
        {
            if (count <= 0) count = splashParticleCount;
            float angleStep = 360f / count;

            for (int i = 0; i < count; i++)
            {
                GameObject particle = GetFromPool();
                if (particle == null) continue;

                float angle = angleStep * i + Random.Range(-15f, 15f);
                float rad = angle * Mathf.Deg2Rad;
                Vector2 direction = new Vector2(Mathf.Cos(rad), Mathf.Sin(rad));

                StartCoroutine(ParticleCoroutine(particle, position, direction, color));
            }
        }

        private IEnumerator ParticleCoroutine(
            GameObject particle,
            Vector2 startPos,
            Vector2 direction,
            Color color)
        {
            particle.SetActive(true);

            RectTransform rt = particle.GetComponent<RectTransform>();
            Image img = particle.GetComponent<Image>();

            rt.anchoredPosition = startPos;
            rt.sizeDelta = Vector2.one * particleSize;
            rt.localScale = Vector3.one;

            Color startColor = color;
            startColor.a = 1f;
            if (img != null) img.color = startColor;

            float speed = particleSpeed * Random.Range(0.7f, 1.3f);
            float elapsed = 0f;

            while (elapsed < particleDuration)
            {
                elapsed += Time.deltaTime;
                float t = Mathf.Clamp01(elapsed / particleDuration);

                // Move outward with deceleration
                float decel = 1f - EaseInQuad(t);
                rt.anchoredPosition = startPos + direction * (speed * t * decel + speed * 0.3f * t);

                // Shrink and fade
                float scale = Mathf.Lerp(1f, 0f, t);
                rt.localScale = Vector3.one * scale;

                if (img != null)
                {
                    Color c = startColor;
                    c.a = 1f - t;
                    img.color = c;
                }

                yield return null;
            }

            particle.SetActive(false);
            rt.localScale = Vector3.zero;
        }

        // ----------------------------------------------------------------
        // Combined: splash + particles
        // ----------------------------------------------------------------

        public void PlayMergeEffect(Vector2 position, Color color, float scale = 1f)
        {
            PlayMergeSplash(position, color, scale);
            PlayParticleBurst(position, color, splashParticleCount);
        }

        // ----------------------------------------------------------------
        // Object Pool
        // ----------------------------------------------------------------

        private void InitializePool()
        {
            if (splashPrefab == null || effectContainer == null) return;

            // Extra capacity for particles
            int totalPoolSize = splashPoolSize + splashParticleCount * 2;
            splashPool = new GameObject[totalPoolSize];
            poolIndex = 0;

            for (int i = 0; i < totalPoolSize; i++)
            {
                GameObject go = Instantiate(splashPrefab, effectContainer);
                go.SetActive(false);
                go.name = $"Effect_{i}";
                splashPool[i] = go;
            }
        }

        private GameObject GetFromPool()
        {
            if (splashPool == null || splashPool.Length == 0) return null;

            // Round-robin lookup
            int startIndex = poolIndex;
            do
            {
                GameObject candidate = splashPool[poolIndex];
                poolIndex = (poolIndex + 1) % splashPool.Length;

                if (!candidate.activeInHierarchy)
                    return candidate;

            } while (poolIndex != startIndex);

            // All active: reuse the oldest (current index)
            GameObject fallback = splashPool[poolIndex];
            poolIndex = (poolIndex + 1) % splashPool.Length;
            return fallback;
        }

        // ----------------------------------------------------------------
        // Easing Functions
        // ----------------------------------------------------------------

        private static float EaseOutQuad(float t)
        {
            return 1f - (1f - t) * (1f - t);
        }

        private static float EaseInQuad(float t)
        {
            return t * t;
        }
    }
}
