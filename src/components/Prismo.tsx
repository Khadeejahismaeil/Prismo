type PrismoProps = {
  className?: string;
  /** Render the isometric yellow room behind Prismo. */
  scene?: boolean;
};

/**
 * Prismo — the one-eyed mascot.
 *
 * Built as a single inline SVG so the animated parts (body, head, arm, eye,
 * shadow) can be driven by CSS keyframes defined in globals.css:
 *   - idle breathing (whole body + offset head bob)
 *   - blinking (a skin-coloured lid that drops over the eye)
 *   - waving (the raised arm rotates about the shoulder)
 *   - glancing (the iris drifts around)
 */
export default function Prismo({ className, scene = true }: PrismoProps) {
  return (
    <svg
      className={`prismo-svg ${className ?? ""}`}
      viewBox="0 0 1000 1000"
      role="img"
      aria-label="Prismo, a friendly one-eyed character, waving hello"
      xmlns="http://www.w3.org/2000/svg"
    >
      {scene && (
        <g aria-hidden="true">
          {/* Background fill of the room */}
          <rect x="0" y="0" width="1000" height="1000" fill="var(--prismo-bg)" />

          {/* Left wall (lighter) */}
          <polygon
            points="90,250 600,140 600,720 90,820"
            fill="var(--wall-left)"
          />
          {/* Right wall (darker) */}
          <polygon
            points="600,140 940,250 940,690 600,720"
            fill="var(--wall-right)"
          />
          {/* Floor */}
          <polygon
            points="90,820 600,720 940,690 720,1000 230,1000"
            fill="var(--floor)"
          />

          {/* Recessed staircase niche in the right wall */}
          <g>
            <polygon
              points="720,300 880,345 880,455 720,420"
              fill="#c4b932"
            />
            {/* steps */}
            <polygon points="735,405 870,432 870,448 735,422" fill="#e7dd58" />
            <polygon points="745,382 862,406 862,420 745,398" fill="#ddd24c" />
            <polygon points="755,360 854,381 854,393 755,375" fill="#e7dd58" />
            <polygon points="763,340 847,358 847,368 763,353" fill="#ddd24c" />
            {/* dark doorway at the top of the stairs */}
            <polygon points="790,312 875,335 875,360 790,340" fill="#7c7420" />
          </g>
        </g>
      )}

      {/* Long pink cast shadow on the floor */}
      <g className="prismo-shadow" aria-hidden="true">
        <polygon
          points="300,860 470,760 760,930 360,980 150,930"
          fill="var(--shadow)"
          opacity="0.85"
        />
      </g>

      {/* ---------------- Prismo ---------------- */}
      <g className="prismo-body">
        {/* Sitting torso */}
        <path
          d="M250,980
             C220,820 250,690 330,640
             C390,602 470,612 505,660
             C540,710 540,780 525,860
             C515,915 505,950 500,985
             Z"
          fill="var(--skin)"
        />
        {/* Subtle shading where the torso turns */}
        <path
          d="M470,650 C512,700 520,790 505,870 C500,905 496,945 494,980
             L500,985 C505,950 540,780 505,660 Z"
          fill="var(--skin-dark)"
          opacity="0.5"
        />

        {/* Waving arm — pivots at the shoulder (470,620) */}
        <g className="prismo-arm">
          <path
            d="M455,640
               C520,615 600,610 650,560
               C690,520 705,470 700,430
               C697,405 672,398 660,420
               C648,470 612,520 560,560
               C515,595 470,600 440,612
               Z"
            fill="var(--skin)"
          />
          {/* little hand */}
          <circle cx="690" cy="425" r="34" fill="var(--skin)" />
        </g>
      </g>

      {/* Head group (bobs slightly out of phase with the body) */}
      <g className="prismo-head">
        {/* Cloud-like hair / head — overlapping blobs that merge into one shape */}
        <g fill="var(--skin)">
          <circle cx="250" cy="430" r="105" />
          <circle cx="300" cy="330" r="95" />
          <circle cx="400" cy="305" r="90" />
          <circle cx="480" cy="370" r="82" />
          <circle cx="470" cy="470" r="80" />
          <circle cx="380" cy="520" r="95" />
          <circle cx="285" cy="510" r="92" />
          <circle cx="355" cy="420" r="120" />
          {/* snout / nose bump pointing right */}
          <path
            d="M455,440 C515,430 540,460 520,495 C505,520 470,520 450,500 Z"
          />
        </g>

        {/* Smile */}
        <path
          d="M452,498 C470,512 495,510 512,498"
          fill="none"
          stroke="var(--skin-dark)"
          strokeWidth="6"
          strokeLinecap="round"
          opacity="0.7"
        />

        {/* Eye */}
        <g>
          {/* almond sclera */}
          <path
            d="M300,432 Q372,372 444,432 Q372,492 300,432 Z"
            fill="var(--eye-sclera)"
          />
          {/* iris + pupil drift together */}
          <g className="prismo-iris">
            <circle cx="372" cy="432" r="30" fill="var(--eye-iris)" />
            <circle cx="372" cy="432" r="14" fill="var(--eye-pupil)" />
            <circle cx="364" cy="424" r="6" fill="#ffffff" opacity="0.9" />
          </g>
          {/* blinking lid — skin coloured, drops down from the top of the eye */}
          <path
            className="prismo-lid"
            d="M300,432 Q372,372 444,432 Q372,492 300,432 Z"
            fill="var(--skin)"
          />
        </g>
      </g>
    </svg>
  );
}
