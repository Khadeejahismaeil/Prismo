type PrismoProps = {
  className?: string;
  /** Show a soft contact shadow on the floor beneath Prismo. */
  shadow?: boolean;
};

/**
 * Prismo, the one-eyed mascot, built from the canonical "waving + smiling"
 * brand vector. The smile and the raised waving hand are part of the artwork;
 * the only thing we animate on top is the blink, plus a gentle idle
 * breathe / sway and an iris glance (CSS keyframes in globals.css).
 *
 * The pink body path is drawn over the eye with a hole cut out for it, so the
 * yellow sclera + blue iris show through and the body frames the eye.
 */
export default function Prismo({ className, shadow = true }: PrismoProps) {
  return (
    <svg
      className={`prismo-svg ${className ?? ""}`}
      viewBox="-14 -14 271 315"
      role="img"
      aria-label="Prismo, a friendly one-eyed character, smiling and waving"
      xmlns="http://www.w3.org/2000/svg"
    >
      {shadow && (
        <ellipse
          className="prismo-contact"
          cx="104"
          cy="287"
          rx="98"
          ry="13"
          fill="var(--contact-shadow)"
        />
      )}

      <g className="prismo-sway">
        <g className="prismo-breathe">
          {/* Eye, sits behind the body and shows through the cut-out */}
          <ellipse cx="130.5" cy="78" rx="25.5" ry="14" fill="var(--eye-sclera)" />
          <g className="prismo-iris">
            <circle cx="131" cy="78" r="11" fill="var(--eye-iris)" />
          </g>

          {/* Body, canonical smiling Prismo with the eye cut out */}
          <path
            d="M115.5 0C125.073 0 133.309 5.60289 136.972 13.6406C138.745 13.2222 140.596 13 142.5 13C154.167 13 163.846 21.3219 165.684 32.2314C181.549 46.5858 191.527 66.434 191.981 88.4287L209.457 110.602C211.01 111.885 212 113.827 212 116C212 119.764 209.03 122.832 205.306 122.992L182.645 126.379C181.609 128.272 180.491 130.121 179.303 131.926H152.011C142.074 131.288 135.341 130.951 131.14 131.005C129.047 131.032 127.538 131.156 126.565 131.405C126.085 131.528 125.674 131.697 125.392 131.95C125.244 132.082 125.124 132.245 125.057 132.44C124.989 132.637 124.986 132.839 125.026 133.03L125.038 133.028C125.515 134.816 132.566 137.292 141.413 138.712C146.342 139.503 150.844 139.809 154.04 139.656C156.215 139.741 158.596 139.737 161.09 139.629C165.742 139.426 169.974 138.895 173.182 138.186C173.739 138.133 174.302 138.074 174.873 138.018C163.162 152.639 146.239 163.505 126.627 168.295C126.868 169.156 127 170.062 127 171V216H166.708C171.517 216 175.645 219.423 176.535 224.148L185.794 273.291C186.945 279.4 182.301 285.068 176.085 285.142L31.5576 286.856C25.2938 286.93 20.5049 281.293 21.5908 275.124L30.5449 224.266C31.3867 219.486 35.5398 216 40.3936 216H81V171C81 170.062 81.1308 169.155 81.3721 168.295C77.5866 167.37 73.9011 166.22 70.334 164.859C67.8835 165.597 65.2471 166 62.5 166C50.2949 166 40.2638 158.081 39.1113 147.951C38.5788 147.982 38.0416 148 37.5 148C24.5213 148 14 139.046 14 128C14 124.091 15.3183 120.443 17.5967 117.362C7.47549 115.134 0 107.31 0 98C0 89.9738 5.55561 83.0528 13.5723 79.8682C10.0974 75.8586 8 70.6695 8 65C8 53.3288 16.8822 43.6888 28.3916 42.2002C28.1348 40.8383 28 39.4346 28 38C28 25.2975 38.5213 15 51.5 15C54.7077 15 57.765 15.6297 60.5508 16.7686C63.9342 8.13184 72.485 2 82.5 2C88.4236 2 93.8346 4.1458 97.9678 7.68555C102.271 2.96952 108.531 0 115.5 0ZM130.5 64C116.969 64 106 70.268 106 78C106 85.732 116.969 92 130.5 92C144.031 92 155 85.732 155 78C155 70.268 144.031 64 130.5 64Z"
            fill="var(--skin)"
          />

          {/* Raised waving hand with fingers */}
          <path
            d="M239.339 145.258C241.88 145.517 243.708 147.819 243.385 150.353L242.243 159.32L237.133 286.871L207.158 285.669L213.078 154.897L213.076 154.897L213.728 147.343C213.949 144.787 216.219 142.908 218.771 143.167C221.191 143.413 223 145.504 222.895 147.935L222.579 155.246L222.623 155.248L223.83 148.147C224.249 145.677 226.511 143.954 229.004 144.207C231.535 144.465 233.417 146.668 233.275 149.209L232.914 155.626L233.42 155.645L234.387 149.113C234.742 146.711 236.923 145.013 239.339 145.258Z"
            fill="var(--skin)"
          />

          {/* Blink lid, covers the eye cut-out */}
          <ellipse
            className="prismo-lid"
            cx="130.5"
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
