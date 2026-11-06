/**
 * ContestsMobilePage — M7 炒炒乐大比拼（移动版 P1）：
 * 规则折叠条 + 「发起挑战」「邀请收件箱（badge）」置顶 + 比赛卡片纵向排列
 * （30s 自动刷新）+ 发起人取消（底部弹层二次确认）。复用 InviteDialog /
 * InvitationsDialog / ContestRankingChart。
 */
import { useCallback, useEffect, useState } from 'react';
import { Badge, Box, Button, Collapse, Dialog, DialogActions, DialogContent, DialogContentText, Snackbar, Typography } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { contestApi } from '../../services/contest-api';
import type { ContestInfo } from '../../../shared/types';
import { useAuthStore } from '../../store/auth-store';
import { MUJI } from '../../theme/muji-theme';
import { formatYuanSymbol } from '../../../shared/money';
import InviteDialog from '../../components/contest/InviteDialog';
import InvitationsDialog from '../../components/contest/InvitationsDialog';
import ContestRankingChart from '../../components/contest/ContestRankingChart';

const CANCEL_AFTER_MS = 24 * 60 * 60 * 1000;

interface SnackState {
  text: string;
  ok: boolean;
}

export default function ContestsMobilePage() {
  const [contests, setContests] = useState<ContestInfo[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState(0);
  const [loading, setLoading] = useState(true);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<ContestInfo | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [snack, setSnack] = useState<SnackState | null>(null);
  const user = useAuthStore((s) => s.user);

  const load = useCallback(async () => {
    try {
      const r = await contestApi.list();
      setContests(r.contests);
      setPendingInvitations(r.pendingInvitations);
    } catch {
      if (contests.length === 0) setSnack({ text: '比赛数据加载失败', ok: false });
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(t);
  }, [load]);

  const active = contests.filter((c) => c.status === 'active');
  const pending = contests.filter((c) => c.status === 'pending');
  const finished = contests.filter((c) => c.status === 'finished');
  const cancelled = contests.filter((c) => c.status === 'cancelled');

  /** 发起人可取消：pending 且发起满 24 小时仍未全员确认 */
  const canCancel = (c: ContestInfo): boolean =>
    c.status === 'pending' && c.creator.userId === user?.id && Date.now() - new Date(c.createdAt).getTime() >= CANCEL_AFTER_MS;

  const handleCancel = async (): Promise<void> => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await contestApi.cancel(cancelTarget.id);
      setSnack({ text: `挑战「${cancelTarget.name}」已取消，已通知已确认参加的用户`, ok: true });
      setCancelTarget(null);
      await load();
    } catch {
      setSnack({ text: '取消失败，请稍后重试', ok: false });
    } finally {
      setCancelling(false);
    }
  };

  return (
    <Box sx={{ flex: 1, px: 2, py: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* 顶部操作区 */}
      <Box sx={{ display: 'flex', gap: 1.5 }}>
        <Button
          fullWidth
          variant="contained"
          onClick={() => setInviteOpen(true)}
          sx={{ minHeight: 48, fontSize: 14, bgcolor: MUJI.red, '&:hover': { bgcolor: MUJI.red } }}
        >
          ⚔️ 发起挑战
        </Button>
        <Badge
          badgeContent={pendingInvitations > 9 ? '9+' : pendingInvitations}
          color="error"
          invisible={pendingInvitations === 0}
          sx={{ flex: 1, '& .MuiBadge-badge': { fontSize: 11, minWidth: 18, height: 18, right: 10 } }}
        >
          <Button
            fullWidth
            variant="outlined"
            onClick={() => setInboxOpen(true)}
            sx={{ minHeight: 48, fontSize: 14, borderColor: pendingInvitations > 0 ? MUJI.red : MUJI.line, color: pendingInvitations > 0 ? MUJI.red : MUJI.ink2 }}
          >
            📥 邀请收件箱
          </Button>
        </Badge>
      </Box>

      {/* 比赛规则（折叠条） */}
      <Box sx={{ bgcolor: MUJI.card, border: `1px dashed ${MUJI.line}`, borderRadius: '6px', px: 2, py: 1.25 }}>
        <Box onClick={() => setRulesOpen((v) => !v)} sx={{ display: 'flex', alignItems: 'center', minHeight: 44, cursor: 'pointer' }}>
          <Typography sx={{ fontSize: 13, fontWeight: 500, color: MUJI.ink2 }}>📜 比赛规则（防坐赢：游手好闲费）</Typography>
          {rulesOpen ? <ExpandLessIcon sx={{ ml: 'auto', fontSize: 20, color: MUJI.ink3 }} /> : <ExpandMoreIcon sx={{ ml: 'auto', fontSize: 20, color: MUJI.ink3 }} />}
        </Box>
        <Collapse in={rulesOpen}>
          <Typography sx={{ fontSize: 12, color: MUJI.ink2, lineHeight: 1.9, pb: 1.25 }}>
            进行中比赛每个交易日收市后检查各参赛比赛账户，<b>开赛首个交易日豁免，自第二个交易日起，开赛以来从未有过买卖成交的账户将收取「游手好闲费」＝ 初始资金 × 1%</b>
            （费用记入该账户资金流水，现金不足按可用实扣）；一旦发生过买卖成交，永久免收。拒绝躺赢，动起来！
          </Typography>
        </Collapse>
      </Box>

      {loading && contests.length === 0 ? (
        <Typography sx={{ fontSize: 13, color: MUJI.ink3, py: 8, textAlign: 'center' }}>比赛数据加载中…</Typography>
      ) : contests.length === 0 ? (
        <Box sx={{ bgcolor: MUJI.card, border: `1px dashed ${MUJI.line}`, borderRadius: '6px', p: 5, textAlign: 'center' }}>
          <Typography sx={{ fontSize: 14, color: MUJI.ink, fontWeight: 500 }}>还没有参加任何比赛</Typography>
          <Typography sx={{ fontSize: 12, color: MUJI.ink2, mt: 1, lineHeight: 2 }}>
            点上方「发起挑战」向好友的注册邮箱发出炒股比拼邀请
            <br />
            每人初始资金 1万~1000万 · 周期 1/3/6/12 个月
            <br />
            含发起人最多 5 人 · 同时进行最多 4 场
          </Typography>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          {pending.length > 0 && (
            <Box>
              <Typography sx={{ fontSize: 13.5, fontWeight: 500, color: MUJI.ink2, mb: 1 }}>⏳ 等待确认（未全员同意，暂未开赛）</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {pending.map((c) => {
                  const accepted = c.participants.filter((p) => p.inviteStatus === 'accepted').length;
                  return (
                    <Box key={c.id} sx={{ bgcolor: MUJI.card, border: `1px solid ${MUJI.line}`, borderRadius: '6px', px: 2, py: 1.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography sx={{ fontSize: 14, fontWeight: 500, color: MUJI.ink }}>{c.name}</Typography>
                        {canCancel(c) && (
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => setCancelTarget(c)}
                            sx={{ ml: 'auto', fontSize: 12, color: MUJI.red, borderColor: MUJI.red, minWidth: 88, minHeight: 40 }}
                          >
                            取消挑战
                          </Button>
                        )}
                      </Box>
                      <Typography className="num" sx={{ fontSize: 12, color: MUJI.ink3, mt: 0.5 }}>
                        已确认 {accepted}/{c.participants.length} 人 ｜ 每人初始 {formatYuanSymbol(c.initCash)}
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.75 }}>
                        {c.participants.map((p) => {
                          const icon = p.inviteStatus === 'accepted' ? '✓' : p.inviteStatus === 'declined' ? '✗' : '…';
                          const label = p.nickname !== p.email ? `${p.nickname}（${p.email}）` : p.email;
                          return (
                            <Typography key={p.userId} sx={{ fontSize: 11.5, color: MUJI.ink3, mr: 1.5 }}>
                              {label}（{icon}）
                            </Typography>
                          );
                        })}
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            </Box>
          )}

          {active.length > 0 && (
            <Box>
              <Typography sx={{ fontSize: 13.5, fontWeight: 500, color: MUJI.ink2, mb: 1 }}>🏁 进行中的比赛（{active.length}/3）</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {active.map((c) => (
                  <ContestRankingChart key={c.id} contest={c} />
                ))}
              </Box>
            </Box>
          )}

          {finished.length > 0 && (
            <Box>
              <Typography sx={{ fontSize: 13.5, fontWeight: 500, color: MUJI.ink2, mb: 1 }}>🏆 历史比拼结果（可复盘）</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {finished.map((c) => (
                  <ContestRankingChart key={c.id} contest={c} />
                ))}
              </Box>
            </Box>
          )}

          {cancelled.length > 0 && (
            <Box>
              <Typography sx={{ fontSize: 13.5, fontWeight: 500, color: MUJI.ink2, mb: 1 }}>🚫 已取消的挑战</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {cancelled.map((c) => (
                  <Box key={c.id} sx={{ bgcolor: MUJI.card, border: `1px solid ${MUJI.line}`, borderRadius: '6px', px: 2, py: 1.5 }}>
                    <Typography sx={{ fontSize: 13.5, color: MUJI.ink3, fontWeight: 500, textDecoration: 'line-through' }}>{c.name}</Typography>
                    <Typography className="num" sx={{ fontSize: 12, color: MUJI.ink3, mt: 0.5 }}>
                      ❌ 已取消（24 小时内未获全员确认） ｜ 每人初始 {formatYuanSymbol(c.initCash)}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          )}
        </Box>
      )}

      <InviteDialog open={inviteOpen} onClose={() => setInviteOpen(false)} onCreated={() => void load()} />
      <InvitationsDialog open={inboxOpen} onClose={() => setInboxOpen(false)} onChanged={() => void load()} />

      {/* 取消挑战二次确认（底部弹层） */}
      <Dialog open={cancelTarget !== null} onClose={() => (cancelling ? undefined : setCancelTarget(null))} fullWidth maxWidth="xs">
        <DialogContent>
          <DialogContentText sx={{ fontSize: 13.5, lineHeight: 1.9 }}>
            确定取消挑战「{cancelTarget?.name}」吗？
            <br />
            取消后比赛作废，已确认参加的用户将收到系统消息通知。此操作不可撤销。
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1.25 }}>
          <Button disabled={cancelling} onClick={() => setCancelTarget(null)} sx={{ flex: 1, minHeight: 44, color: MUJI.ink2 }}>
            再等等
          </Button>
          <Button disabled={cancelling} onClick={() => void handleCancel()} sx={{ flex: 1, minHeight: 44, color: MUJI.up }}>
            {cancelling ? '取消中…' : '确认取消'}
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
