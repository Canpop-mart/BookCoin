// Cute preset avatars (no uploads). Each is a self-contained SVG that fills a round .av disc.
// id is stored on the member; keep these ids in sync with AVATAR_IDS in server/src/index.js.
export const AVATARS = [
  {
    id: 'cat', label: 'Cat', bg: '#F7D9C4',
    svg: `<svg viewBox="0 0 100 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="50" fill="#F7D9C4"/>
<path d="M28 34 L23 14 L44 30 Z" fill="#A89B88"/><path d="M72 34 L77 14 L56 30 Z" fill="#A89B88"/>
<path d="M33 30 L30 19 L41 28 Z" fill="#F2A9A0"/><path d="M67 30 L70 19 L59 28 Z" fill="#F2A9A0"/>
<circle cx="50" cy="56" r="28" fill="#A89B88"/>
<ellipse cx="38" cy="63" rx="5" ry="3.6" fill="#F2A9A0" opacity="0.55"/><ellipse cx="62" cy="63" rx="5" ry="3.6" fill="#F2A9A0" opacity="0.55"/>
<circle cx="41" cy="54" r="4" fill="#4A3F35"/><circle cx="59" cy="54" r="4" fill="#4A3F35"/>
<circle cx="42.4" cy="52.6" r="1.3" fill="#fff"/><circle cx="60.4" cy="52.6" r="1.3" fill="#fff"/>
<path d="M50 60 l-2.8 2.8 h5.6 z" fill="#7A6E5C"/>
<path d="M50 62.8 q-3.5 4 -8 3 M50 62.8 q3.5 4 8 3" stroke="#7A6E5C" stroke-width="1.3" fill="none" stroke-linecap="round"/>
<g stroke="#8C8070" stroke-width="1.1" stroke-linecap="round"><path d="M40 56 H27"/><path d="M40 59 H29"/><path d="M60 56 H73"/><path d="M60 59 H71"/></g></svg>`,
  },
  {
    id: 'dog', label: 'Dog', bg: '#F4DFC0',
    svg: `<svg viewBox="0 0 100 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="50" fill="#F4DFC0"/>
<ellipse cx="23" cy="49" rx="10" ry="18" fill="#B07E4F"/><ellipse cx="77" cy="49" rx="10" ry="18" fill="#B07E4F"/>
<circle cx="50" cy="52" r="28" fill="#C99B6B"/>
<ellipse cx="50" cy="62" rx="16" ry="13" fill="#EBD7B8"/>
<ellipse cx="40" cy="62" rx="4.5" ry="3.2" fill="#F2A9A0" opacity="0.5"/><ellipse cx="60" cy="62" rx="4.5" ry="3.2" fill="#F2A9A0" opacity="0.5"/>
<circle cx="42" cy="50" r="4" fill="#4A3F35"/><circle cx="58" cy="50" r="4" fill="#4A3F35"/>
<circle cx="43.3" cy="48.6" r="1.3" fill="#fff"/><circle cx="59.3" cy="48.6" r="1.3" fill="#fff"/>
<ellipse cx="50" cy="58" rx="4" ry="3" fill="#4A3F35"/>
<path d="M50 61 v4 q0 3 4 3 M50 65 q0 3 -4 3" stroke="#7A6E5C" stroke-width="1.4" fill="none" stroke-linecap="round"/></svg>`,
  },
  {
    id: 'fox', label: 'Fox', bg: '#FBE7CF',
    svg: `<svg viewBox="0 0 100 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="50" fill="#FBE7CF"/>
<path d="M30 36 L24 14 L45 30 Z" fill="#E88A4E"/><path d="M70 36 L76 14 L55 30 Z" fill="#E88A4E"/>
<path d="M31 33 L28 20 L40 30 Z" fill="#4A3F35" opacity="0.5"/><path d="M69 33 L72 20 L60 30 Z" fill="#4A3F35" opacity="0.5"/>
<circle cx="50" cy="54" r="27" fill="#E88A4E"/>
<path d="M50 45 C 34 52, 37 73, 50 77 C 63 73, 66 52, 50 45 Z" fill="#FBF3E7"/>
<ellipse cx="36" cy="60" rx="4.5" ry="3.2" fill="#F2A9A0" opacity="0.5"/><ellipse cx="64" cy="60" rx="4.5" ry="3.2" fill="#F2A9A0" opacity="0.5"/>
<circle cx="42" cy="52" r="3.6" fill="#4A3F35"/><circle cx="58" cy="52" r="3.6" fill="#4A3F35"/>
<circle cx="43.2" cy="50.8" r="1.2" fill="#fff"/><circle cx="59.2" cy="50.8" r="1.2" fill="#fff"/>
<path d="M50 66 l-3 3 h6 z" fill="#4A3F35"/></svg>`,
  },
  {
    id: 'bunny', label: 'Bunny', bg: '#FBE0EA',
    svg: `<svg viewBox="0 0 100 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="50" fill="#FBE0EA"/>
<ellipse cx="40" cy="24" rx="7" ry="20" fill="#F6EFE6"/><ellipse cx="60" cy="24" rx="7" ry="20" fill="#F6EFE6"/>
<ellipse cx="40" cy="25" rx="3.2" ry="14" fill="#F4B8CE"/><ellipse cx="60" cy="25" rx="3.2" ry="14" fill="#F4B8CE"/>
<circle cx="50" cy="60" r="26" fill="#F6EFE6"/>
<ellipse cx="38" cy="65" rx="4.5" ry="3.2" fill="#F2A9A0" opacity="0.55"/><ellipse cx="62" cy="65" rx="4.5" ry="3.2" fill="#F2A9A0" opacity="0.55"/>
<circle cx="42" cy="58" r="3.8" fill="#4A3F35"/><circle cx="58" cy="58" r="3.8" fill="#4A3F35"/>
<circle cx="43.2" cy="56.8" r="1.2" fill="#fff"/><circle cx="59.2" cy="56.8" r="1.2" fill="#fff"/>
<path d="M50 64 l-2.6 2.4 h5.2 z" fill="#E89BB0"/>
<path d="M50 66.4 v2.5 q0 2.5 3.5 3 M50 68.9 q0 2.5 -3.5 3" stroke="#D98CA3" stroke-width="1.3" fill="none" stroke-linecap="round"/></svg>`,
  },
  {
    id: 'bear', label: 'Bear', bg: '#E9D6B8',
    svg: `<svg viewBox="0 0 100 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="50" fill="#E9D6B8"/>
<circle cx="28" cy="32" r="11" fill="#B98A5E"/><circle cx="72" cy="32" r="11" fill="#B98A5E"/>
<circle cx="28" cy="32" r="5" fill="#9C7248"/><circle cx="72" cy="32" r="5" fill="#9C7248"/>
<circle cx="50" cy="55" r="29" fill="#B98A5E"/>
<ellipse cx="50" cy="63" rx="15" ry="12" fill="#EEDDBE"/>
<ellipse cx="37" cy="60" rx="4.5" ry="3.2" fill="#F2A9A0" opacity="0.45"/><ellipse cx="63" cy="60" rx="4.5" ry="3.2" fill="#F2A9A0" opacity="0.45"/>
<circle cx="41" cy="51" r="3.8" fill="#4A3F35"/><circle cx="59" cy="51" r="3.8" fill="#4A3F35"/>
<circle cx="42.2" cy="49.8" r="1.2" fill="#fff"/><circle cx="60.2" cy="49.8" r="1.2" fill="#fff"/>
<ellipse cx="50" cy="58" rx="4.5" ry="3.2" fill="#4A3F35"/>
<path d="M50 61 v3.5 q0 3 4 3.5 M50 64.5 q0 3 -4 3.5" stroke="#7A6E5C" stroke-width="1.4" fill="none" stroke-linecap="round"/></svg>`,
  },
  {
    id: 'panda', label: 'Panda', bg: '#DCE7D0',
    svg: `<svg viewBox="0 0 100 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="50" fill="#DCE7D0"/>
<circle cx="28" cy="30" r="11" fill="#3A3A3A"/><circle cx="72" cy="30" r="11" fill="#3A3A3A"/>
<circle cx="50" cy="55" r="29" fill="#F7EEDD"/>
<ellipse cx="40" cy="52" rx="7.5" ry="9.5" fill="#3A3A3A" transform="rotate(18 40 52)"/>
<ellipse cx="60" cy="52" rx="7.5" ry="9.5" fill="#3A3A3A" transform="rotate(-18 60 52)"/>
<circle cx="40" cy="53" r="3.2" fill="#fff"/><circle cx="60" cy="53" r="3.2" fill="#fff"/>
<circle cx="40" cy="53.5" r="1.6" fill="#2A2A2A"/><circle cx="60" cy="53.5" r="1.6" fill="#2A2A2A"/>
<ellipse cx="50" cy="63" rx="3.6" ry="2.6" fill="#3A3A3A"/>
<path d="M50 65.6 v2.5 q0 2.5 3.5 3 M50 68.1 q0 2.5 -3.5 3" stroke="#6E665C" stroke-width="1.3" fill="none" stroke-linecap="round"/>
<ellipse cx="30" cy="62" rx="4" ry="2.8" fill="#F2A9A0" opacity="0.5"/><ellipse cx="70" cy="62" rx="4" ry="2.8" fill="#F2A9A0" opacity="0.5"/></svg>`,
  },
  {
    id: 'owl', label: 'Owl', bg: '#E3E1F3',
    svg: `<svg viewBox="0 0 100 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="50" fill="#E3E1F3"/>
<path d="M30 30 L34 16 L42 28 Z" fill="#9C7248"/><path d="M70 30 L66 16 L58 28 Z" fill="#9C7248"/>
<ellipse cx="50" cy="56" rx="30" ry="29" fill="#B98A5E"/>
<circle cx="39" cy="50" r="12" fill="#F7EEDD"/><circle cx="61" cy="50" r="12" fill="#F7EEDD"/>
<circle cx="39" cy="51" r="5.5" fill="#4A3F35"/><circle cx="61" cy="51" r="5.5" fill="#4A3F35"/>
<circle cx="40.8" cy="49.4" r="1.7" fill="#fff"/><circle cx="62.8" cy="49.4" r="1.7" fill="#fff"/>
<path d="M50 56 L45 63 L55 63 Z" fill="#E0A52C"/>
<path d="M26 71 Q50 81 74 71" stroke="#9C7248" stroke-width="2" fill="none" opacity="0.5"/></svg>`,
  },
  {
    id: 'frog', label: 'Frog', bg: '#D7EFD2',
    svg: `<svg viewBox="0 0 100 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="50" fill="#D7EFD2"/>
<circle cx="36" cy="40" r="11" fill="#7FBF6A"/><circle cx="64" cy="40" r="11" fill="#7FBF6A"/>
<circle cx="50" cy="60" r="28" fill="#7FBF6A"/>
<circle cx="36" cy="39" r="6.5" fill="#FBF3E7"/><circle cx="64" cy="39" r="6.5" fill="#FBF3E7"/>
<circle cx="36" cy="40" r="3.2" fill="#4A3F35"/><circle cx="64" cy="40" r="3.2" fill="#4A3F35"/>
<circle cx="37.2" cy="38.8" r="1.1" fill="#fff"/><circle cx="65.2" cy="38.8" r="1.1" fill="#fff"/>
<circle cx="45" cy="52" r="1.3" fill="#3F7A34"/><circle cx="55" cy="52" r="1.3" fill="#3F7A34"/>
<path d="M34 58 Q50 72 66 58" stroke="#3F7A34" stroke-width="2.4" fill="none" stroke-linecap="round"/>
<ellipse cx="32" cy="56" rx="4.5" ry="3" fill="#F2A9A0" opacity="0.5"/><ellipse cx="68" cy="56" rx="4.5" ry="3" fill="#F2A9A0" opacity="0.5"/></svg>`,
  },
  {
    id: 'penguin', label: 'Penguin', bg: '#CFE6F2',
    svg: `<svg viewBox="0 0 100 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="50" fill="#CFE6F2"/>
<circle cx="50" cy="52" r="30" fill="#404656"/>
<path d="M50 28 C 33 30, 30 52, 36 68 Q50 78 64 68 C 70 52, 67 30, 50 28 Z" fill="#F7EEDD"/>
<circle cx="42" cy="48" r="3.6" fill="#4A3F35"/><circle cx="58" cy="48" r="3.6" fill="#4A3F35"/>
<circle cx="43.1" cy="46.9" r="1.2" fill="#fff"/><circle cx="59.1" cy="46.9" r="1.2" fill="#fff"/>
<path d="M50 53 l-5 4 h10 z" fill="#E8A42C"/><path d="M45 57 h10 l-5 4 z" fill="#D98F2E"/>
<ellipse cx="36" cy="56" rx="4" ry="2.8" fill="#F2A9A0" opacity="0.55"/><ellipse cx="64" cy="56" rx="4" ry="2.8" fill="#F2A9A0" opacity="0.55"/></svg>`,
  },
];

export const AVATAR_BY_ID = Object.fromEntries(AVATARS.map((a) => [a.id, a]));
