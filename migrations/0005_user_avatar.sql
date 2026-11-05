-- 0005_user_avatar.sql — 用户头像（客户端压缩后的 base64 JPEG，≤80KB）
ALTER TABLE users ADD COLUMN avatar TEXT NOT NULL DEFAULT '';
