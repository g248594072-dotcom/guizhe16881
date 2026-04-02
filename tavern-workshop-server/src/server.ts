import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { initDatabase, query } from './database';
import { WorkshopItem, WorkshopItemType, DiscordUser } from './types';

const app = express();
const PORT = process.env.PORT || 3000;

// Discord OAuth config
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || '';
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || '';
const ADMIN_DISCORD_ID = process.env.ADMIN_DISCORD_ID || '';

// In-memory auth storage (for a few users, this is fine. Scale: use Redis)
const authCodes = new Map<string, DiscordUser>();

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));

app.use(express.json());

// ===== Discord OAuth =====

// Step 1: Redirect to Discord OAuth
app.get('/auth/discord', (req, res) => {
  const redirectUri = `${req.protocol}://${req.get('host')}/callback`;
  const discordAuthUrl = `https://discord.com/oauth2/authorize?` +
    `client_id=${DISCORD_CLIENT_ID}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `response_type=code&` +
    `scope=identify`;
  
  res.redirect(discordAuthUrl);
});

// Step 2: Handle Discord callback
app.get('/callback', async (req, res) => {
  const code = req.query.code as string;
  
  if (!code) {
    return res.status(400).send('Missing code parameter');
  }

  try {
    // Exchange code for access token
    const tokenRes = await axios.post(
      'https://discord.com/api/oauth2/token',
      new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${req.protocol}://${req.get('host')}/callback`,
      }),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }
    );

    // Get user info
    const userRes = await axios.get('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenRes.data.access_token}` }
    });

    const user: DiscordUser = {
      id: userRes.data.id,
      username: userRes.data.username,
      avatar: userRes.data.avatar,
    };

    // Store auth code
    const authCode = `auth_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    authCodes.set(authCode, user);

    // Cleanup old codes after 5 minutes
    setTimeout(() => authCodes.delete(authCode), 5 * 60 * 1000);

    // Return HTML that sends message to parent/opener
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Login Success</title>
        <script>
          (function() {
            const authData = ${JSON.stringify({
              code: authCode,
              user: user
            })};
            
            // Try to communicate with opener
            if (window.opener) {
              window.opener.postMessage({
                type: 'workshop-auth-success',
                data: authData
              }, '*');
            }
            
            // Also set in localStorage for same-origin access
            try {
              localStorage.setItem('workshop_auth_pending', JSON.stringify(authData));
            } catch(e) {}
            
            document.body.innerHTML = '<h2>登录成功！请关闭此窗口。</h2>';
            
            // Auto close after 2 seconds
            setTimeout(() => window.close(), 2000);
          })();
        </script>
      </head>
      <body>
        <h2>登录成功，正在关闭窗口...</h2>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Discord OAuth error:', error);
    res.status(500).send('Authentication failed');
  }
});

// Step 3: Exchange auth code for user (called by frontend)
app.post('/auth/exchange', (req, res) => {
  const { code } = req.body;
  const user = authCodes.get(code);
  
  if (!user) {
    return res.status(401).json({ error: 'Invalid or expired auth code' });
  }
  
  authCodes.delete(code);
  res.json({ user, isAdmin: user.id === ADMIN_DISCORD_ID });
});

// ===== API: Upload =====

app.post('/api/upload', async (req, res) => {
  const { type, content, author, metadata } = req.body;
  
  if (!author || !author.id) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (!type || !content) {
    return res.status(400).json({ error: 'Missing type or content' });
  }

  const validTypes: WorkshopItemType[] = ['rule', 'character', 'scene', 'openingScene', 'preset'];
  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: 'Invalid type' });
  }

  const id = `${author.id}_${Date.now()}`;
  
  try {
    await query(
      `INSERT INTO workshop_items (id, type, content, author_id, author_name, author_avatar, status, created_at, downloads)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, 0)`,
      [id, type, JSON.stringify(content), author.id, author.username, author.avatar || null, Date.now()]
    );

    res.json({ 
      success: true, 
      id,
      message: '内容已提交，等待审核通过后会显示'
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// ===== API: List Items =====

app.get('/api/items', async (req, res) => {
  const { type, status = 'approved' } = req.query;
  
  try {
    let sql = 'SELECT * FROM workshop_items WHERE status = $1';
    const params: any[] = [status];
    
    if (type) {
      sql += ' AND type = $2';
      params.push(type);
    }
    
    sql += ' ORDER BY created_at DESC';
    
    const result = await query(sql, params);
    
    const items: WorkshopItem[] = result.rows.map(row => ({
      id: row.id,
      type: row.type,
      content: row.content,
      author_id: row.author_id,
      author_name: row.author_name,
      author_avatar: row.author_avatar,
      status: row.status,
      reject_reason: row.reject_reason,
      created_at: parseInt(row.created_at),
      downloads: row.downloads,
    }));
    
    res.json(items);
  } catch (error) {
    console.error('List error:', error);
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});

// ===== API: Admin - List Pending =====

app.get('/api/pending', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // In a real app, verify JWT. Here we check admin ID from a simple token
  const token = authHeader.slice(7);
  const userData = JSON.parse(Buffer.from(token, 'base64').toString());
  
  if (userData.id !== ADMIN_DISCORD_ID) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const result = await query(
      'SELECT * FROM workshop_items WHERE status = $1 ORDER BY created_at ASC',
      ['pending']
    );
    
    const items: WorkshopItem[] = result.rows.map(row => ({
      id: row.id,
      type: row.type,
      content: row.content,
      author_id: row.author_id,
      author_name: row.author_name,
      author_avatar: row.author_avatar,
      status: row.status,
      reject_reason: row.reject_reason,
      created_at: parseInt(row.created_at),
      downloads: row.downloads,
    }));
    
    res.json(items);
  } catch (error) {
    console.error('Pending list error:', error);
    res.status(500).json({ error: 'Failed to fetch pending items' });
  }
});

// ===== API: Admin - Review =====

app.post('/api/review', async (req, res) => {
  const { itemId, decision, reason } = req.body;
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.slice(7);
  const userData = JSON.parse(Buffer.from(token, 'base64').toString());
  
  if (userData.id !== ADMIN_DISCORD_ID) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  if (!itemId || !['approved', 'rejected'].includes(decision)) {
    return res.status(400).json({ error: 'Invalid request' });
  }

  try {
    await query(
      'UPDATE workshop_items SET status = $1, reject_reason = $2 WHERE id = $3',
      [decision, reason || null, itemId]
    );

    res.json({ success: true, decision });
  } catch (error) {
    console.error('Review error:', error);
    res.status(500).json({ error: 'Review failed' });
  }
});

// ===== API: Download =====

app.post('/api/download/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    // Increment download count
    await query(
      'UPDATE workshop_items SET downloads = downloads + 1 WHERE id = $1 AND status = $2',
      [id, 'approved']
    );
    
    // Get item
    const result = await query(
      'SELECT * FROM workshop_items WHERE id = $1 AND status = $2',
      [id, 'approved']
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found or not approved' });
    }
    
    const row = result.rows[0];
    res.json({
      id: row.id,
      type: row.type,
      content: row.content,
      author_name: row.author_name,
      author_avatar: row.author_avatar,
      created_at: parseInt(row.created_at),
      downloads: row.downloads,
    });
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Download failed' });
  }
});

// ===== API: Get My Uploads =====

app.get('/api/my-uploads', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.slice(7);
  const userData = JSON.parse(Buffer.from(token, 'base64').toString());

  try {
    const result = await query(
      'SELECT * FROM workshop_items WHERE author_id = $1 ORDER BY created_at DESC',
      [userData.id]
    );
    
    const items: WorkshopItem[] = result.rows.map(row => ({
      id: row.id,
      type: row.type,
      content: row.content,
      author_id: row.author_id,
      author_name: row.author_name,
      author_avatar: row.author_avatar,
      status: row.status,
      reject_reason: row.reject_reason,
      created_at: parseInt(row.created_at),
      downloads: row.downloads,
    }));
    
    res.json(items);
  } catch (error) {
    console.error('My uploads error:', error);
    res.status(500).json({ error: 'Failed to fetch uploads' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Start server
async function start() {
  await initDatabase();
  
  app.listen(PORT, () => {
    console.log(`Tavern Workshop Server running on port ${PORT}`);
    console.log(`Admin ID: ${ADMIN_DISCORD_ID || 'Not set'}`);
  });
}

start().catch(console.error);
