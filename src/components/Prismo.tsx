type PrismoProps = {
  className?: string;
  /** Show a soft contact shadow on the floor beneath Prismo. */
  shadow?: boolean;
};

/**
 * Prismo — the one-eyed mascot, built from the canonical brand vector.
 *
 * The pink body path is drawn on top of the eye with a hole cut out for it,
 * so the yellow sclera + blue iris show through and the body frames the eye.
 *
 * Animated via CSS keyframes in globals.css:
 *   - idle breathing + a gentle sway about the feet
 *   - blinking (a skin-coloured lid drops over the eye)
 *   - glancing (the iris drifts within the eye)
 */
export default function Prismo({ className, shadow = true }: PrismoProps) {
  return (
    <svg
      className={`prismo-svg ${className ?? ""}`}
      viewBox="235 -12 228 312"
      role="img"
      aria-label="Prismo, a friendly one-eyed character"
      xmlns="http://www.w3.org/2000/svg"
    >
      {shadow && (
        <ellipse
          className="prismo-contact"
          cx="349"
          cy="287"
          rx="96"
          ry="13"
          fill="var(--contact-shadow)"
        />
      )}

      <g className="prismo-sway">
        <g className="prismo-breathe">
          {/* Eye — sits behind the body and shows through the cut-out */}
          <ellipse cx="373.5" cy="78" rx="25.5" ry="14" fill="var(--eye-sclera)" />
          <g className="prismo-iris">
            <circle cx="374" cy="78" r="11" fill="var(--eye-iris)" />
          </g>

          {/* Body — canonical Prismo silhouette with the eye cut out */}
          <path
            d="M358.5 0C368.073 0 376.309 5.60289 379.972 13.6406C381.745 13.2222 383.596 13 385.5 13C397.167 13 406.846 21.3219 408.684 32.2314C424.549 46.5858 434.527 66.434 434.981 88.4287L452.457 110.602C454.01 111.885 455 113.827 455 116C455 119.764 452.03 122.832 448.306 122.992L425.645 126.379C424.813 127.9 423.927 129.391 422.996 130.854L423.091 130.001C420.494 129.716 418.032 129.464 415.692 129.242C412.484 128.532 408.249 128.001 403.593 127.798C401.1 127.689 398.719 127.685 396.545 127.771C393.349 127.618 388.846 127.924 383.916 128.715C375.068 130.135 368.017 132.61 367.541 134.398L367.529 134.396C367.489 134.588 367.492 134.789 367.56 134.985C367.627 135.181 367.746 135.344 367.894 135.477C368.176 135.73 368.588 135.898 369.068 136.021C370.041 136.271 371.549 136.394 373.643 136.421C377.844 136.475 384.576 136.138 394.514 135.5H419.809C408.066 151.389 390.347 163.232 369.626 168.293C369.868 169.154 370 170.062 370 171V216H409.708C414.517 216 418.645 219.423 419.535 224.148L428.794 273.291C429.945 279.4 425.301 285.068 419.085 285.142L274.558 286.856C268.294 286.931 263.505 281.293 264.591 275.124L273.545 224.266C274.387 219.485 278.54 216 283.394 216H324V171C324 170.062 324.131 169.155 324.372 168.295C320.587 167.37 316.901 166.22 313.334 164.859C310.884 165.597 308.247 166 305.5 166C293.295 166 283.264 158.081 282.111 147.951C281.579 147.982 281.042 148 280.5 148C267.521 148 257 139.046 257 128C257 124.091 258.318 120.443 260.597 117.362C250.475 115.134 243 107.31 243 98C243 89.9738 248.556 83.0528 256.572 79.8682C253.097 75.8586 251 70.6695 251 65C251 53.3288 259.882 43.6888 271.392 42.2002C271.135 40.8383 271 39.4346 271 38C271 25.2975 281.521 15 294.5 15C297.708 15 300.765 15.6297 303.551 16.7686C306.934 8.13184 315.485 2 325.5 2C331.424 2 336.835 4.1458 340.968 7.68555C345.271 2.96952 351.531 0 358.5 0ZM422.912 130.988C422.89 131.023 422.868 131.058 422.846 131.093L422.903 130.987C422.906 130.988 422.909 130.988 422.912 130.988ZM373.5 64C359.969 64 349 70.268 349 78C349 85.732 359.969 92 373.5 92C387.031 92 398 85.732 398 78C398 70.268 387.031 64 373.5 64Z"
            fill="var(--skin)"
          />

          {/* Blink lid — covers the eye cut-out */}
          <ellipse
            className="prismo-lid"
            cx="373.5"
            cy="78"
            rx="26"
            ry="15"
            fill="var(--skin)"
          />
        </g>
      </g>
    </svg>
  );
}
