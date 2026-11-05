/**
 * InvitationsDialog — 挑战邀请收件箱
 * 被邀请人查看邀请详情，同意（进入等候/开赛）或拒绝（挑战作废，反馈发起人）。
 */
import { useCallback, useEffect, useState } from 'react';
import { Box, Button, Dialog, Typography } from '@mui/material';
import { contestApi } from '../../services/contest-api';
import type { ContestInvitation } from '../../../shared/types';
import { ApiError } from '../../services/http';
import { MUJI } from '../../theme/muji-theme';

interface Props {
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
}

const DUR: Record<number, string> = { 1: '1 个月', 3: '3 个月', 6: '半年', 12: '1 年' };

export default function InvitationsDialog({ open, onClose, onChanged }: Props) {
  const [invitations, setInvitations] = useState<ContestInvitation[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { invitations: list } = await contestApi.invitations();
      setInvitations(list);
    } catch {
      setInvitations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      void load();
    }
  }, [open, load]);

  const respond = async (contestId: number, accept: boolean) => {
    setMsg(null);
    try {
      const r = await contestApi.respond(contestId, accept);
      setMsg(r.contestStatus === 'active' ? '🎉 全员确认完毕，比赛正式开始！' : `✓ ${accept ? '已同意，等待其他被邀请人确认' : '已拒绝，本次挑战作废'}`);
      await load();
      onChanged();
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : '操作失败');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: '6px' } }}>
      <Box sx={{ p: 3 }}>
        <Typography sx={{ fontSize: 16, fontWeight: 500, color: MUJI.ink, mb: 2 }}>📥 挑战邀请收件箱</Typography>
        {msg && <Typography sx={{ fontSize: 12.5, color: MUJI.ink2, mb: 1.5 }}>{msg}</Typography>}
        {loading ? (
          <Typography sx={{ fontSize: 13, color: MUJI.ink3 }}>加载中…</Typography>
        ) : invitations.length === 0 ? (
          <Typography sx={{ fontSize: 13, color: MUJI.ink3, py: 3, textAlign: 'center' }}>暂无待处理的挑战邀请</Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {invitations.map((inv) => (
              <Box key={inv.contestId} sx={{ border: `1px solid ${MUJI.line}`, borderRadius: '4px', p: 2 }}>
                <Typography sx={{ fontSize: 14.5, fontWeight: 500, color: MUJI.ink }}>
                  「{inv.name}」
                </Typography>
                <Typography sx={{ fontSize: 12.5, color: MUJI.ink2, mt: 0.75, lineHeight: 1.8 }}>
                  {inv.creator.nickname} 邀请你参赛 ｜ 每人初始资金 ¥{inv.initCash / 100 >= 10000 ? `${(inv.initCash / 1000000).toFixed(0)} 万` : (inv.initCash / 100).toLocaleString('zh-CN')} ｜ 周期 {DUR[inv.durationMonths] ?? inv.durationMonths + ' 个月'}
                  <br />
                  已确认 {inv.acceptedCount}/{inv.totalCount} 人
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, mt: 1.5 }}>
                  <Button size="small" variant="contained" onClick={() => void respond(inv.contestId, true)} sx={{ bgcolor: MUJI.red, '&:hover': { bgcolor: MUJI.red }, fontSize: 12.5, px: 2.25 }}>
                    同意参赛
                  </Button>
                  <Button size="small" variant="outlined" onClick={() => void respond(inv.contestId, false)} sx={{ fontSize: 12.5, px: 2.25, borderColor: MUJI.line, color: MUJI.ink2 }}>
                    拒绝
                  </Button>
                </Box>
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </Dialog>
  );
}
