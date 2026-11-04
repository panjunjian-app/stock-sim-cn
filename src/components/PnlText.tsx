import { Box } from '@mui/material';
import { MUJI } from '../theme/muji-theme';

export interface PnlTextProps {
  /** 用于判定涨跌方向的数值（正=涨红，负=跌绿，0=平盘灰） */
  value: number;
  /** 展示文本（已格式化） */
  text: string;
  /** 平盘时也着色（默认灰色） */
  colorFlat?: boolean;
}

/** 根据数值符号返回语义色：涨红 #a03e35 / 跌绿 #4f7d5c / 平盘灰 */
export function pnlColor(value: number, colorFlat = false): string {
  if (value > 0) {
    return MUJI.up;
  }
  if (value < 0) {
    return MUJI.down;
  }
  return colorFlat ? MUJI.ink : MUJI.ink2;
}

/** PnlText — A股语义「红涨绿跌」文本组件 */
export default function PnlText({ value, text, colorFlat }: PnlTextProps) {
  return (
    <Box component="span" className="num" sx={{ color: pnlColor(value, colorFlat), fontWeight: 400 }}>
      {text}
    </Box>
  );
}
