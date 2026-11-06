/**
 * MeMobilePage — M9 个人中心（移动版 P1）：
 * 头像昵称卡 + 功能列表行（消息 badge / 账号设置 / 免责声明全文 / 版本号 / 退出登录），
 * 行高 ≥52px。复用 PC AccountSettingsDialog（MUI Dialog 原生可用）。
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Collapse, Snackbar, Typography } from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { MUJI } from '../../theme/muji-theme';
import { useAuthStore } from '../../store/auth-store';
import { authApi } from '../../services/auth-api';
import { messageApi } from '../../services/contest-api';
import AccountSettingsDialog from '../../components/AccountSettingsDialog';

const DISCLAIMER_FULL =
  '炒炒乐为纯模拟股票交易练习平台：所有账户资金、持仓、行情与成交数据均为虚构，与任何真实证券账户及真实财产无关，不构成任何投资建议。' +
  '平台提供的行情数据来自公开免费接口，可能存在延迟、缺失或错误，仅用于模拟练习参考。' +
  '模拟交易遵循简化的 A 股交易规则（T+1、±10% 涨跌幅、按手交易、模拟费用），与真实交易所规则可能存在差异。' +
  '投资有风险，入市需谨慎。用户应基于真实行情自行判断，勿将模拟结果作为实盘依据。';

const VERSION = 'v0.1.0';

export default function MeMobilePage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const clear = useAuthStore((s) => s.clear);
  const [unread, setUnread] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [disclaimerOpen, setDisclaimerOpen] = useState(false);
  const [snack, setSnack] = useState<string | null>(null);

  // 未读数：进入「我的」时刷新一次（P0 不轮询，P1 优化为 60s 一次）
  useEffect(() => {
    let cancelled = false;
    messageApi
      .list()
      .then((r) => {
        if (!cancelled) setUnread(r.unread);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogout = async (): Promise<void> => {
    try {
      await authApi.logout();
    } finally {
      clear();
      navigate('/login', { replace: true });
    }
  };

  const rowSx = {
    display: 'flex',
    alignItems: 'center',
    gap: 1,
    minHeight: 52,
    px: 2,
    bgcolor: MUJI.card,
    borderTop: `1px solid ${MUJI.lineSoft}`,
    cursor: 'pointer',
    '&:last-of-type': { borderBottom: `1px solid ${MUJI.lineSoft}` },
  } as const;

  return (
    <Box sx={{ flex: 1, px: 2, py: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* 头像昵称卡 */}
      <Box sx={{ bgcolor: MUJI.card, border: `1px solid ${MUJI.line}`, borderRadius: '6px', p: 2.5, display: 'flex', alignItems: 'center', gap: 2 }}>
        {user?.avatar ? (
          <Box component="img" src={user.avatar} alt="头像" sx={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', border: `1px solid ${MUJI.line}` }} />
        ) : (
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              bgcolor: MUJI.paper2,
              border: `1px solid ${MUJI.line}`,
              color: MUJI.ink2,
              fontSize: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {(user?.email ?? '?').slice(0, 1).toUpperCase()}
          </Box>
        )}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 15.5, fontWeight: 500, color: MUJI.ink }} noWrap>
            {user?.nickname || '未设置昵称'}
          </Typography>
          <Typography className="num" sx={{ fontSize: 12, color: MUJI.ink3 }} noWrap>
            {user?.email}
          </Typography>
        </Box>
        <Box onClick={() => setSettingsOpen(true)} sx={{ px: 1, minHeight: 44, display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: 12.5, color: MUJI.red }}>
          编辑资料
        </Box>
      </Box>

      {/* 功能列表 */}
      <Box sx={{ bgcolor: MUJI.card, border: `1px solid ${MUJI.line}`, borderRadius: '6px', overflow: 'hidden' }}>
        <Box onClick={() => navigate('/messages')} sx={rowSx}>
          <Typography sx={{ fontSize: 13.5 }}>🔔 消息通知</Typography>
          {unread > 0 && (
            <Box className="num" sx={{ fontSize: 10.5, minWidth: 18, height: 18, lineHeight: '18px', textAlign: 'center', borderRadius: '9px', bgcolor: MUJI.up, color: '#fff', px: 0.75 }}>
              {unread > 99 ? '99+' : unread}
            </Box>
          )}
          <ChevronRightIcon sx={{ ml: 'auto', fontSize: 18, color: MUJI.ink3 }} />
        </Box>

        <Box onClick={() => setSettingsOpen(true)} sx={rowSx}>
          <Typography sx={{ fontSize: 13.5 }}>⚙️ 账号设置（改昵称 / 头像 / 密码）</Typography>
          <ChevronRightIcon sx={{ ml: 'auto', fontSize: 18, color: MUJI.ink3 }} />
        </Box>

        <Box onClick={() => setDisclaimerOpen((v) => !v)} sx={rowSx}>
          <Typography sx={{ fontSize: 13.5 }}>📄 免责声明</Typography>
          {disclaimerOpen ? <ExpandLessIcon sx={{ ml: 'auto', fontSize: 18, color: MUJI.ink3 }} /> : <ExpandMoreIcon sx={{ ml: 'auto', fontSize: 18, color: MUJI.ink3 }} />}
        </Box>
        <Collapse in={disclaimerOpen}>
          <Typography sx={{ px: 2, py: 1.5, fontSize: 12, color: MUJI.ink2, lineHeight: 2, bgcolor: MUJI.card, borderTop: `1px solid ${MUJI.lineSoft}` }}>
            {DISCLAIMER_FULL}
          </Typography>
        </Collapse>

        <Box sx={{ ...rowSx, cursor: 'default' }}>
          <Typography sx={{ fontSize: 13.5 }}>ℹ️ 版本号</Typography>
          <Typography className="num" sx={{ ml: 'auto', fontSize: 12.5, color: MUJI.ink3 }}>
            {VERSION}
          </Typography>
        </Box>

        <Box onClick={() => void handleLogout()} sx={{ ...rowSx, justifyContent: 'center' }}>
          <Typography sx={{ fontSize: 13.5, color: MUJI.up }}>退出登录</Typography>
        </Box>
      </Box>

      <Typography sx={{ fontSize: 10.5, color: '#595959', textAlign: 'center', pb: 1 }}>
        模拟盘所有资金与行情数据均为虚构 · 投资有风险，入市需谨慎
      </Typography>

      {/* 账号设置（复用 PC AccountSettingsDialog） */}
      <AccountSettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      <Snackbar open={snack !== null} autoHideDuration={3000} onClose={() => setSnack(null)} anchorOrigin={{ vertical: 'top', horizontal: 'center' }} message={snack ?? ''} />
    </Box>
  );
}
