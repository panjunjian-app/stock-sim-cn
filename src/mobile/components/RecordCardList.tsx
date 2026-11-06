/**
 * RecordCardList — 成交 / 资金流水的时间线卡片列表（按日期分组头）。
 * 同文件导出 TradeRecordList 与 CashFlowRecordList 两个视图。
 */
import type { ReactNode } from 'react';
import { Box, Typography } from '@mui/material';
import dayjs from 'dayjs';
import type { CashFlow, Trade } from '../../../shared/types';
import { formatYuan, formatYuanSymbol } from '../../../shared/money';
import { sideText } from '../../../shared/validate';
import { pnlColor } from '../../components/PnlText';
import { MUJI } from '../../theme/muji-theme';

function GroupBlock({ date, children }: { date: string; children: ReactNode }) {
  return (
    <Box>
      <Typography className="num" sx={{ fontSize: 11, color: MUJI.ink3, letterSpacing: '0.1em', mb: 0.75, mt: 1.5 }}>
        {date}
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>{children}</Box>
    </Box>
  );
}

const fmtDay = (iso: string): string => dayjs(iso).format('YYYY-MM-DD');
const fmtTime = (iso: string): string => dayjs(iso).format('HH:mm:ss');

/** 按日期分组（保持传入顺序，服务端默认按时间倒序） */
function groupByDate<T>(items: T[], dateOf: (it: T) => string): Array<{ date: string; items: T[] }> {
  const groups: Array<{ date: string; items: T[] }> = [];
  for (const it of items) {
    const d = dateOf(it);
    const last = groups[groups.length - 1];
    if (last && last.date === d) {
      last.items.push(it);
    } else {
      groups.push({ date: d, items: [it] });
    }
  }
  return groups;
}

/** 成交记录（交割单）时间线 */
export function TradeRecordList({ trades }: { trades: Trade[] }) {
  if (trades.length === 0) {
    return (
      <Typography sx={{ py: 4, textAlign: 'center', fontSize: 12.5, color: MUJI.ink3 }}>暂无成交记录</Typography>
    );
  }
  return (
    <Box>
      {groupByDate(trades, (t) => fmtDay(t.tradedAt)).map((g) => (
        <GroupBlock key={g.date} date={g.date}>
          {g.items.map((t) => {
            const isBuy = t.side === 'buy';
            const fees = t.feeCommission + t.feeStamp + t.feeTransfer;
            return (
              <Box key={t.id} sx={{ bgcolor: MUJI.card, border: `1px solid ${MUJI.line}`, borderRadius: '6px', px: 2, py: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box
                    className="num"
                    sx={{ fontSize: 11.5, px: 1, py: '2px', borderRadius: '3px', bgcolor: isBuy ? MUJI.upBg : MUJI.downBg, color: isBuy ? MUJI.up : MUJI.down }}
                  >
                    {sideText(t.side)}
                  </Box>
                  <Typography sx={{ fontSize: 14, fontWeight: 500, color: MUJI.ink }}>{t.symbolName}</Typography>
                  <Typography className="num" sx={{ fontSize: 10.5, color: MUJI.ink3 }}>
                    {t.symbol.replace(/^(sh|sz)/, '')}
                  </Typography>
                  <Typography className="num" sx={{ fontSize: 13, fontWeight: 500, color: isBuy ? MUJI.up : MUJI.down, ml: 'auto' }}>
                    {formatYuanSymbol(t.amount)}
                  </Typography>
                </Box>
                <Box className="num" sx={{ display: 'flex', flexWrap: 'wrap', gap: '2px 14px', mt: 0.75, fontSize: 11, color: MUJI.ink3 }}>
                  <span>
                    {formatYuan(t.price)} × {t.quantity} 股
                  </span>
                  <span>费用 {formatYuan(fees)}</span>
                  <span>{isBuy ? '净付' : '净入'} {formatYuanSymbol(t.netAmount)}</span>
                  <span>{fmtTime(t.tradedAt)}（UTC）</span>
                </Box>
              </Box>
            );
          })}
        </GroupBlock>
      ))}
    </Box>
  );
}

const FLOW_TYPE_TEXT: Record<CashFlow['type'], string> = {
  deposit: '入金',
  buy: '买入',
  sell: '卖出',
  penalty: '游手好闲费',
};

/** 资金流水时间线 */
export function CashFlowRecordList({ cashFlows }: { cashFlows: CashFlow[] }) {
  if (cashFlows.length === 0) {
    return (
      <Typography sx={{ py: 4, textAlign: 'center', fontSize: 12.5, color: MUJI.ink3 }}>暂无资金流水</Typography>
    );
  }
  return (
    <Box>
      {groupByDate(cashFlows, (f) => fmtDay(f.createdAt)).map((g) => (
        <GroupBlock key={g.date} date={g.date}>
          {g.items.map((f) => {
            // 方向：入金/卖出为流入（+），买入/游手好闲费为流出（−）
            const inflow = f.type === 'deposit' || f.type === 'sell';
            const amountText = `${inflow ? '+' : '-'}${formatYuanSymbol(f.amount)}`;
            return (
              <Box key={f.id} sx={{ bgcolor: MUJI.card, border: `1px solid ${MUJI.line}`, borderRadius: '6px', px: 2, py: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography sx={{ fontSize: 13.5, fontWeight: 500, color: MUJI.ink }}>{FLOW_TYPE_TEXT[f.type]}</Typography>
                  {f.remark && (
                    <Typography sx={{ fontSize: 11, color: MUJI.ink3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                      {f.remark}
                    </Typography>
                  )}
                  <Typography className="num" sx={{ fontSize: 13.5, fontWeight: 500, color: pnlColor(inflow ? f.amount : -f.amount), ml: 'auto', whiteSpace: 'nowrap' }}>
                    {amountText}
                  </Typography>
                </Box>
                <Box className="num" sx={{ display: 'flex', gap: 2, mt: 0.75, fontSize: 11, color: MUJI.ink3 }}>
                  <span>余额 {formatYuanSymbol(f.balanceAfter)}</span>
                  <span>{fmtTime(f.createdAt)}（UTC）</span>
                </Box>
              </Box>
            );
          })}
        </GroupBlock>
      ))}
    </Box>
  );
}
