// Vector water stays crisp at board zoom and in the full-size tile previews.
// All tiles sample the same pattern coordinates, so the currents join at edges.
export function oceanDefs(prefix) {
  return `<linearGradient id="${prefix}-water-depth" gradientUnits="userSpaceOnUse" x1="100" y1="0" x2="1000" y2="900">
    <stop stop-color="#6cdece"/><stop offset=".48" stop-color="#3fc9c3"/><stop offset="1" stop-color="#25acb4"/>
  </linearGradient>
  <pattern id="${prefix}-water-currents" width="240" height="200" patternUnits="userSpaceOnUse">
    <g fill="none" stroke-linecap="round" stroke-linejoin="round">
      <path d="M0 74C20 74 33 58 60 58S100 84 120 84 154 64 180 64 220 74 240 74M0 155C20 155 40 171 60 171S100 144 120 144 157 157 180 157 220 155 240 155" stroke="#137e9a" stroke-width="14" opacity=".035"/>
      <path d="M0 68C20 68 33 52 60 52S100 78 120 78 154 58 180 58 220 68 240 68M0 149C20 149 40 165 60 165S100 138 120 138 157 151 180 151 220 149 240 149" stroke="#d9fff0" stroke-width="7" opacity=".06"/>
      <g stroke="#d9fff0" stroke-width="1.2" opacity=".32">
        <path d="M10 29C24 31 29 18 42 22S60 36 78 28M92 25C109 12 121 18 132 9M170 20C187 9 198 27 218 18"/>
        <path d="M12 63C34 44 42 57 54 51M81 62C97 53 99 38 117 41S137 53 153 42M183 63C203 44 215 59 231 47"/>
        <path d="M5 98C13 94 18 88 28 93M48 91C70 102 82 77 102 83M129 77C143 67 158 79 168 74M189 90C206 100 215 82 231 87"/>
        <path d="M5 135C23 119 37 133 47 125M76 121C94 107 100 117 115 109M145 119C158 104 176 119 186 112M206 137C216 124 226 137 235 130"/>
        <path d="M8 175C16 170 20 174 29 168M48 164C63 152 78 163 93 152M118 168C139 158 141 140 157 147M183 164C198 153 210 166 226 154"/>
      </g>
    </g>
  </pattern>
  <pattern id="${prefix}-water-light" width="240" height="200" patternUnits="userSpaceOnUse">
    <g class="water-shimmer" pointer-events="none" fill="none" stroke="#f3fff2" stroke-width="1.5" stroke-linecap="round">
      <path d="M32 40C45 34 52 44 63 36M135 99C148 94 157 103 168 95M79 179C91 168 103 181 113 172M207 69C218 60 227 67 237 61"/>
    </g>
  </pattern>
  <radialGradient id="${prefix}-coast-fade"><stop offset=".8" stop-color="white"/><stop offset="1" stop-color="black"/></radialGradient>
  <mask id="${prefix}-coast-mask" maskContentUnits="objectBoundingBox"><rect width="1" height="1" fill="url(#${prefix}-coast-fade)"/></mask>`;
}

export function oceanSurface(c, prefix) {
  const bounds = `x="${c.x - 112}" y="${c.y - 112}" width="224" height="224"`;
  return `<g class="ocean-surface" pointer-events="none" aria-hidden="true">
    <rect ${bounds} fill="url(#${prefix}-water-depth)"/>
    <rect ${bounds} fill="url(#${prefix}-water-currents)"/>
    <rect ${bounds} fill="url(#${prefix}-water-light)"/>
  </g>`;
}
