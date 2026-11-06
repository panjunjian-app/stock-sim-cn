/**
 * PriceField — 移动端数值输入（价格/数量通用）：
 * inputMode="decimal" 唤起数字键盘 + ± 步进按钮，输入高度 48px。
 */
import { Box, IconButton, InputAdornment, TextField, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import { MUJI } from '../../theme/muji-theme';
import { BTN_H } from '../theme';

export interface PriceFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  /** 步进按钮单步幅度（单位与输入一致，默认 0.01） */
  step?: number;
  /** 输入上限（可省略，步进时封顶） */
  max?: number;
  /** 下方提示（如可用资金 / 可卖股数） */
  hint?: string;
  placeholder?: string;
}

/** 步进结果：两位小数格式化 + ≥0 封顶 */
function stepFmt(n: number, max?: number): string {
  const capped = max !== undefined ? Math.min(n, max) : n;
  return String(Number(Math.max(capped, 0).toFixed(2)));
}

export default function PriceField({ label, value, onChange, step = 0.01, max, hint, placeholder }: PriceFieldProps) {
  const applyStep = (dir: 1 | -1): void => {
    const cur = parseFloat(value);
    const base = Number.isFinite(cur) ? cur : 0;
    onChange(stepFmt(base + dir * step, max));
  };

  // 只保留数字与一个小数点
  const sanitize = (v: string): string => v.replace(/[^\d.]/g, '').replace(/(\..*?)\./g, '$1');

  return (
    <Box>
      <Typography sx={{ fontSize: 12, color: MUJI.ink2, letterSpacing: '0.05em', mb: 0.75 }}>{label}</Typography>
      <TextField
        fullWidth
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(sanitize(e.target.value))}
        inputProps={{ inputMode: 'decimal' }}
        sx={{ '& .MuiInputBase-root': { height: BTN_H, bgcolor: MUJI.card } }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <IconButton size="small" aria-label="减少" onClick={() => applyStep(-1)} sx={{ width: 40, height: 40 }}>
                <RemoveIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </InputAdornment>
          ),
          endAdornment: (
            <InputAdornment position="end">
              <IconButton size="small" aria-label="增加" onClick={() => applyStep(1)} sx={{ width: 40, height: 40 }}>
                <AddIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </InputAdornment>
          ),
        }}
      />
      {hint && (
        <Typography className="num" sx={{ fontSize: 11, color: MUJI.ink3, mt: 0.5 }}>
          {hint}
        </Typography>
      )}
    </Box>
  );
}
