/**
 * AccountSelector — 账户维度选择器（全部账户汇总 / 单账户，URL query 驱动）
 */
import { MenuItem, Select } from '@mui/material';
import { useSearchParams } from 'react-router-dom';
import { MUJI } from '../../theme/muji-theme';

interface Props {
  accounts: Array<{ id: number; name: string }>;
}

export default function AccountSelector({ accounts }: Props) {
  const [params, setParams] = useSearchParams();
  const acct = params.get('acct') ?? 'all';
  return (
    <Select
      size="small"
      value={acct}
      onChange={(e) => {
        const v = String(e.target.value);
        setParams(
          (p) => {
            const n = new URLSearchParams(p);
            n.set('acct', v);
            return n;
          },
          { replace: true }
        );
      }}
      sx={{
        minWidth: 168,
        fontSize: 13,
        bgcolor: MUJI.card,
        '& .MuiOutlinedInput-notchedOutline': { borderColor: MUJI.line },
        '& .MuiSelect-select': { py: 0.55, fontSize: 13 },
      }}
    >
      <MenuItem value="all" sx={{ fontSize: 13 }}>
        全部账户汇总
      </MenuItem>
      {accounts.map((a) => (
        <MenuItem key={a.id} value={String(a.id)} sx={{ fontSize: 13 }}>
          {a.name}
        </MenuItem>
      ))}
    </Select>
  );
}
