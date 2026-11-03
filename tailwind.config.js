/** @type {import('tailwindcss').Config} */
// MUI × Tailwind 共存铁律：
// 1) preflight 必须关闭，由 MUI <CssBaseline /> 接管基线样式；
// 2) 色值只允许引用 :root CSS 变量（与 MUI 主题同一份令牌），禁止在此重复写色值；
// 3) Tailwind 只用布局/间距工具类，不使用 Tailwind 颜色类于业务语义。
export default {
  corePlugins: {
    preflight: false,
  },
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'muji-paper': 'var(--muji-paper)',
        'muji-paper2': 'var(--muji-paper2)',
        'muji-card': 'var(--muji-card)',
        'muji-ink': 'var(--muji-ink)',
        'muji-ink2': 'var(--muji-ink2)',
        'muji-ink3': 'var(--muji-ink3)',
        'muji-line': 'var(--muji-line)',
        'muji-line-soft': 'var(--muji-line-soft)',
        'muji-red': 'var(--muji-red)',
        'muji-up': 'var(--muji-up)',
        'muji-up-bg': 'var(--muji-up-bg)',
        'muji-down': 'var(--muji-down)',
        'muji-down-bg': 'var(--muji-down-bg)',
      },
    },
  },
  plugins: [],
};
