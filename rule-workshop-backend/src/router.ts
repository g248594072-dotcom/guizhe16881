import { Router } from 'itty-router';
import type { Env } from './types';
import { error, json } from './utils/response';
import { handleDiscordCallback, handleDiscordStart, handleAuthPoll } from './handlers/auth';
import {
  handleCreateContent,
  handleDeleteContent,
  handleGetContent,
  handleLikeContent,
  handleListContent,
  handleMe,
  handleMyContent,
  handleRecommended,
  handleStats,
  handleTrackDownload,
  handleUnlikeContent,
  handleUpdateContent,
} from './handlers/content';
import { handleSearch } from './handlers/search';
import {
  handleAdminBan,
  handleAdminDelete,
  handleAdminDetail,
  handleAdminEdit,
  handleAdminListAll,
  handleAdminPending,
  handleAdminReview,
  handleAdminUnban,
  handleGetAutoApprove,
  handleSeedBuiltins,
  handleSetAutoApprove,
} from './handlers/admin';

const router = Router();

router.get('/health', () => json({ ok: true }));

router.options('*', () => new Response(null, { status: 204 }));

router.get('/api/auth/discord', (req, env: Env) => handleDiscordStart(req, env));
router.get('/api/auth/callback', (req, env: Env) => handleDiscordCallback(req, env));
router.get('/api/auth/poll', (req, env: Env) => handleAuthPoll(req, env));

router.get('/api/content/list', (req, env: Env) => handleListContent(req, env));
router.get('/api/content/search', (req, env: Env) => handleSearch(req, env));
router.get('/api/content/get/:type/:id', (req, env: Env) => handleGetContent(req, env));

router.post('/api/content/create', (req, env: Env) => handleCreateContent(req, env));
router.put('/api/content/update/:id', (req, env: Env) => handleUpdateContent(req, env));
router.delete('/api/content/delete/:id', (req, env: Env) => handleDeleteContent(req, env));
router.post('/api/content/download/:id', (req, env: Env) => handleTrackDownload(req, env));

// Like / Unlike content
router.post('/api/content/like/:id', (req, env: Env) => handleLikeContent(req, env));
router.post('/api/content/unlike/:id', (req, env: Env) => handleUnlikeContent(req, env));

// Recommended content (popular/liked)
router.get('/api/content/recommended', (req, env: Env) => handleRecommended(req, env));

router.get('/api/stats', (req, env: Env) => handleStats(req, env));
router.get('/api/user/me', (req, env: Env) => handleMe(req, env));
router.get('/api/user/my-content', (req, env: Env) => handleMyContent(req, env));

router.get('/api/admin/pending', (req, env: Env) => handleAdminPending(req, env));
router.post('/api/admin/review/:id', (req, env: Env) => handleAdminReview(req, env));
router.get('/api/admin/list-all', (req, env: Env) => handleAdminListAll(req, env));
router.get('/api/admin/detail/:type/:id', (req, env: Env) => handleAdminDetail(req, env));
router.put('/api/admin/edit/:type/:id', (req, env: Env) => handleAdminEdit(req, env));
router.delete('/api/admin/delete/:type/:id', (req, env: Env) => handleAdminDelete(req, env));
router.post('/api/admin/ban/:userId', (req, env: Env) => handleAdminBan(req, env));
router.post('/api/admin/unban/:userId', (req, env: Env) => handleAdminUnban(req, env));
router.get('/api/admin/settings/auto-approve', (req, env: Env) => handleGetAutoApprove(req, env));
router.post('/api/admin/settings/auto-approve', (req, env: Env) => handleSetAutoApprove(req, env));
router.post('/api/admin/seed', (req, env: Env) => handleSeedBuiltins(req, env));

router.all('*', () => error(404, 'Not found'));

export default router;
