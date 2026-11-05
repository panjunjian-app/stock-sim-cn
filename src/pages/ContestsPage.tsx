/**
 * ContestsPage — 炒炒乐大比拼
 * 发起挑战 + 邀请收件箱 + 进行中/历史比赛排行榜（每人进行中比赛 ≤3 → 图表 ≤3）。
 * 待确认比赛发起满 24 小时未全员确认，发起人可取消（推送系统消息给已确认用户）。
 * 30s 自动刷新排行（行情随轮询更新）。
 */
import { useCallback, useEffect, useState } from 'react';
import { Badge, Box, Button, Dialog, DialogActions, DialogContent, DialogContentText, Typography } from '@mui/material';
import { contestApi } from '../services/contest-api';
import type { ContestInfo } from '../../shared/types';
import { useAuthStore } from '../store/auth-store';
import { MUJI } from '../theme/muji-theme';
import InviteDialog from '../components/contest/InviteDialog';
import InvitationsDialog from '../components/contest/InvitationsDialog';
import ContestRankingChart from '../components/contest/ContestRankingChart';

const CANCEL_AFTER_MS = 24 * 60 * 60 * 1000;

export default function ContestsPage() {
  const [contests, setContests] = useState<ContestInfo[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<ContestInfo | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const user = useAuthStore((s) => s.user);

  const load = useCallback(async () => {
    try {
      const r = await contestApi.list();
      setContests(r.contests);
      setPendingInvitations(r.pendingInvitations);
      setError(null);
    } catch {
      setError('比赛数据加载失败');
    } finally {
      setLoading(false);
    }
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

  const handleCancel = async () => {
    if (!cancelTarget) {
      return;
    }
    setCancelling(true);
    try {
      await contestApi.cancel(cancelTarget.id);
      setNotice(`挑战「${cancelTarget.name}」已取消，已通知已确认参加的用户`);
      setCancelTarget(null);
      await load();
    } catch {
      setNotice('取消失败，请稍后重试');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <Box sx={{ flex: 1, overflowY: 'auto', minHeight: 0, px: 4, py: 2.5 }}>
      {/* 工具栏 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2.5 }}>
        <Typography sx={{ fontSize: 17, fontWeight: 500, color: MUJI.ink, letterSpacing: '0.08em', mr: 'auto' }}>
          炒炒乐大比拼
        </Typography>
        <Badge
          badgeContent={pendingInvitations > 9 ? '9+' : pendingInvitations}
          color="error"
          invisible={pendingInvitations === 0}
          sx={{ '& .MuiBadge-badge': { fontSize: 11, minWidth: 18, height: 18, right: -4 } }}
        >
          <Button variant="outlined" onClick={() => setInboxOpen(true)} sx={{ fontSize: 13, borderColor: pendingInvitations > 0 ? MUJI.red : MUJI.line, color: pendingInvitations > 0 ? MUJI.red : MUJI.ink2, borderRadius: '3px' }}>
            📥 挑战邀请{pendingInvitations > 0 ? `（${pendingInvitations}）` : ''}
          </Button>
        </Badge>
        <Button
          variant="contained"
          disableElevation
          onClick={() => setInviteOpen(true)}
          sx={{ bgcolor: MUJI.red, '&:hover': { bgcolor: MUJI.red }, fontSize: 13, px: 2.5, borderRadius: '3px' }}
        >
          ⚔️ 发起挑战
        </Button>
      </Box>

      {/* 比赛规则（防坐赢：游手好闲费） */}
      <Box sx={{ bgcolor: MUJI.card, border: `1px dashed ${MUJI.line}`, borderRadius: '4px', px: 2.25, py: 1.5, mb: 2.5 }}>
        <Typography sx={{ fontSize: 12.5, color: MUJI.ink2, lineHeight: 2, letterSpacing: '0.03em' }}>
          📜 比赛规则：进行中比赛每个交易日收市后检查各参赛比赛账户，<b style={{ fontWeight: 500 }}>开赛首个交易日豁免，自第二个交易日起，开赛以来从未有过买卖成交的账户将收取「游手好闲费」＝ 初始资金 × 1%</b>
          （费用记入该账户资金流水，现金不足按可用实扣）；一旦发生过买卖成交，永久免收。拒绝躺赢，动起来！
        </Typography>
      </Box>

      {loading && contests.length === 0 ? (
        <Typography sx={{ fontSize: 13, color: MUJI.ink3, py: 8, textAlign: 'center' }}>比赛数据加载中…</Typography>
      ) : error && contests.length === 0 ? (
        <Typography sx={{ fontSize: 13, color: MUJI.up, py: 8, textAlign: 'center' }}>{error}</Typography>
      ) : contests.length === 0 ? (
        <Box sx={{ bgcolor: MUJI.card, border: `1px dashed ${MUJI.line}`, borderRadius: '4px', p: 7, textAlign: 'center' }}>
          <Typography sx={{ fontSize: 15, color: MUJI.ink }}>还没有参加任何比赛</Typography>
          <Typography sx={{ fontSize: 12.5, color: MUJI.ink2, mt: 1, lineHeight: 2 }}>
            点右上角「发起挑战」向好友的注册邮箱发出炒股比拼邀请
            <br />
            每人初始资金 1万~1000万 · 周期 1/3/6/12 个月 · 含发起人最多 3 人 · 同时进行最多 3 场
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
                    <Box key={c.id} sx={{ bgcolor: MUJI.card, border: `1px solid ${MUJI.line}`, borderRadius: '4px', px: 2.25, py: 1.5, display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Typography sx={{ fontSize: 14, color: MUJI.ink, fontWeight: 500 }}>{c.name}</Typography>
                      <Typography sx={{ fontSize: 12, color: MUJI.ink3 }}>
                        已确认 {accepted}/{c.participants.length} 人 ｜ 每人初始 ¥{(c.initCash / 100).toLocaleString('zh-CN')}
                        {c.status === 'cancelled' ? ' ｜ ❌ 已作废（有人拒绝）' : ''}
                      </Typography>
                      <Typography sx={{ fontSize: 12, color: MUJI.ink3, ml: 'auto' }}>
                        {c.participants.map((p) => {
                          const icon = p.inviteStatus === 'accepted' ? '✓' : p.inviteStatus === 'declined' ? '✗' : '…';
                          // 有昵称显示「昵称（邮箱）」，未设昵称只显示邮箱
                          const label = p.nickname !== p.email ? `${p.nickname}（${p.email}）` : p.email;
                          return (
                            <Box component="span" key={p.userId} sx={{ mr: 1 }}>
                              {label}（{icon}）
                            </Box>
                          );
                        })}
                      </Typography>
                      {canCancel(c) && (
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => setCancelTarget(c)}
                          sx={{ fontSize: 12, color: MUJI.red, borderColor: MUJI.red, borderRadius: '3px', minWidth: 0, px: 1.5, flexShrink: 0, '&:hover': { borderColor: MUJI.red, bgcolor: 'rgba(192,86,74,0.04)' } }}
                        >
                          取消挑战
                        </Button>
                      )}
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
                  <Box key={c.id} sx={{ bgcolor: MUJI.card, border: `1px solid ${MUJI.line}`, borderRadius: '4px', px: 2.25, py: 1.5, display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Typography sx={{ fontSize: 14, color: MUJI.ink3, fontWeight: 500, textDecoration: 'line-through' }}>{c.name}</Typography>
                    <Typography sx={{ fontSize: 12, color: MUJI.ink3 }}>
                      ❌ 已取消（24 小时内未获全员确认） ｜ 每人初始 ¥{(c.initCash / 100).toLocaleString('zh-CN')}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          )}
        </Box>
      )}

      <InviteDialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onCreated={() => void load()}
      />
      <InvitationsDialog open={inboxOpen} onClose={() => setInboxOpen(false)} onChanged={() => void load()} />

      {/* 操作结果提示 */}
      <Dialog open={notice !== null} onClose={() => setNotice(null)}>
        <DialogContent>
          <DialogContentText sx={{ fontSize: 13.5 }}>{notice}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNotice(null)} sx={{ fontSize: 13, color: MUJI.red }}>
            知道了
          </Button>
        </DialogActions>
      </Dialog>

      {/* 取消挑战确认 */}
      <Dialog open={cancelTarget !== null} onClose={() => (cancelling ? undefined : setCancelTarget(null))}>
        <DialogContent>
          <DialogContentText sx={{ fontSize: 13.5, lineHeight: 1.9 }}>
            确定取消挑战「{cancelTarget?.name}」吗？
            <br />
            取消后比赛作废，已确认参加的用户将收到系统消息通知。此操作不可撤销。
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button disabled={cancelling} onClick={() => setCancelTarget(null)} sx={{ fontSize: 13, color: MUJI.ink2 }}>
            再等等
          </Button>
          <Button disabled={cancelling} onClick={() => void handleCancel()} sx={{ fontSize: 13, color: MUJI.red }}>
            {cancelling ? '取消中…' : '确认取消'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
