import { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import type { AccountInfo, Quote, Symbol as StockSymbol } from '../../shared/types';
import { MUJI } from '../theme/muji-theme';
import { accountApi } from '../services/account-api';
import { collectSymbols } from '../services/account-api';
import { useQuotePolling } from '../hooks/use-quote-polling';
import { useQuoteStore } from '../store/quote-store';
import AccountCard from '../components/AccountCard';
import OpenAccountDialog from '../components/OpenAccountDialog';
import { ApiError } from '../services/http';

const MAX_ACCOUNTS = 5;

/** AccountListPage — ③ 登录后首页：账户卡片网格 + 开户弹窗 */
export default function AccountListPage() {
  const [accounts, setAccounts] = useState<AccountInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cachedQuotes = useQuoteStore((s) => s.quotes);
  const personalAccounts = accounts.filter((a) => !a.contestId);
  const contestAccounts = accounts.filter((a) => !!a.contestId);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { accounts: list } = await accountApi.listAccounts();
      setAccounts(list);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '账户列表加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // 持仓相关标的的行情轮询（用于卡片总资产/盈亏即时计算）
  const heldSymbols = useMemo<StockSymbol[]>(() => collectSymbols(accounts), [accounts]);
  const { quotes: polled } = useQuotePolling(heldSymbols);
  const quotes: Record<StockSymbol, Quote> = polled ?? cachedQuotes;

  const handleDelete = async (account: AccountInfo) => {
    if (account.contestId && account.contestStatus !== 'finished' && account.contestStatus !== 'cancelled') {
      window.alert('比赛进行中，比赛账户不可删除（比赛结束后转入历史记录即可删除）');
      return;
    }
    if (!window.confirm(`确认删除账户「${account.name}」？虚拟资金与持仓将一并清除，不可恢复。`)) {
      return;
    }
    try {
      await accountApi.deleteAccount(account.id);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '删除失败');
    }
  };

  return (
    <Box sx={{ flex: 1, px: 6.5, pt: 3.5, overflowY: 'auto', minHeight: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2.75 }}>
        <Typography sx={{ fontSize: 18, fontWeight: 400, letterSpacing: '0.05em', flex: 1 }}>
          我的交易账户
          <Typography component="small" sx={{ fontSize: 12, color: MUJI.ink3, fontWeight: 400, ml: 1.5, letterSpacing: '0.1em' }}>
            共 {personalAccounts.length} 个
          </Typography>
        </Typography>
        <Button
          variant="contained"
          sx={{ height: 38, px: 2.75, fontSize: 13 }}
          disabled={personalAccounts.length >= MAX_ACCOUNTS}
          onClick={() => setDialogOpen(true)}
        >
          ＋ 开新账户
        </Button>
      </Box>

      {error && (
        <Typography sx={{ fontSize: 12.5, color: MUJI.up, mb: 2 }}>{error}</Typography>
      )}

      {loading ? (
        <Typography sx={{ fontSize: 13, color: MUJI.ink3, letterSpacing: '0.1em' }}>加载中…</Typography>
      ) : personalAccounts.length === 0 ? (
        <Box
          sx={{
            bgcolor: MUJI.card,
            border: `1px dashed ${MUJI.line}`,
            borderRadius: '2px',
            p: 6,
            textAlign: 'center',
          }}
        >
          <Typography sx={{ fontSize: 14, color: MUJI.ink, fontWeight: 400, letterSpacing: '0.05em' }}>
            还没有交易账户
          </Typography>
          <Typography sx={{ fontSize: 12, color: MUJI.ink2, mt: 1 }}>
            开立你的第一个模拟账户，注入虚拟资金开始练习
          </Typography>
          <Button variant="contained" sx={{ mt: 3, height: 40, px: 3 }} onClick={() => setDialogOpen(true)}>
            ＋ 立即开户
          </Button>
        </Box>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 2 }}>
          {personalAccounts.map((a) => (
            <AccountCard key={a.id} account={a} quotes={quotes} onDelete={(acc) => void handleDelete(acc)} />
          ))}
        </Box>
      )}

      {/* 比赛账户（大比拼）：赛期资金锁定不可删；已结束比赛账户转入历史记录后可删除 */}
      {contestAccounts.length > 0 && (
        <Box sx={{ mt: 4 }}>
          <Typography sx={{ fontSize: 18, fontWeight: 400, letterSpacing: '0.05em', mb: 2.75 }}>
            🏆 比赛账户
            <Typography component="small" sx={{ fontSize: 12, color: MUJI.ink3, fontWeight: 400, ml: 1.5, letterSpacing: '0.1em' }}>
              赛期资金锁定 · 不可入金 · 比赛结束后转入历史记录即可删除
            </Typography>
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 2 }}>
            {contestAccounts.map((a) => {
              const isHistory = a.contestStatus === 'finished' || a.contestStatus === 'cancelled';
              return (
                <AccountCard
                  key={a.id}
                  account={a}
                  quotes={quotes}
                  deletable={isHistory}
                  historyBadge={isHistory}
                  onDelete={(acc) => void handleDelete(acc)}
                />
              );
            })}
          </Box>
        </Box>
      )}

      <OpenAccountDialog
        open={dialogOpen}
        currentCount={accounts.length}
        maxCount={MAX_ACCOUNTS}
        onClose={() => setDialogOpen(false)}
        onCreated={() => void load()}
      />
    </Box>
  );
}
