/**
 * muji-theme.ts — MUI 主题：MUJI 设计令牌（色板/字重 200·300/直角细线框）
 * 色值与 src/index.css 的 CSS 变量同源，禁止两处各写一份。
 */
import { createTheme, Theme } from '@mui/material/styles';

/** MUJI 设计令牌（与 index.css :root 一一对应） */
export const MUJI = {
  paper: '#f7f5f2',
  paper2: '#eceae4',
  card: '#fdfcfa',
  ink: '#3e3a39',
  ink2: '#6b6560',
  ink3: '#8a8378',
  line: '#d9d5cd',
  lineSoft: '#e7e3db',
  red: '#7f0019',
  up: '#a03e35',
  upBg: '#f5e9e7',
  down: '#4f7d5c',
  downBg: '#e9f0ea',
} as const;

const FONT_FAMILY =
  '"Helvetica Neue",Helvetica,Arial,-apple-system,BlinkMacSystemFont,"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif';

export const mujiTheme: Theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: MUJI.red, contrastText: MUJI.card },
    secondary: { main: MUJI.ink2 },
    success: { main: MUJI.down },
    error: { main: MUJI.up },
    background: { default: MUJI.paper, paper: MUJI.card },
    text: { primary: MUJI.ink, secondary: MUJI.ink2, disabled: MUJI.ink3 },
    divider: MUJI.line,
  },
  typography: {
    fontFamily: FONT_FAMILY,
    fontWeightLight: 200,
    fontWeightRegular: 300,
    fontWeightMedium: 300,
    fontWeightBold: 400,
    button: {
      textTransform: 'none',
      fontWeight: 300,
      letterSpacing: '0.2em',
    },
  },
  shape: {
    borderRadius: 2,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: MUJI.paper,
          color: MUJI.ink,
          letterSpacing: '0.02em',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
        outlined: {
          borderColor: MUJI.line,
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 2,
          boxShadow: 'none',
          '&:hover': { boxShadow: 'none' },
        },
        containedPrimary: {
          backgroundColor: MUJI.red,
          color: MUJI.card,
          '&:hover': { backgroundColor: '#6a0015' },
        },
        outlined: {
          borderColor: MUJI.line,
          color: MUJI.ink2,
          '&:hover': { borderColor: '#b9b2a5', backgroundColor: 'transparent' },
        },
        sizeSmall: { fontSize: 12, letterSpacing: '0.1em', padding: '3px 10px' },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 2,
          backgroundColor: MUJI.card,
          '& fieldset': { borderColor: MUJI.line },
          '&:hover fieldset': { borderColor: '#b9b2a5' },
          '&.Mui-focused fieldset': { borderColor: MUJI.red },
        },
        input: { fontWeight: 300 },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: { fontWeight: 300, letterSpacing: '0.1em' },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: { borderRadius: 3, backgroundImage: 'none' },
      },
    },
    MuiTable: {
      styleOverrides: {
        root: { backgroundColor: MUJI.card },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          backgroundColor: MUJI.paper2,
          color: MUJI.ink3,
          fontWeight: 300,
          fontSize: 12,
          letterSpacing: '0.1em',
          whiteSpace: 'nowrap',
        },
        root: {
          fontSize: 13,
          fontWeight: 300,
          borderBottom: `1px solid ${MUJI.lineSoft}`,
          whiteSpace: 'nowrap',
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        root: { borderBottom: `1px solid ${MUJI.line}`, minHeight: 42 },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          fontWeight: 300,
          letterSpacing: '0.15em',
          minHeight: 42,
          fontSize: 14,
          color: MUJI.ink2,
          '&.Mui-selected': { color: MUJI.red },
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: { backgroundColor: MUJI.ink, fontSize: 12, fontWeight: 300 },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: 2, fontWeight: 300 },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 2, fontWeight: 300 },
      },
    },
  },
});
