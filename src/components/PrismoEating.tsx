/**
 * Prismo munching a pickle, the loading mascot.
 * Profile head chews (gentle rotation) while the hand bobs a pickle to the
 * mouth and crumbs fly. Pure SVG + CSS keyframes (.chew, .bring-pickle, .crumb).
 */
export default function PrismoEating({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 300 320"
      role="img"
      aria-label="Prismo happily eating a pickle while thinking"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* contact shadow */}
      <ellipse cx="150" cy="300" rx="86" ry="12" fill="var(--contact-shadow)" opacity="0.18" />

      {/* arm + pickle bob together, pivoting at the shoulder */}
      <g className="bring-pickle">
        {/* arm */}
        <path
          d="M192 266C204 236 214 216 222 200"
          stroke="var(--skin)"
          strokeWidth="28"
          strokeLinecap="round"
          fill="none"
        />
        {/* pickle */}
        <g>
          <path
            d="M224 210C204 210 198 186 203 156L212 96C215 76 239 70 253 82C267 94 266 118 261 140L252 190C249 204 240 210 224 210Z"
            fill="var(--pickle)"
          />
          {/* highlight */}
          <path
            d="M216 198C207 191 205 168 209 142L215 100"
            stroke="var(--pickle-light)"
            strokeWidth="7"
            strokeLinecap="round"
            fill="none"
            opacity="0.85"
          />
          {/* bumps */}
          <circle cx="238" cy="120" r="3.4" fill="#3f6330" opacity="0.55" />
          <circle cx="230" cy="150" r="3.4" fill="#3f6330" opacity="0.55" />
          <circle cx="244" cy="170" r="3" fill="#3f6330" opacity="0.55" />
          <circle cx="232" cy="186" r="3" fill="#3f6330" opacity="0.55" />
        </g>
        {/* hand gripping the pickle */}
        <g fill="var(--skin)">
          <ellipse cx="224" cy="202" rx="22" ry="16" />
          <circle cx="210" cy="195" r="6.5" />
          <circle cx="219" cy="190" r="6.5" />
          <circle cx="229" cy="190" r="6.5" />
          <circle cx="238" cy="193" r="6" />
        </g>
      </g>

      {/* head chews */}
      <g className="chew">
        {/* curls */}
        <g fill="var(--skin)">
          <circle cx="96" cy="142" r="36" />
          <circle cx="110" cy="98" r="36" />
          <circle cx="152" cy="82" r="36" />
          <circle cx="190" cy="104" r="30" />
          <circle cx="92" cy="182" r="33" />
          <circle cx="122" cy="206" r="33" />
          <circle cx="166" cy="200" r="30" />
          <ellipse cx="150" cy="150" rx="72" ry="70" />
          {/* snout */}
          <path d="M196 122C224 118 248 140 250 154C251 166 234 184 206 184C196 184 194 150 196 122Z" />
        </g>

        {/* open mouth where the pickle bites in */}
        <path d="M236 144C248 148 250 152 250 155C250 159 246 164 236 167C231 160 231 151 236 144Z" fill="#5e2f39" />

        {/* eye */}
        <ellipse cx="150" cy="126" rx="17" ry="9.5" fill="var(--eye-sclera)" />
        <circle cx="153" cy="126" r="7" fill="var(--eye-iris)" />

        {/* cheek smile */}
        <path
          d="M168 168C176 176 190 176 200 169"
          stroke="var(--skin-dark)"
          strokeWidth="3.5"
          strokeLinecap="round"
          fill="none"
          opacity="0.6"
        />
      </g>

      {/* crunch crumbs */}
      <g>
        <path className="crumb" style={{ ["--cx" as string]: "22px", ["--cy" as string]: "-16px", animationDelay: "0s" }} d="M240 150l7-3-2 7z" fill="var(--pickle-light)" />
        <path className="crumb" style={{ ["--cx" as string]: "26px", ["--cy" as string]: "10px", animationDelay: "0.15s" }} d="M242 158l6 1-3 5z" fill="var(--pickle)" />
        <path className="crumb" style={{ ["--cx" as string]: "16px", ["--cy" as string]: "20px", animationDelay: "0.3s" }} d="M238 162l5 3-5 2z" fill="var(--pickle-light)" />
        <circle className="crumb" style={{ ["--cx" as string]: "28px", ["--cy" as string]: "-4px", animationDelay: "0.22s" }} cx="244" cy="153" r="2.4" fill="var(--pickle)" />
      </g>
    </svg>
  );
}
