/**
 * SegmentedControl — 通用分段选择器（买/卖、时间范围、周期切换通用）。
 * 选项过多（scrollable）时横向滚动不压缩，触控目标随容器 ≥44px。
 */
import { Box } from '@mui/material';
import { MUJI } from '../../theme/muji-theme';

export interface SegmentedControlProps<T extends string> {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
  /** 超宽时横向滚动（每个选项不压缩、保留完整触控宽度） */
  scrollable?: boolean;
}

export default function SegmentedControl<T extends string>({ value, options, onChange, scrollable = false }: SegmentedControlProps<T>) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'stretch',
        gap: '3px',
        bgcolor: MUJI.paper2,
        borderRadius: '6px',
        p: '3px',
        overflowX: 'auto',
        ...(scrollable ? {} : { width: '100%' }),
      }}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Box
            key={o.value}
            onClick={() => onChange(o.value)}
            sx={{
              flex: scrollable ? '0 0 auto' : '1 1 0',
              px: 2,
              minHeight: 40,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 13.5,
              fontWeight: active ? 500 : 400,
              whiteSpace: 'nowrap',
              borderRadius: '4px',
              cursor: 'pointer',
              color: active ? MUJI.ink : MUJI.ink3,
              bgcolor: active ? MUJI.card : 'transparent',
              border: `1px solid ${active ? MUJI.line : 'transparent'}`,
            }}
          >
            {o.label}
          </Box>
        );
      })}
    </Box>
  );
}
