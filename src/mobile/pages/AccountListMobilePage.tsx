/**
 * AccountListMobilePage — M5 我的账户（移动版）：
 * 账户卡片列表（复用 PC AccountCard，删除按钮常显、删除二次确认改 MUI Dialog）+
 * 底部固定「开立新账户」按钮 + 全屏开户 Dialog（验证逻辑与 PC OpenAccountDialog 一致）。
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogContentText, IconButton, Snackbar, TextField, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import type { AccountInfo } from '../../../shared/types';
import { toCents, formatYuanSymbol } from '../../../shared/money';
import { checkInitCash } from '../../../shared/validate';
import { MUJI } from '../../theme/muji-theme';
import { accountApi, collectSymbols } from '../../services/account-api';
import { ApiError } from '../../services/http';
import { useQuotePolling } from '../../hooks/use-quote-polling';
import { useQuoteStore } from '../../store/quote-store';
import AccountCard from '../../components/AccountCard';
import { BTN_H } from '../theme';

const MAX_ACCOUNTS = 5;

interface SnackState {
  text: string;
  ok: boolean;
}

/** 全屏开户弹层（移动版 OpenAccountDialog：同验证规则，fullScreen 布局） */
function OpenAccountSheet({ open, currentCount, onClose, onCreated }: { open: boolean; currentCount: number; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [cashYuan, setCashYuan] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const reset = (): void => {
    setName('');
    setCashYuan('');
    setError(null);
  };

  const cashCheck: { ok: boolean; reason?: string; cents?: number } = (() => {
    if (cashYuan.trim() === '') return { ok: true };
    const cents = toCents(cashYuan);
    if (Number.isNaN(cents)) return { ok: false, reason: '金额格式不正确（最多两位小数）' };
    const r = checkInitCash(cents);
    return r.ok ? { ok: true, cents } : { ok: false, reason: r.reason ?? '金额超出范围' };
  })();

  const submit = async (): Promise<void> => {
    if (!cashCheck.ok || typeof cashCheck.cents !== 'number') {
      setError('初始资金不能低于 10 元（范围：10 元 ~ 1000 万元）');
      return;
    }
    if (name.trim().length === 0 || name.trim().length > 20) {
      setError('账户名称需为 1~20 个字符');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await accountApi.openAccount(name.trim(), cashCheck.cents);
      reset();
      onCreated();
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '开户失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullScreen PaperProps={{ sx: { bgcolor: MUJI.paper } }}>
      {/* 顶栏 */}
      <Box sx={{ display: 'flex', alignItems: 'center', px: 1, py: 0.75, bgcolor: MUJI.card, borderBottom: `1px solid ${MUJI.line}` }}>
        <IconButton aria-label="关闭" onClick={() => { reset(); onClose(); }} sx={{ width: 44, height: 44 }}>
          <CloseIcon sx={{ fontSize: 20 }} />
        </IconButton>
        <Typography sx={{ fontSize: 15, fontWeight: 500, color: MUJI.ink }}>
          开立新交易账户
          <Typography component="span" sx={{ fontSize: 11, color: MUJI.ink3, ml: 1 }}>
            {currentCount}/{MAX_ACCOUNTS} 个
          </Typography>
        </Typography>
      </Box>
      <Box sx={{ flex: 1, overflowY: 'auto', px: 2.5, py: 2.5 }}>
        <Typography sx={{ fontSize: 12.5, color: MUJI.ink2, lineHeight: 1.8, mb: 2.5 }}>
          纯模拟账户，注入虚拟人民币资金，与真实财产无关
        </Typography>
        <Typography sx={{ fontSize: 12.5, color: MUJI.ink2, letterSpacing: '0.05em', mb: 1 }}>账户名称</Typography>
        <TextField
          fullWidth
          placeholder="如：稳健长线"
          value={name}
          onChange={(e) => setName(e.target.value)}
          inputProps={{ maxLength: 20 }}
          sx={{ '& .MuiInputBase-root': { height: BTN_H, bgcolor: MUJI.card } }}
        />
        <Typography sx={{ fontSize: 11, color: MUJI.ink3, mt: 0.75 }}>用于区分不同的练习策略，可随时修改</Typography>
        <Typography sx={{ fontSize: 12.5, color: MUJI.ink2, letterSpacing: '0.05em', mt: 2.5, mb: 1 }}>初始资金（元）</Typography>
        <TextField
          fullWidth
          placeholder="10000 ~ 10000000"
          value={cashYuan}
          error={!cashCheck.ok}
          onChange={(e) => setCashYuan(e.target.value)}
          inputProps={{ inputMode: 'decimal' }}
          sx={{ '& .MuiInputBase-root': { height: BTN_H, bgcolor: MUJI.card } }}
        />
        {cashCheck.ok && typeof cashCheck.cents === 'number' && (
          <Typography className="num" sx={{ fontSize: 11.5, color: MUJI.down, mt: 0.75 }}>
            将注入 {formatYuanSymbol(cashCheck.cents)} 虚拟资金
          </Typography>
        )}
        {!cashCheck.ok && (
          <Typography sx={{ fontSize: 11.5, color: MUJI.up, mt: 0.75 }}>{cashCheck.reason}</Typography>
        )}
        {error && (
          <Typography sx={{ fontSize: 12.5, color: MUJI.up, mt: 2 }}>{error}</Typography>
        )}
      </Box>
      <Box sx={{ px: 2.5, pt: 1.25, pb: 'calc(16px + env(safe-area-inset-bottom))', bgcolor: MUJI.card, borderTop: `1px solid ${MUJI.line}` }}>
        <Button fullWidth variant="contained" sx={{ height: BTN_H, fontSize: 15 }} disabled={submitting} onClick={() => void submit()}>
          {submitting ? '开户中…' : '确认开户'}
        </Button>
      </Box>
    </Dialog>
  );
}

export default function AccountListMobilePage() {
  const [accounts, setAccounts] = useState<AccountInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AccountInfo | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [snack, setSnack] = useState<SnackState | null>(null);
  const cachedQuotes = useQuoteStore((s) => s.quotes);

  const personalAccounts = accounts.filter((a) => !a.contestId);
  const contestAccounts = accounts.filter((a) => !!a.contestId);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { accounts: list } = await accountApi.listAccounts();
      setAccounts(list);
    } catch (e) {
      setSnack({ text: e instanceof ApiError ? e.message : '账户列表加载失败', ok: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // 持仓相关标的行情轮询（卡片总资产/盈亏即时计算）
  const heldSymbols = useMemo(() => collectSymbols(accounts), [accounts]);
  const { quotes: polled } = useQuotePolling(heldSymbols);
  const quotes = polled ?? cachedQuotes;

  const handleDelete = async (): Promise<void> => {
    const account = deleteTarget;
    if (!account) return;
    setDeleting(true);
    try {
      await accountApi.deleteAccount(account.id);
      setDeleteTarget(null);
      setSnack({ text: `账户「${account.name}」已删除`, ok: true });
      await load();
    } catch (e) {
      setSnack({ text: e instanceof ApiError ? e.message : '删除失败', ok: false });
    } finally {
      setDeleting(false);
    }
  };

  const requestDelete = (account: AccountInfo): void => {
    if (account.contestId && account.contestStatus !== 'finished' && account.contestStatus !== 'cancelled') {
      setSnack({ text: '比赛进行中，比赛账户不可删除（比赛结束后转入历史记录即可删除）', ok: false });
      return;
    }
    setDeleteTarget(account);
  };

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <Box sx={{ flex: 1, px: 2, py: 2 }}>
        <Typography sx={{ fontSize: 16, fontWeight: 500, letterSpacing: '0.05em', mb: 2 }}>
          我的交易账户
          <Typography component="span" sx={{ fontSize: 12, color: MUJI.ink3, fontWeight: 400, ml: 1 }}>
            共 {personalAccounts.length} 个
          </Typography>
        </Typography>

        {loading ? (
          <Typography sx={{ fontSize: 13, color: MUJI.ink3 }}>加载中…</Typography>
        ) : personalAccounts.length === 0 ? (
          <Box sx={{ bgcolor: MUJI.card, border: `1px dashed ${MUJI.line}`, borderRadius: '6px', p: 5, textAlign: 'center' }}>
            <Typography sx={{ fontSize: 14, color: MUJI.ink, fontWeight: 500 }}>还没有交易账户</Typography>
            <Typography sx={{ fontSize: 12, color: MUJI.ink2, mt: 1, lineHeight: 1.8 }}>
              开立你的第一个模拟账户，注入虚拟资金开始练习
            </Typography>
            <Button variant="contained" sx={{ mt: 2.5, minHeight: 44, px: 3 }} onClick={() => setDialogOpen(true)}>
              ＋ 立即开户
            </Button>
          </Box>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr', gap: 1.5 }}>
            {personalAccounts.map((a) => (
              <AccountCard key={a.id} account={a} quotes={quotes} onDelete={requestDelete} />
            ))}
          </Box>
        )}

        {/* 比赛账户：赛期资金锁定不可删；已结束比赛账户转入历史记录后可删除 */}
        {contestAccounts.length > 0 && (
          <Box sx={{ mt: 3.5 }}>
            <Typography sx={{ fontSize: 15, fontWeight: 500, letterSpacing: '0.05em', mb: 2 }}>
              🏆 比赛账户
              <Typography component="span" sx={{ fontSize: 11, color: MUJI.ink3, fontWeight: 400, ml: 1 }}>
                赛期资金锁定 · 不可入金
              </Typography>
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr', gap: 1.5 }}>
              {contestAccounts.map((a) => {
                const isHistory = a.contestStatus === 'finished' || a.contestStatus === 'cancelled';
                return <AccountCard key={a.id} account={a} quotes={quotes} deletable={isHistory} historyBadge={isHistory} onDelete={requestDelete} />;
              })}
            </Box>
          </Box>
        )}
      </Box>

      {/* 底部固定开户按钮 */}
      <Box
        sx={{
          position: 'sticky',
          bottom: 0,
          px: 2,
          pt: 1.25,
          pb: 'calc(12px + env(safe-area-inset-bottom))',
          bgcolor: MUJI.card,
          borderTop: `1px solid ${MUJI.line}`,
          marginTop: 'auto',
        }}
      >
        <Button
          fullWidth
          variant="contained"
          disabled={personalAccounts.length >= MAX_ACCOUNTS}
          sx={{ height: BTN_H, fontSize: 15 }}
          onClick={() => setDialogOpen(true)}
        >
          {personalAccounts.length >= MAX_ACCOUNTS ? '账户数已达上限（5 个）' : '＋ 开立新账户'}
        </Button>
      </Box>

      {/* 全屏开户弹层 */}
      <OpenAccountSheet open={dialogOpen} currentCount={accounts.length} onClose={() => setDialogOpen(false)} onCreated={() => void load()} />

      {/* 删除二次确认 */}
      <Dialog open={deleteTarget !== null} onClose={() => !deleting && setDeleteTarget(null)} fullWidth maxWidth="xs">
        <DialogContent>
          <DialogContentText sx={{ fontSize: 13.5, lineHeight: 1.9 }}>
            确认删除账户「{deleteTarget?.name}」？
            <br />
            虚拟资金与持仓将一并清除，不可恢复。
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1.25 }}>
          <Button disabled={deleting} onClick={() => setDeleteTarget(null)} sx={{ flex: 1, minHeight: 44, color: MUJI.ink2 }}>
            取消
          </Button>
          <Button disabled={deleting} onClick={() => void handleDelete()} sx={{ flex: 1, minHeight: 44, color: MUJI.up }}>
            {deleting ? '删除中…' : '确认删除'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 结果 Snackbar */}
      <Snackbar
        open={snack !== null}
        autoHideDuration={3000}
        onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        message={snack?.text ?? ''}
        sx={{ '& .MuiSnackbarContent-root': { bgcolor: snack?.ok ? MUJI.down : MUJI.up } }}
      />
    </Box>
  );
}
