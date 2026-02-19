namespace HexaMerge.Animation
{
    using UnityEngine;
    using UnityEngine.UI;
    using System.Collections;
    using System.Collections.Generic;

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

        private static Sprite cachedSplatSprite;

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
        // Procedural Splat Sprite (paint splash shape)
        // ----------------------------------------------------------------

        private static Sprite GetOrCreateSplatSprite()
        {
            if (cachedSplatSprite != null) return cachedSplatSprite;

            int size = 256;
            Texture2D tex = new Texture2D(size, size, TextureFormat.RGBA32, false);
            Color32[] pixels = new Color32[size * size];
            Color32 white = new Color32(255, 255, 255, 255);
            Color32 clear = new Color32(0, 0, 0, 0);

            float cx = size * 0.5f;
            float cy = size * 0.5f;
            float baseRadius = size * 0.35f;

            // Pre-compute radius at each angle with noise (6~8 bumps)
            int bumps = 7;
            float[] bumpPhase = new float[bumps];
            float[] bumpAmp = new float[bumps];
            // Use deterministic seed for consistency
            Random.State oldState = Random.state;
            Random.InitState(42);
            for (int i = 0; i < bumps; i++)
            {
                bumpPhase[i] = Random.Range(0f, Mathf.PI * 2f);
                bumpAmp[i] = Random.Range(0.08f, 0.25f);
            }
            Random.state = oldState;

            for (int y = 0; y < size; y++)
            {
                for (int x = 0; x < size; x++)
                {
                    float dx = x - cx;
                    float dy = y - cy;
                    float dist = Mathf.Sqrt(dx * dx + dy * dy);
                    float angle = Mathf.Atan2(dy, dx);

                    // Compute noisy radius
                    float r = baseRadius;
                    for (int b = 0; b < bumps; b++)
                    {
                        float freq = (b + 1) * 1.0f;
                        r += baseRadius * bumpAmp[b] * Mathf.Sin(angle * freq + bumpPhase[b]);
                    }

                    // Anti-aliased edge
                    float edge = r - dist;
                    if (edge > 1.5f)
                    {
                        pixels[y * size + x] = white;
                    }
                    else if (edge > -0.5f)
                    {
                        byte a = (byte)(Mathf.Clamp01((edge + 0.5f) / 2f) * 255);
                        pixels[y * size + x] = new Color32(255, 255, 255, a);
                    }
                    else
                    {
                        pixels[y * size + x] = clear;
                    }
                }
            }

            tex.SetPixels32(pixels);
            tex.Apply();

            cachedSplatSprite = Sprite.Create(
                tex, new Rect(0, 0, size, size), new Vector2(0.5f, 0.5f), 100f);
            return cachedSplatSprite;
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
        // Splat Effect: expand -> hold -> shrink+fade (XUP style)
        // ----------------------------------------------------------------

        public void PlaySplatEffect(Vector2 sourcePosition, Vector2 targetPosition, Color color, int mergedCount)
        {
            GameObject splash = GetFromPool();
            if (splash == null) return;
            // 블럭 크기(~160px)보다 크지 않게 제한 (풀 오브젝트 200px 기준)
            float splatScale = Mathf.Clamp(mergedCount * 0.15f + 0.5f, 0.5f, 0.8f);
            StartCoroutine(SplatCoroutine(splash, sourcePosition, targetPosition, color, splatScale));
        }

        private IEnumerator SplatCoroutine(
            GameObject splash, Vector2 sourcePos, Vector2 targetPos, Color color, float maxScale)
        {
            splash.SetActive(true);
            RectTransform rt = splash.GetComponent<RectTransform>();
            Image img = splash.GetComponent<Image>();

            rt.anchoredPosition = sourcePos;
            rt.localScale = Vector3.zero;

            Color splatColor = color;
            splatColor.a = 0.9f;
            if (img != null) img.color = splatColor;

            // Phase 1: 소스 위치에 출현 (0.08s) — 빠른 splash 등장
            float expandDur = 0.08f;
            float elapsed = 0f;
            while (elapsed < expandDur)
            {
                elapsed += Time.deltaTime;
                float t = Mathf.Clamp01(elapsed / expandDur);
                float eased = EaseOutQuad(t);
                rt.localScale = Vector3.one * Mathf.Lerp(0f, maxScale, eased);
                yield return null;
            }

            // Phase 2: 타겟으로 흘러가기 (0.2s) — 점성 액체 스며드는 느낌
            float flowDur = 0.2f;
            elapsed = 0f;
            while (elapsed < flowDur)
            {
                elapsed += Time.deltaTime;
                float t = Mathf.Clamp01(elapsed / flowDur);
                // EaseIn 이동: 점성 액체처럼 점점 가속
                float moveT = t * t;
                rt.anchoredPosition = Vector2.Lerp(sourcePos, targetPos, moveT);
                // 흘러가면서 점차 축소
                float scale = Mathf.Lerp(maxScale, maxScale * 0.5f, t);
                rt.localScale = Vector3.one * scale;
                if (img != null)
                {
                    Color c = splatColor;
                    c.a = Mathf.Lerp(0.9f, 0.6f, t);
                    img.color = c;
                }
                yield return null;
            }

            // Phase 3: 타겟에서 흡수 (0.1s) — 스며들어 사라짐
            float absorbDur = 0.1f;
            elapsed = 0f;
            Vector3 peakScale = rt.localScale;
            while (elapsed < absorbDur)
            {
                elapsed += Time.deltaTime;
                float t = Mathf.Clamp01(elapsed / absorbDur);
                rt.localScale = Vector3.Lerp(peakScale, Vector3.zero, EaseInQuad(t));
                if (img != null)
                {
                    Color c = splatColor;
                    c.a = Mathf.Lerp(0.6f, 0f, t);
                    img.color = c;
                }
                yield return null;
            }

            splash.SetActive(false);
            rt.localScale = Vector3.zero;
        }

        // ----------------------------------------------------------------
        // Refill Particles: small colored circles at refill positions
        // ----------------------------------------------------------------

        public void PlayRefillParticles(List<Vector2> positions, List<Color> colors)
        {
            if (positions == null) return;

            for (int i = 0; i < positions.Count; i++)
            {
                Color col = (colors != null && i < colors.Count) ? colors[i] : Color.white;
                int count = Random.Range(3, 5); // 3~4 particles per cell
                float angleStep = 360f / count;

                for (int p = 0; p < count; p++)
                {
                    GameObject particle = GetFromPool();
                    if (particle == null) continue;

                    float angle = angleStep * p + Random.Range(-30f, 30f);
                    float rad = angle * Mathf.Deg2Rad;
                    Vector2 dir = new Vector2(Mathf.Cos(rad), Mathf.Sin(rad));

                    StartCoroutine(RefillParticleCoroutine(
                        particle, positions[i], dir, col));
                }
            }
        }

        private IEnumerator RefillParticleCoroutine(
            GameObject particle, Vector2 startPos, Vector2 direction, Color color)
        {
            particle.SetActive(true);

            RectTransform rt = particle.GetComponent<RectTransform>();
            Image img = particle.GetComponent<Image>();

            float size = Random.Range(8f, 14f);
            rt.anchoredPosition = startPos;
            rt.sizeDelta = Vector2.one * size;
            rt.localScale = Vector3.one;

            Color startColor = color;
            startColor.a = 0.9f;
            if (img != null) img.color = startColor;

            float speed = Random.Range(80f, 150f);
            float duration = Random.Range(0.3f, 0.5f);
            float elapsed = 0f;

            while (elapsed < duration)
            {
                elapsed += Time.deltaTime;
                float t = Mathf.Clamp01(elapsed / duration);

                // Move outward with deceleration
                float decel = 1f - t * t;
                rt.anchoredPosition = startPos + direction * (speed * t * decel);

                // Fade out
                float scale = Mathf.Lerp(1f, 0.2f, t);
                rt.localScale = Vector3.one * scale;

                if (img != null)
                {
                    Color c = startColor;
                    c.a = Mathf.Lerp(0.9f, 0f, t);
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

            // Extra capacity for particles + refill particles
            int totalPoolSize = splashPoolSize + splashParticleCount * 4;
            splashPool = new GameObject[totalPoolSize];
            poolIndex = 0;

            Sprite splatSprite = GetOrCreateSplatSprite();

            for (int i = 0; i < totalPoolSize; i++)
            {
                GameObject go = Instantiate(splashPrefab, effectContainer);
                go.SetActive(false);
                go.name = string.Format("Effect_{0}", i);

                // Apply splat sprite and enlarged size
                RectTransform rt = go.GetComponent<RectTransform>();
                if (rt != null)
                    rt.sizeDelta = new Vector2(200f, 200f);

                Image img = go.GetComponent<Image>();
                if (img != null && splatSprite != null)
                    img.sprite = splatSprite;

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
