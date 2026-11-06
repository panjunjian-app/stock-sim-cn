/**
 * src/mobile/theme.ts — 移动端触控规范常量与公共 sx 工厂（唯一尺寸定义处）
 * 触控目标 ≥44px；全宽主按钮/输入框 48px；底部 Tab 52px。
 * 视觉变量全部读 MUJI，禁止在此引入新色值。
 */
import type { SxProps, Theme } from '@mui/material';
import { MUJI } from '../theme/muji-theme';

/** 最小触控目标（px） */
export const TOUCH_MIN = 44;
/** 全宽主按钮 / 输入框高度（px） */
export const BTN_H = 48;
/** 底部 Tab 高度（px，另加 safe-area-inset-bottom） */
export const TAB_H = 52;
/** iOS 底部安全区 env 变量 */
export const SAFE_BOTTOM = 'env(safe-area-inset-bottom)';

/** 触控友好按钮基础样式（≥44px、零 hover 依赖）；传入 accent 时为主色实心按钮 */
export function touchBtnSx(accent?: string): SxProps<Theme> {
  return {
    minHeight: TOUCH_MIN,
    px: 2.5,
    fontSize: 14.5,
    fontWeight: 500,
    borderRadius: '4px',
    ...(accent ? { bgcolor: accent, color: '#ffffff' } : {}),
  };
}

/** 卡片容器公共样式（纸卡细线框）；clickable 时附带手型光标 */
export function cardSx(clickable = false): SxProps<Theme> {
  return {
    bgcolor: MUJI.card,
    border: `1px solid ${MUJI.line}`,
    borderRadius: '6px',
    ...(clickable ? { cursor: 'pointer' } : {}),
  };
}
