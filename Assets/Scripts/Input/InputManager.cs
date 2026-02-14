namespace HexaMerge.Input
{
    using UnityEngine;
    using UnityEngine.EventSystems;
    using System;

    public class InputManager : MonoBehaviour
    {
        public static InputManager Instance { get; private set; }

        public event Action<Vector2> OnTap;

        [SerializeField] private float tapThreshold = 10f;

        private Vector2 touchStartPos;
        private bool isTouching;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }

            Instance = this;
        }

        private void Update()
        {
            if (UnityEngine.Input.touchCount > 0)
                HandleTouch();
            else
                HandleMouse();
        }

        private void HandleTouch()
        {
            Touch touch = UnityEngine.Input.GetTouch(0);

            switch (touch.phase)
            {
                case TouchPhase.Began:
                    touchStartPos = touch.position;
                    isTouching = true;
                    break;

                case TouchPhase.Ended:
                    if (isTouching)
                    {
                        float distance = Vector2.Distance(touch.position, touchStartPos);
                        if (distance < tapThreshold)
                        {
                            if (!IsPointerOverUI(touch.fingerId))
                                OnTap?.Invoke(touch.position);
                        }

                        isTouching = false;
                    }
                    break;

                case TouchPhase.Canceled:
                    isTouching = false;
                    break;
            }
        }

        private void HandleMouse()
        {
            if (UnityEngine.Input.GetMouseButtonDown(0))
            {
                touchStartPos = UnityEngine.Input.mousePosition;
                isTouching = true;
            }
            else if (UnityEngine.Input.GetMouseButtonUp(0) && isTouching)
            {
                float distance = Vector2.Distance(
                    (Vector2)UnityEngine.Input.mousePosition,
                    touchStartPos
                );

                if (distance < tapThreshold)
                    ProcessTap(UnityEngine.Input.mousePosition);

                isTouching = false;
            }
        }

        private void ProcessTap(Vector2 screenPosition)
        {
            if (EventSystem.current != null && EventSystem.current.IsPointerOverGameObject())
                return;

            OnTap?.Invoke(screenPosition);
        }

        private bool IsPointerOverUI(int fingerId)
        {
            if (EventSystem.current == null)
                return false;

            return EventSystem.current.IsPointerOverGameObject(fingerId);
        }
    }
}
