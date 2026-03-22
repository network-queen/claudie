import { Router, Request, Response } from 'express';
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const router = Router();

const SKILLS_DIR = join(homedir(), '.claude', 'commands');

interface SkillFile {
  name: string;
  filename: string;
  content: string;
  path: string;
}

function scanSkills(): SkillFile[] {
  if (!existsSync(SKILLS_DIR)) return [];
  try {
    return readdirSync(SKILLS_DIR)
      .filter((f) => f.endsWith('.md'))
      .map((filename) => {
        const filePath = join(SKILLS_DIR, filename);
        try {
          const content = readFileSync(filePath, 'utf-8');
          return {
            name: filename.replace(/\.md$/, ''),
            filename,
            content,
            path: filePath,
          };
        } catch {
          return null;
        }
      })
      .filter((s): s is SkillFile => s !== null);
  } catch {
    return [];
  }
}

// List all skills
router.get('/', (_req: Request, res: Response) => {
  try {
    const skills = scanSkills();
    res.json({ data: skills });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list skills' });
  }
});

// Create or update a skill
router.put('/:name', (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    const { content } = req.body || {};

    if (!content) {
      res.status(400).json({ error: 'content is required' });
      return;
    }

    if (!existsSync(SKILLS_DIR)) {
      mkdirSync(SKILLS_DIR, { recursive: true });
    }

    const filename = name.endsWith('.md') ? name : `${name}.md`;
    const filePath = join(SKILLS_DIR, filename);
    writeFileSync(filePath, content, 'utf-8');

    res.json({ data: { name, path: filePath, written: true } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to save skill';
    res.status(500).json({ error: message });
  }
});

// Delete a skill
router.delete('/:name', (_req: Request, res: Response) => {
  try {
    const { name } = _req.params;
    const filename = name.endsWith('.md') ? name : `${name}.md`;
    const filePath = join(SKILLS_DIR, filename);

    if (!existsSync(filePath)) {
      res.status(404).json({ error: `Skill "${name}" not found` });
      return;
    }

    unlinkSync(filePath);
    res.json({ data: { name, removed: true } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete skill';
    res.status(500).json({ error: message });
  }
});

// Install skill from URL
router.post('/install', async (req: Request, res: Response) => {
  try {
    const { url } = req.body || {};
    if (!url) { res.status(400).json({ error: 'url required' }); return; }

    // Fetch the content
    let fetchUrl = url;
    // Handle skills.sh URLs — resolve to GitHub raw URL
    if (url.includes('skills.sh')) {
      // skills.sh format: skills.sh/<owner>/<repo>/<skill-name>
      // GitHub source: raw.githubusercontent.com/<owner>/<repo>/main/skills/<skill-name>/SKILL.md
      const parts = url.replace(/\/$/, '').replace(/https?:\/\/skills\.sh\//, '').split('/');
      if (parts.length >= 3) {
        const [owner, repo, ...rest] = parts;
        const skill = rest.join('/');
        // Try with skills/ subdirectory first (anthropics/skills repo structure)
        fetchUrl = `https://raw.githubusercontent.com/${owner}/${repo}/main/skills/${skill}/SKILL.md`;
      }
    }
    // Handle GitHub blob URLs — convert to raw
    else if (url.includes('github.com') && !url.includes('raw.githubusercontent.com')) {
      fetchUrl = url.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
    }

    let content = '';
    const response = await fetch(fetchUrl);
    if (response.ok) {
      content = await response.text();
    }

    // Fallback for skills.sh: try without skills/ prefix
    if ((!content || content.length < 10 || content.trim().startsWith('<!')) && url.includes('skills.sh')) {
      const parts = url.replace(/\/$/, '').replace(/https?:\/\/skills\.sh\//, '').split('/');
      if (parts.length >= 3) {
        const [owner, repo, ...rest] = parts;
        const skill = rest.join('/');
        const alt = `https://raw.githubusercontent.com/${owner}/${repo}/main/${skill}/SKILL.md`;
        const altRes = await fetch(alt);
        if (altRes.ok) content = await altRes.text();
      }
    }

    // Fallback: try original URL
    if (!content || content.length < 10 || content.trim().startsWith('<!')) {
      const fallback = await fetch(url);
      if (fallback.ok) {
        const html = await fallback.text();
        // Try to extract from skills.sh install command to get GitHub URL
        const installMatch = html.match(/npx skills add (https:\/\/github\.com\/[^\s]+) --skill ([a-zA-Z0-9_-]+)/);
        if (installMatch) {
          const ghUrl = `https://raw.githubusercontent.com/${installMatch[1].replace('https://github.com/', '')}/main/${installMatch[2]}/SKILL.md`;
          const ghRes = await fetch(ghUrl);
          if (ghRes.ok) content = await ghRes.text();
        }
      }
    }

    if (!content || content.length < 10) throw new Error('Could not fetch skill content. Try a direct GitHub raw URL.');

    // Extract skill name from URL
    const urlParts = url.replace(/\/$/, '').split('/');
    let skillName = urlParts[urlParts.length - 1]
      .replace(/\.md$/, '')
      .replace(/SKILL/, '')
      .replace(/[^a-zA-Z0-9_-]/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase();
    if (!skillName) skillName = urlParts[urlParts.length - 2] || 'imported-skill';

    // Strip HTML if somehow we got it
    if (content.trim().startsWith('<!') || content.trim().startsWith('<html')) {
      throw new Error('Got HTML instead of markdown. Try: https://raw.githubusercontent.com/owner/repo/main/skill/SKILL.md');
    }

    if (!existsSync(SKILLS_DIR)) mkdirSync(SKILLS_DIR, { recursive: true });

    const filePath = join(SKILLS_DIR, `${skillName}.md`);
    writeFileSync(filePath, content, 'utf-8');

    res.json({ data: { name: skillName, path: filePath } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Install failed';
    res.status(500).json({ error: message });
  }
});

export default router;
