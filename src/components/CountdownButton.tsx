import { useEffect, useRef, useState } from 'react';
import { Button } from '@mui/material';

export interface CountdownButtonProps {
  /** 触发动作；抛错时不进入倒计时 */
  onSend: () => Promise<void>;
  /** 倒计时秒数（默认 60s） */
  seconds?: number;
  disabled?: boolean;
  label?: string;
  size?: 'small' | 'medium' | 'large';
  fullWidth?: boolean;
}

/** CountdownButton — 验证码发送按钮，成功后 60s 倒计时冷却 */
export default function CountdownButton({
  onSend,
  seconds = 60,
  disabled,
  label = '发送验证码',
  size = 'medium',
  fullWidth,
}: CountdownButtonProps) {
  const [count, setCount] = useState(0);
  const [sending, setSending] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
      }
    };
  }, []);

  const handle = async () => {
    if (sending || count > 0) {
      return;
    }
    setSending(true);
    try {
      await onSend();
      setCount(seconds);
      timerRef.current = window.setInterval(() => {
        setCount((c) => {
          if (c <= 1 && timerRef.current !== null) {
            window.clearInterval(timerRef.current);
            timerRef.current = null;
            return 0;
          }
          return c - 1;
        });
      }, 1000);
    } finally {
      setSending(false);
    }
  };

  return (
    <Button
      variant="outlined"
      size={size}
      fullWidth={fullWidth}
      disabled={disabled || sending || count > 0}
      onClick={() => void handle()}
    >
      {count > 0 ? `${count}s 后重发` : sending ? '发送中…' : label}
    </Button>
  );
}
