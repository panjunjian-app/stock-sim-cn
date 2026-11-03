import { useMemo, useState } from 'react';
import { Box, InputAdornment, MenuItem, TextField, Typography } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import stockList from '../data/stock-list.json';
import { MUJI } from '../theme/muji-theme';
import type { Symbol as StockSymbol } from '../../shared/types';

interface StockItem {
  symbol: StockSymbol;
  name: string;
  market: string;
}

const STOCKS = (stockList as { stocks: StockItem[] }).stocks;

export interface StockSearchProps {
  value: StockSymbol;
  onChange: (symbol: StockSymbol) => void;
}

/** StockSearch — 股票池本地搜索选择（支持代码/名称模糊匹配，未收录代码可直接在委托面板输入） */
export default function StockSearch({ value, onChange }: StockSearchProps) {
  const [keyword, setKeyword] = useState('');

  const filtered = useMemo(() => {
    const k = keyword.trim().toLowerCase();
    if (!k) {
      return STOCKS.slice(0, 20);
    }
    return STOCKS.filter((s) => s.symbol.includes(k) || s.name.replace(/\s/g, '').toLowerCase().includes(k)).slice(0, 20);
  }, [keyword]);

  return (
    <Box>
      <Typography sx={{ fontSize: 12, color: MUJI.ink2, letterSpacing: '0.15em', mb: 1 }}>搜索股票</Typography>
      <TextField
        select
        fullWidth
        size="small"
        value={value}
        onChange={(e) => onChange(e.target.value as StockSymbol)}
        sx={{
          '& .MuiInputBase-root': { bgcolor: MUJI.card, fontWeight: 300, fontSize: 14 },
          '& .MuiSelect-select': { display: 'flex', alignItems: 'center' },
        }}
        SelectProps={{ displayEmpty: true }}
      >
        {filtered.map((s) => (
          <MenuItem key={s.symbol} value={s.symbol} sx={{ fontWeight: 300, fontSize: 13 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
              <span>{s.name}</span>
              <Box component="span" sx={{ color: MUJI.ink3, fontSize: 11, ml: 2 }} className="num">
                {s.symbol.replace(/^(sh|sz)/, '')} · {s.market}
              </Box>
            </Box>
          </MenuItem>
        ))}
        {filtered.length === 0 && (
          <MenuItem disabled sx={{ fontSize: 12 }}>
            未找到，可直接在右侧输入代码委托
          </MenuItem>
        )}
      </TextField>
      <Box sx={{ mt: 1 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="输入代码 / 名称过滤"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ fontSize: 16, color: MUJI.ink3 }} />
              </InputAdornment>
            ),
          }}
          sx={{ '& .MuiInputBase-input': { fontSize: 12.5, fontWeight: 300 } }}
        />
      </Box>
    </Box>
  );
}

export { STOCKS };
export type { StockItem };
