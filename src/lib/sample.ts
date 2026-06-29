/**
 * A built-in sample screenshot (a fictional "Lumi" budgeting app) so the flow
 * is fully demoable without uploading. It's an SVG encoded as a data URL.
 */
const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="360" height="640" viewBox="0 0 360 640">
  <rect width="360" height="640" fill="#ffffff"/>
  <!-- header -->
  <text x="24" y="58" font-family="Arial" font-size="20" font-weight="700" fill="#1f2430">Lumi</text>
  <text x="24" y="80" font-family="Arial" font-size="13" fill="#c7ccd6">Good morning, Sam</text>
  <circle cx="324" cy="60" r="18" fill="#eceef3"/>
  <!-- balance hero -->
  <rect x="24" y="104" width="312" height="150" rx="22" fill="#eef1f6"/>
  <text x="44" y="146" font-family="Arial" font-size="12" fill="#aeb4c0">Total balance</text>
  <text x="44" y="184" font-family="Arial" font-size="34" font-weight="700" fill="#2a2f3a">$4,820.50</text>
  <text x="44" y="214" font-family="Arial" font-size="12" fill="#bfc4ce">+2.4% this month</text>
  <!-- stat cards -->
  <rect x="24" y="272" width="150" height="92" rx="18" fill="#f4f6f9"/>
  <rect x="186" y="272" width="150" height="92" rx="18" fill="#f4f6f9"/>
  <text x="42" y="304" font-family="Arial" font-size="12" fill="#b6bcc7">Income</text>
  <text x="42" y="332" font-family="Arial" font-size="20" font-weight="700" fill="#2a2f3a">$6,200</text>
  <text x="204" y="304" font-family="Arial" font-size="12" fill="#b6bcc7">Spending</text>
  <text x="204" y="332" font-family="Arial" font-size="20" font-weight="700" fill="#2a2f3a">$1,380</text>
  <!-- list -->
  <text x="24" y="404" font-family="Arial" font-size="14" font-weight="700" fill="#2a2f3a">Recent</text>
  <g font-family="Arial">
    <circle cx="40" cy="438" r="16" fill="#eceef3"/>
    <text x="68" y="436" font-size="14" fill="#444b57">Groceries</text>
    <text x="68" y="452" font-size="11" fill="#c7ccd6">Today</text>
    <text x="336" y="444" font-size="14" font-weight="700" fill="#2a2f3a" text-anchor="end">-$54</text>
    <circle cx="40" cy="482" r="16" fill="#eceef3"/>
    <text x="68" y="480" font-size="14" fill="#444b57">Coffee</text>
    <text x="68" y="496" font-size="11" fill="#c7ccd6">Today</text>
    <text x="336" y="488" font-size="14" font-weight="700" fill="#2a2f3a" text-anchor="end">-$6</text>
    <circle cx="40" cy="526" r="16" fill="#eceef3"/>
    <text x="68" y="524" font-size="14" fill="#444b57">Salary</text>
    <text x="68" y="540" font-size="11" fill="#c7ccd6">Yesterday</text>
    <text x="336" y="532" font-size="14" font-weight="700" fill="#2a2f3a" text-anchor="end">+$3,100</text>
  </g>
  <!-- weak CTA -->
  <rect x="24" y="572" width="312" height="44" rx="14" fill="#f0f1f4"/>
  <text x="180" y="599" font-family="Arial" font-size="14" fill="#aab0bb" text-anchor="middle">Add transaction</text>
</svg>`;

export const SAMPLE_SCREEN = `data:image/svg+xml,${encodeURIComponent(svg)}`;
