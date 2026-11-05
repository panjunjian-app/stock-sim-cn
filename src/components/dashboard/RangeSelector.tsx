/**
 * RangeSelector — 时间范围选择器（URL query 驱动）
 */
import { ToggleButton, ToggleButtonGroup } from '@mui/material';
import { useSearchParams } from 'react-router-dom';
import { MUJI } from '../../theme/muji-theme';

const OPTIONS: Array<{ value: string; label: string }> = [
  { value: '7d', label: '近7天' },
  { value: '30d', label: '近30天' },
  { value: '90d', label: '近90天' },
  { value: 'ytd', label: '今年至今' },
  { value: 'all', label: '全部' },
];

export default function RangeSelector() {
  const [params, setParams] = useSearchParams();
  const range = params.get('range') ?? '7d';
  return (
    <ToggleButtonGroup
      exclusive
      size="small"
      value={range}
      onChange={(_, v) => {
        if (v) {
          setParams(
            (p) => {
              const n = new URLSearchParams(p);
              n.set('range', v);
              return n;
            },
            { replace: true }
          );
        }
      }}
      sx={{
        '& .MuiToggleButton-root': {
          fontSize: 12.5,
          fontWeight: 400,
          px: 1.5,
          py: 0.4,
          color: MUJI.ink2,
          borderColor: MUJI.line,
          letterSpacing: '0.05em',
          '&.Mui-selected': { bgcolor: MUJI.red, color: '#ffffff', borderColor: MUJI.red, '&:hover': { bgcolor: MUJI.red } },
        },
      }}
    >
      {OPTIONS.map((o) => (
        <ToggleButton key={o.value} value={o.value}>
          {o.label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}
