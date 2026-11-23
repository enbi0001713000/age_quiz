<!-- ロゴ（仮）：レーダーのシンボル。正式タイトル決定（Q11）後に差し替える -->
<script lang="ts">
  let { size = 72 }: { size?: number } = $props();
</script>

<svg class="logo" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
  <defs>
    <linearGradient id="logo-sweep" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#22d3ee" stop-opacity="0.9" />
      <stop offset="1" stop-color="#8b5cf6" stop-opacity="0" />
    </linearGradient>
  </defs>
  <circle cx="32" cy="32" r="29" fill="none" stroke="#2f6bff" stroke-width="2" opacity="0.8" />
  <circle cx="32" cy="32" r="19" fill="none" stroke="#5b8cff" stroke-width="1.5" opacity="0.6" />
  <circle cx="32" cy="32" r="9" fill="none" stroke="#8b5cf6" stroke-width="1.5" opacity="0.8" />
  <g class="sweep">
    <path d="M32 32 L32 3 A29 29 0 0 1 56.5 16.5 Z" fill="url(#logo-sweep)" opacity="0.55" />
  </g>
  <circle cx="44" cy="20" r="2.6" fill="#67e8f9" />
  <circle cx="32" cy="32" r="2.2" fill="#e6eeff" />
</svg>

<style>
  .logo {
    filter: drop-shadow(0 0 12px rgb(34 211 238 / 35%));
  }
  .sweep {
    transform-origin: 32px 32px;
    animation: spin 4s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
