import { Router, Request, Response } from 'express';
import { getTelegramConfig, saveTelegramConfig, sendTelegramMessage, setActiveProject, setProjectWaiting, clearProjectWaiting } from '../services/telegramBot.js';

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
    let msg = req.body?.message || '🐾 *Claudie needs your input*';
    const context = req.body?.context;
    const projectPath = req.body?.projectPath;
    const projectName = req.body?.projectName;

    // Track this project as waiting
    if (projectPath && projectName) {
      setProjectWaiting(projectPath, projectName);
    }

    if (context) {
      msg += `\n\n📋 *Last output:*\n\`\`\`\n${context.slice(0, 800)}\n\`\`\``;
      if (projectName) {
        msg += `\n\n💬 /reply @${projectName} <message>`;
      }
    }
    await sendTelegramMessage(msg);
    res.json({ data: { sent: true } });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

// Clear waiting state when user interacts via IDE
router.post('/clear-waiting', (req: Request, res: Response) => {
  const { path } = req.body || {};
  if (path) clearProjectWaiting(path);
  res.json({ data: { ok: true } });
});

export default router;
