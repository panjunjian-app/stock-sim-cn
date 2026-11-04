/**
 * muji-theme.ts — MUI 主题：MUJI 设计令牌（色板/字重 200·300/直角细线框）
 * 色值与 src/index.css 的 CSS 变量同源，禁止两处各写一份。
 */
import { createTheme, Theme } from '@mui/material/styles';

/** 炒炒乐设计令牌（OA 实用风：正常字重、高对比文字、橙色强调；与 index.css :root 一一对应） */
export const MUJI = {
  paper: '#f5f6f8',
  paper2: '#eceef1',
  card: '#ffffff',
  ink: '#262626',
  ink2: '#595959',
  ink3: '#8c8c8c',
  line: '#e8e8e8',
  lineSoft: '#f0f1f3',
  red: '#f08300',
  up: '#d93025',
  upBg: '#fdecea',
  down: '#00a854',
  downBg: '#e6f7ef',
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
    fontWeightLight: 400,
    fontWeightRegular: 400,
    fontWeightMedium: 500,
    fontWeightBold: 600,
    button: {
      textTransform: 'none',
      fontWeight: 500,
      letterSpacing: '0.05em',
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
          '&:hover': { backgroundColor: '#d67300' },
        },
        outlined: {
          borderColor: MUJI.line,
          color: MUJI.ink2,
          '&:hover': { borderColor: '#c7c9cd', backgroundColor: 'transparent' },
        },
        sizeSmall: { fontSize: 12, letterSpacing: '0.02em', padding: '3px 10px' },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 2,
          backgroundColor: MUJI.card,
          '& fieldset': { borderColor: MUJI.line },
          '&:hover fieldset': { borderColor: '#c7c9cd' },
          '&.Mui-focused fieldset': { borderColor: MUJI.red },
        },
        input: { fontWeight: 400 },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: { fontWeight: 400, letterSpacing: '0.02em' },
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
          fontWeight: 400,
          fontSize: 12,
          letterSpacing: '0.02em',
          whiteSpace: 'nowrap',
        },
        root: {
          fontSize: 13,
          fontWeight: 400,
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
          fontWeight: 400,
          letterSpacing: '0.05em',
          minHeight: 42,
          fontSize: 14,
          color: MUJI.ink2,
          '&.Mui-selected': { color: MUJI.red },
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: { backgroundColor: MUJI.ink, fontSize: 12, fontWeight: 400 },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: 2, fontWeight: 400 },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 2, fontWeight: 400 },
      },
    },
  },
});
