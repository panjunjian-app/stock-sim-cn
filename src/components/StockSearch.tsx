import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, CircularProgress, InputAdornment, MenuItem, TextField, Typography } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import stockList from '../data/stock-list.json';
import { MUJI } from '../theme/muji-theme';
import { marketApi, StockSearchItem } from '../services/market-api';
import type { Symbol as StockSymbol } from '../../shared/types';

interface StockItem {
  symbol: StockSymbol;
  name: string;
  market: string;
}

const STOCKS = (stockList as { stocks: StockItem[] }).stocks;

/** 本地股票名兜底映射（选中远程搜索的股票后，下拉框显示名称用） */
const nameMap = new Map<string, string>(STOCKS.map((s) => [s.symbol, s.name]));

export interface StockSearchProps {
  value: StockSymbol;
  onChange: (symbol: StockSymbol) => void;
}

/** StockSearch — 全市场搜索（东财免费接口：代码/名称/拼音）+ 本地股票池快捷选择 */
export default function StockSearch({ value, onChange }: StockSearchProps) {
  const [keyword, setKeyword] = useState('');
  const [remote, setRemote] = useState<StockSearchItem[] | null>(null);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // 远程搜索：≥2 字符防抖 300ms；失败/无结果显示提示
  useEffect(() => {
    const k = keyword.trim();
    if (k.length < 2) {
      setRemote(null);
      setSearching(false);
      return;
    }
    let alive = true;
    setSearching(true);
    const timer = setTimeout(() => {
      marketApi
        .searchStocks(k)
        .then((r) => {
          if (!alive) return;
          setRemote(r);
          r.forEach((it) => nameMap.set(it.symbol, it.name));
        })
        .catch(() => alive && setRemote([]))
        .finally(() => alive && setSearching(false));
    }, 300);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [keyword]);

  const filtered = useMemo(() => {
    const k = keyword.trim().toLowerCase();
    if (!k) return STOCKS.slice(0, 12);
    return STOCKS.filter((s) => s.symbol.includes(k) || s.name.replace(/\s/g, '').toLowerCase().includes(k)).slice(0, 12);
  }, [keyword]);

  // 下拉框选项：本地池 + 确保当前选中项在列（远程选中且不在池内时补入）
  const selectItems = useMemo(() => {
    const list: StockItem[] = [...filtered];
    if (!list.some((s) => s.symbol === value)) {
      list.unshift({ symbol: value, name: nameMap.get(value) ?? value.replace(/^(sh|sz)/, ''), market: value.startsWith('sh') ? '沪A' : '深A' });
    }
    return list.slice(0, 13);
  }, [filtered, value]);

  const pickRemote = (it: StockSearchItem) => {
    onChange(it.symbol as StockSymbol);
    setKeyword('');
    setRemote(null);
    inputRef.current?.blur();
  };

  const showRemotePanel = remote !== null;
  const codeOf = (s: string) => s.replace(/^(sh|sz)/, '');

  return (
    <Box>
      <Typography sx={{ fontSize: 12, color: MUJI.ink2, letterSpacing: '0.05em', mb: 1 }}>搜索股票</Typography>

      {/* 当前选中 */}
      <TextField
        select
        fullWidth
        size="small"
        value={value}
        onChange={(e) => onChange(e.target.value as StockSymbol)}
        sx={{
          mb: 1,
          '& .MuiInputBase-root': { bgcolor: MUJI.card, fontWeight: 400, fontSize: 14 },
          '& .MuiSelect-select': { display: 'flex', alignItems: 'center' },
        }}
        SelectProps={{ displayEmpty: true }}
      >
        {selectItems.map((s) => (
          <MenuItem key={s.symbol} value={s.symbol} sx={{ fontWeight: 400, fontSize: 13 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
              <span>{s.name}</span>
              <Box component="span" sx={{ color: MUJI.ink3, fontSize: 11, ml: 2 }} className="num">
                {codeOf(s.symbol)} · {s.market}
              </Box>
            </Box>
          </MenuItem>
        ))}
      </TextField>

      {/* 搜索框（远程全市场） */}
      <TextField
        fullWidth
        size="small"
        placeholder="输入代码 / 名称 / 拼音，回车搜全市场"
        inputRef={inputRef}
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && remote && remote.length > 0) pickRemote(remote[0]);
        }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon sx={{ fontSize: 16, color: MUJI.ink3 }} />
            </InputAdornment>
          ),
          endAdornment: searching ? <CircularProgress size={13} sx={{ color: MUJI.ink3 }} /> : undefined,
        }}
        sx={{ '& .MuiInputBase-input': { fontSize: 12.5, fontWeight: 400 } }}
      />

      {/* 远程搜索结果面板 */}
      {showRemotePanel && (
        <Box
          sx={{
            mt: 0.5,
            border: `1px solid ${MUJI.line}`,
            borderRadius: '2px',
            bgcolor: MUJI.card,
            maxHeight: 260,
            overflowY: 'auto',
          }}
        >
          {remote.length === 0 ? (
            <Typography sx={{ px: 1.5, py: 1.2, fontSize: 12, color: MUJI.ink3 }}>
              未找到「{keyword.trim()}」对应的沪深 A 股
            </Typography>
          ) : (
            remote.map((it) => (
              <Box
                key={it.symbol}
                onClick={() => pickRemote(it)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  px: 1.5,
                  py: 0.9,
                  cursor: 'pointer',
                  borderBottom: `1px solid ${MUJI.lineSoft}`,
                  '&:hover': { bgcolor: 'rgba(0,0,0,0.03)' },
                  '&:last-child': { borderBottom: 'none' },
                }}
              >
                <Typography sx={{ fontSize: 12.5, color: MUJI.ink }}>{it.name}</Typography>
                <Typography sx={{ fontSize: 11, color: MUJI.ink3 }} className="num">
                  {codeOf(it.symbol)} · {it.market}
                </Typography>
              </Box>
            ))
          )}
        </Box>
      )}
    </Box>
  );
}

export { STOCKS };
export type { StockItem };
