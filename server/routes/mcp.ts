import { Router, Request, Response } from 'express';
import { readMcpServers } from '../services/mcpConfigReader.js';

const router = Router();

router.get('/servers', (_req: Request, res: Response) => {
  try {
    const servers = readMcpServers();
    res.json({ data: servers, count: servers.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to read MCP servers' });
  }
});

export default router;
