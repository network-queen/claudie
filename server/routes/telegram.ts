import { Router, Request, Response } from 'express';
import { getTelegramConfig, saveTelegramConfig, sendTelegramMessage, setActiveProject } from '../services/telegramBot.js';

const router = Router();

router.get('/config', (_req: Request, res: Response) => {
  const cfg = getTelegramConfig();
  res.json({ data: { ...cfg, botToken: cfg.botToken ? '***' + cfg.botToken.slice(-4) : '' } });
});

router.put('/config', (req: Request, res: Response) => {
  const { botToken, chatId, enabled } = req.body || {};
  const current = getTelegramConfig();
  saveTelegramConfig({
    botToken: botToken === undefined ? current.botToken : (botToken.startsWith('***') ? current.botToken : botToken),
    chatId: chatId ?? current.chatId,
    enabled: enabled ?? current.enabled,
  });
  res.json({ data: { saved: true } });
});

router.post('/test', async (_req: Request, res: Response) => {
  try {
    await sendTelegramMessage('🐾 *Claudie connected!* Your Telegram integration is working.');
    res.json({ data: { sent: true } });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.put('/active-project', (req: Request, res: Response) => {
  setActiveProject(req.body?.path || '');
  res.json({ data: { ok: true } });
});

router.post('/notify', async (req: Request, res: Response) => {
  try {
    await sendTelegramMessage(req.body?.message || '🐾 *Claude needs your input*');
    res.json({ data: { sent: true } });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

export default router;
