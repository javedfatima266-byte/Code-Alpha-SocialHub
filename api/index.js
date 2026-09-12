// Mini Social Media Platform - Express.js API & Serverless Handler
// Compatible with Vercel Serverless Functions and standalone Node.js server

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query, isDbInMemory } from '../lib/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// SESSION_SECRET is loaded from environment variables in production.
// During development, if neither SESSION_SECRET nor JWT_SECRET is provided,
// generate a secure transient in-memory secret so development works out of the box without hardcoding any secrets.
const devTransientSecret = crypto.randomBytes(32).toString('hex');
const JWT_SECRET = process.env.SESSION_SECRET || process.env.JWT_SECRET || devTransientSecret;

if (!process.env.SESSION_SECRET && !process.env.JWT_SECRET) {
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
    console.warn('⚠️ WARNING: Neither SESSION_SECRET nor JWT_SECRET is configured in production environment. Tokens may invalidate across serverless cold starts. Set SESSION_SECRET in Vercel Project Settings > Environment Variables.');
  } else {
    console.log('ℹ️  No SESSION_SECRET environment variable provided. Using dynamic runtime secret for development.');
  }
}

const app = express();

// Middlewares
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json({ limit: '12mb' }));
app.use(express.urlencoded({ limit: '12mb', extended: true }));
app.use(cookieParser());

// Vercel Serverless Function & Reverse Proxy URL Normalization Middleware
// Ensures req.url accurately reflects the requested API route regardless of Vercel edge rewrites
app.use((req, res, next) => {
  // Check Vercel edge and reverse proxy matched path headers
  const matchedHeader = req.headers['x-forwarded-uri'] ||
                        req.headers['x-matched-path'] ||
                        req.headers['x-vercel-matched-path'] ||
                        req.headers['x-original-uri'];

  // If Vercel rewrote the destination to /api or /api/, restore full original path from headers
  if (matchedHeader && matchedHeader.startsWith('/api') && (req.url === '/' || req.url === '/api' || req.url === '/api/' || req.url.startsWith('/api?'))) {
    const qIndex = req.url.indexOf('?');
    const queryString = (qIndex !== -1 && !matchedHeader.includes('?')) ? req.url.slice(qIndex) : '';
    req.url = matchedHeader + queryString;
  } else {
    // If request arrived without /api prefix (e.g. from reverse proxy or internal rewrite)
    const [pathname, search] = req.url.split('?');
    const qs = search ? `?${search}` : '';

    if (!pathname.startsWith('/api')) {
      if (
        pathname.startsWith('/auth') ||
        pathname.startsWith('/posts') ||
        pathname.startsWith('/comments') ||
        pathname.startsWith('/users') ||
        pathname.startsWith('/upload') ||
        pathname.startsWith('/health') ||
        pathname.startsWith('/status') ||
        pathname.startsWith('/explore')
      ) {
        req.url = `/api${pathname.startsWith('/') ? '' : '/'}${pathname}${qs}`;
      }
    }
  }

  next();
});

// Base /api status route
app.get(['/api', '/api/'], (req, res) => {
  res.json({
    success: true,
    name: 'SocialHub API',
    status: 'operational',
    endpoints: {
      auth: '/api/auth',
      posts: '/api/posts',
      users: '/api/users',
      status: '/api/status',
      health: '/api/health'
    }
  });
});

// Serve static assets from public/ folder in standalone/dev mode
app.use(express.static(path.join(process.cwd(), 'public')));

// Helper: Authentication Middleware
export async function requireAuth(req, res, next) {
  let token = null;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Please log in.'
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const userRes = await query(
      'SELECT id, username, email, name, bio, profile_image FROM users WHERE id = $1',
      [decoded.id]
    );

    if (userRes.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'User account not found or session expired.'
      });
    }

    req.user = userRes.rows[0];
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired authentication token.'
    });
  }
}

// Optional Auth Middleware (attaches user if token present, does not reject if absent)
export async function optionalAuth(req, res, next) {
  let token = null;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const userRes = await query(
        'SELECT id, username, email, name, bio, profile_image FROM users WHERE id = $1',
        [decoded.id]
      );
      if (userRes.rows.length > 0) {
        req.user = userRes.rows[0];
      }
    } catch (e) {
      // Ignore invalid optional token
    }
  }
  next();
}

// Helper: Enrich post rows with counts, like state, and ownership
async function enrichPosts(postRows, currentUserId) {
  if (!postRows || postRows.length === 0) return [];
  const postIds = postRows.map(r => r.id);
  const likeCounts = {};
  const userLikes = new Set();
  const commentCounts = {};

  try {
    const placeholders = postIds.map((_, i) => `$${i + 1}`).join(',');
    const likesRes = await query(`SELECT post_id, user_id FROM likes WHERE post_id IN (${placeholders})`, postIds);
    likesRes.rows.forEach(r => {
      likeCounts[r.post_id] = (likeCounts[r.post_id] || 0) + 1;
      if (currentUserId && Number(r.user_id) === Number(currentUserId)) {
        userLikes.add(r.post_id);
      }
    });
  } catch (err) {
    console.error('Error enriching post likes:', err);
  }

  try {
    const placeholders = postIds.map((_, i) => `$${i + 1}`).join(',');
    const commentsRes = await query(`SELECT post_id, id FROM comments WHERE post_id IN (${placeholders})`, postIds);
    commentsRes.rows.forEach(r => {
      commentCounts[r.post_id] = (commentCounts[r.post_id] || 0) + 1;
    });
  } catch (err) {
    console.error('Error enriching post comments:', err);
  }

  return postRows.map(row => ({
    id: row.id,
    content: row.content,
    image_url: row.image_url,
    created_at: row.created_at,
    updated_at: row.updated_at,
    like_count: likeCounts[row.id] || 0,
    comment_count: commentCounts[row.id] || 0,
    is_liked: userLikes.has(row.id),
    is_owner: currentUserId ? (Number(row.user_id) === Number(currentUserId)) : false,
    author: {
      id: row.user_id,
      username: row.username,
      name: row.name,
      profile_image: row.profile_image
    }
  }));
}

// Helper: Enrich user rows with post and follow stats
async function enrichUsers(userRows, currentUserId) {
  if (!userRows || userRows.length === 0) return [];
  const postsRes = await query('SELECT user_id FROM posts');
  const followsRes = await query('SELECT follower_id, following_id FROM follows');

  const postsCounts = {};
  postsRes.rows.forEach(r => {
    postsCounts[r.user_id] = (postsCounts[r.user_id] || 0) + 1;
  });

  const followersCounts = {};
  const followingCounts = {};
  const userFollowing = new Set();
  followsRes.rows.forEach(r => {
    followersCounts[r.following_id] = (followersCounts[r.following_id] || 0) + 1;
    followingCounts[r.follower_id] = (followingCounts[r.follower_id] || 0) + 1;
    if (currentUserId && Number(r.follower_id) === Number(currentUserId)) {
      userFollowing.add(r.following_id);
    }
  });

  return userRows.map(row => ({
    id: row.id,
    username: row.username,
    email: row.email,
    name: row.name,
    bio: row.bio,
    profile_image: row.profile_image,
    created_at: row.created_at,
    posts_count: postsCounts[row.id] || 0,
    followers_count: followersCounts[row.id] || 0,
    following_count: followingCounts[row.id] || 0,
    is_me: currentUserId ? (Number(row.id) === Number(currentUserId)) : false,
    is_following: userFollowing.has(row.id)
  }));
}

// ==========================================
// 1. AUTHENTICATION ENDPOINTS
// ==========================================

// POST /api/auth/register
app.post(['/api/auth/register', '/auth/register'], async (req, res) => {
  try {
    const { username, email, password, name } = req.body;
    const confirmPassword = req.body.confirmPassword || password;

    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'All fields (username, email, password) are required.'
      });
    }

    const trimmedUsername = username.trim().toLowerCase();
    const trimmedEmail = email.trim().toLowerCase();

    if (trimmedUsername.length < 3 || !/^[a-zA-Z0-9_]+$/.test(trimmedUsername)) {
      return res.status(400).json({
        success: false,
        message: 'Username must be at least 3 characters long and contain only letters, numbers, and underscores.'
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address.'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters.'
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match.'
      });
    }

    // Check existing username or email
    const existingUser = await query(
      'SELECT id, username, email FROM users WHERE username = $1 OR email = $2',
      [trimmedUsername, trimmedEmail]
    );

    if (existingUser.rows.length > 0) {
      const match = existingUser.rows[0];
      if (match.username === trimmedUsername) {
        return res.status(400).json({
          success: false,
          message: 'Username is already taken.'
        });
      }
      return res.status(400).json({
        success: false,
        message: 'Email address is already in use.'
      });
    }

    // Hash password with bcrypt
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const displayName = (name && name.trim()) ? name.trim() : trimmedUsername;
    const bioText = req.body.bio ? req.body.bio.trim() : '';
    const profileImg = req.body.profile_image || `https://api.dicebear.com/7.x/bottts/svg?seed=${trimmedUsername}`;

    const insertResult = await query(
      `INSERT INTO users (username, email, password_hash, name, bio, profile_image)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, username, email, name, bio, profile_image, created_at`,
      [trimmedUsername, trimmedEmail, passwordHash, displayName, bioText, profileImg]
    );

    const newUser = insertResult.rows[0];

    const token = jwt.sign(
      { id: newUser.id, username: newUser.username, email: newUser.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    return res.status(201).json({
      success: true,
      message: 'Account registered successfully.',
      data: {
        user: newUser,
        token
      }
    });
  } catch (err) {
    console.error('Registration error:', err);
    return res.status(500).json({
      success: false,
      message: 'An unexpected server error occurred during registration.'
    });
  }
});

// POST /api/auth/login
app.post(['/api/auth/login', '/auth/login'], async (req, res) => {
  try {
    const rawIdentifier = req.body.emailOrUsername || req.body.email || req.body.username || req.body.identifier;
    const { password } = req.body;

    if (!rawIdentifier || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both username/email and password.'
      });
    }

    const identifier = rawIdentifier.trim().toLowerCase();

    const userRes = await query(
      'SELECT * FROM users WHERE LOWER(username) = $1 OR LOWER(email) = $1',
      [identifier]
    );

    if (userRes.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. User not found.'
      });
    }

    const user = userRes.rows[0];
    const passwordValid = await bcrypt.compare(password, user.password_hash);

    if (!passwordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. Password incorrect.'
      });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    const safeUser = {
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      bio: user.bio,
      profile_image: user.profile_image,
      created_at: user.created_at
    };

    return res.json({
      success: true,
      message: 'Logged in successfully.',
      data: {
        user: safeUser,
        token
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error during login.'
    });
  }
});

// POST /api/auth/logout
app.post(['/api/auth/logout', '/auth/logout'], (req, res) => {
  res.clearCookie('token');
  return res.json({
    success: true,
    message: 'Logged out successfully.'
  });
});

// GET /api/auth/me
app.get(['/api/auth/me', '/auth/me'], requireAuth, async (req, res) => {
  try {
    const userRes = await query(
      'SELECT id, username, email, name, bio, profile_image, created_at FROM users WHERE id = $1',
      [req.user.id]
    );

    if (userRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found.'
      });
    }

    const enriched = await enrichUsers(userRes.rows, req.user.id);

    return res.json({
      success: true,
      data: {
        user: enriched[0]
      }
    });
  } catch (err) {
    console.error('Auth check error:', err);
    return res.status(500).json({
      success: false,
      message: 'Error fetching current user profile.'
    });
  }
});

// ==========================================
// 2. POSTS ENDPOINTS
// ==========================================

// GET /api/posts and GET /api/posts/following
// Query params: feed (following | all), username, user_id
app.get(['/api/posts', '/api/posts/following'], optionalAuth, async (req, res) => {
  try {
    const { feed, username, user_id } = req.query;
    const currentUserId = req.user ? req.user.id : null;
    const isFollowingFeed = feed === 'following' || req.path.endsWith('/following');

    let sqlWhere = '';
    const params = [];

    if (isFollowingFeed) {
      if (!currentUserId) {
        return res.status(401).json({
          success: false,
          message: 'Please log in to view posts from users you follow.',
          posts: [],
          data: []
        });
      }
      params.push(currentUserId);
      sqlWhere = `WHERE p.user_id = $1 OR p.user_id IN (SELECT following_id FROM follows WHERE follower_id = $1)`;
    } else if (username) {
      params.push(username.toLowerCase());
      sqlWhere = `WHERE LOWER(u.username) = $${params.length}`;
    } else if (user_id) {
      params.push(parseInt(user_id));
      sqlWhere = `WHERE p.user_id = $${params.length}`;
    }

    const postsSql = `
      SELECT 
        p.id,
        p.user_id,
        p.content,
        p.image_url,
        p.created_at,
        p.updated_at,
        u.username,
        u.name,
        u.profile_image
      FROM posts p
      JOIN users u ON p.user_id = u.id
      ${sqlWhere}
      ORDER BY p.created_at DESC
    `;

    const result = await query(postsSql, params);
    const posts = await enrichPosts(result.rows, currentUserId);

    return res.json({
      success: true,
      posts: posts,
      data: posts
    });
  } catch (err) {
    console.error('Fetch posts error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch posts.',
      posts: [],
      data: [],
      error: err.message || 'Database query error'
    });
  }
});

// Health check endpoint for platform monitoring
app.get('/api/health', (req, res) => {
  res.json({ success: true, status: 'ok', timestamp: new Date().toISOString() });
});

// POST /api/posts
app.post('/api/posts', requireAuth, async (req, res) => {
  try {
    const { content, image_url } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Post content cannot be empty.'
      });
    }

    const trimmedContent = content.trim();
    const cleanImageUrl = image_url ? image_url.trim() : '';

    const insertRes = await query(
      `INSERT INTO posts (user_id, content, image_url)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [req.user.id, trimmedContent, cleanImageUrl]
    );

    const post = insertRes.rows[0];

    const fullPost = {
      id: post.id,
      content: post.content,
      image_url: post.image_url,
      created_at: post.created_at,
      updated_at: post.updated_at,
      like_count: 0,
      comment_count: 0,
      is_liked: false,
      is_owner: true,
      author: {
        id: req.user.id,
        username: req.user.username,
        name: req.user.name,
        profile_image: req.user.profile_image
      }
    };

    return res.status(201).json({
      success: true,
      message: 'Post created successfully.',
      data: {
        ...fullPost,
        post: fullPost
      },
      post: fullPost
    });
  } catch (err) {
    console.error('Create post error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to create post.'
    });
  }
});

// POST /api/upload
// Secure image upload handler supporting file buffers, local disk in dev, and Vercel/cloud storage compatibility
app.post('/api/upload', requireAuth, async (req, res) => {
  try {
    const { data, filename } = req.body;
    if (!data) {
      return res.status(400).json({ success: false, message: 'No image data provided.' });
    }

    // Direct image URL fallback
    if (typeof data === 'string' && (data.startsWith('http://') || data.startsWith('https://'))) {
      return res.json({ success: true, url: data });
    }

    const matches = data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ success: false, message: 'Invalid image format. Expected valid Base64 Data URI.' });
    }

    const mimeType = matches[1];
    if (!mimeType.startsWith('image/')) {
      return res.status(400).json({ success: false, message: 'Uploaded file must be an image.' });
    }

    const ext = mimeType.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
    const cleanExt = ext.replace(/[^a-zA-Z0-9]/g, '');
    const buffer = Buffer.from(matches[2], 'base64');

    if (buffer.length > 10 * 1024 * 1024) {
      return res.status(400).json({ success: false, message: 'Image size exceeds maximum limit of 10MB.' });
    }

    const uniqueId = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
    const safeFilename = `upload_${uniqueId}.${cleanExt}`;

    // If Vercel Blob token is configured in production, stream directly to Vercel Blob Store
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      try {
        const blobRes = await fetch(`https://blob.vercel-storage.com/${safeFilename}`, {
          method: 'PUT',
          headers: {
            'authorization': `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`,
            'x-add-random-suffix': 'true',
            'content-type': mimeType
          },
          body: buffer
        });
        if (blobRes.ok) {
          const blobData = await blobRes.json();
          return res.json({
            success: true,
            url: blobData.url,
            filename: safeFilename
          });
        }
      } catch (blobErr) {
        console.warn('Vercel Blob upload attempt encountered error, falling back:', blobErr.message);
      }
    }

    try {
      const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      const filePath = path.join(uploadsDir, safeFilename);
      fs.writeFileSync(filePath, buffer);
      return res.json({
        success: true,
        url: `/uploads/${safeFilename}`,
        filename: safeFilename
      });
    } catch (fsErr) {
      // In serverless / read-only environment like Vercel Lambda, return clean inline data URI
      console.warn('Local filesystem write unavailable, serving data URI safely:', fsErr.message);
      return res.json({
        success: true,
        url: data,
        filename: safeFilename
      });
    }
  } catch (err) {
    console.error('Image upload error:', err);
    return res.status(500).json({ success: false, message: 'Failed to process image upload.' });
  }
});

// GET /api/posts/:id
app.get('/api/posts/:id', optionalAuth, async (req, res, next) => {
  try {
    const postId = parseInt(req.params.id);
    if (isNaN(postId)) {
      return next();
    }
    const currentUserId = req.user ? req.user.id : null;

    const postRes = await query(
      `SELECT 
        p.id,
        p.user_id,
        p.content,
        p.image_url,
        p.created_at,
        p.updated_at,
        u.username,
        u.name,
        u.profile_image
      FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE p.id = $1`,
      [postId]
    );

    if (postRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Post not found.'
      });
    }

    const enriched = await enrichPosts(postRes.rows, currentUserId);

    return res.json({
      success: true,
      data: enriched[0]
    });
  } catch (err) {
    console.error('Get post error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch post.'
    });
  }
});

// PUT /api/posts/:id
app.put('/api/posts/:id', requireAuth, async (req, res) => {
  try {
    const postId = parseInt(req.params.id);
    const { content, image_url } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Content cannot be empty.'
      });
    }

    const checkRes = await query('SELECT * FROM posts WHERE id = $1', [postId]);
    if (checkRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Post not found.'
      });
    }

    if (checkRes.rows[0].user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to edit this post.'
      });
    }

    const cleanImg = image_url !== undefined ? image_url.trim() : checkRes.rows[0].image_url;

    const updateRes = await query(
      `UPDATE posts 
       SET content = $1, image_url = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [content.trim(), cleanImg, postId]
    );

    return res.json({
      success: true,
      message: 'Post updated successfully.',
      data: updateRes.rows[0]
    });
  } catch (err) {
    console.error('Update post error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to update post.'
    });
  }
});

// DELETE /api/posts/:id
app.delete('/api/posts/:id', requireAuth, async (req, res) => {
  try {
    const postId = parseInt(req.params.id);

    const postCheck = await query('SELECT * FROM posts WHERE id = $1', [postId]);
    if (postCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Post not found.'
      });
    }

    if (postCheck.rows[0].user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to delete this post.'
      });
    }

    await query('DELETE FROM posts WHERE id = $1', [postId]);

    return res.json({
      success: true,
      message: 'Post deleted successfully.'
    });
  } catch (err) {
    console.error('Delete post error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete post.'
    });
  }
});

// ==========================================
// 3. LIKES ENDPOINTS
// ==========================================

// POST /api/posts/:id/like
app.post('/api/posts/:id/like', requireAuth, async (req, res) => {
  try {
    const postId = parseInt(req.params.id);

    const postCheck = await query('SELECT id FROM posts WHERE id = $1', [postId]);
    if (postCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Post not found.'
      });
    }

    await query(
      `INSERT INTO likes (post_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (post_id, user_id) DO NOTHING`,
      [postId, req.user.id]
    );

    const countRes = await query(
      'SELECT COUNT(*)::int AS count FROM likes WHERE post_id = $1',
      [postId]
    );

    return res.json({
      success: true,
      message: 'Post liked successfully.',
      data: {
        liked: true,
        like_count: countRes.rows[0].count
      }
    });
  } catch (err) {
    console.error('Like error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to like post.'
    });
  }
});

// DELETE /api/posts/:id/like
app.delete('/api/posts/:id/like', requireAuth, async (req, res) => {
  try {
    const postId = parseInt(req.params.id);

    await query(
      'DELETE FROM likes WHERE post_id = $1 AND user_id = $2',
      [postId, req.user.id]
    );

    const countRes = await query(
      'SELECT COUNT(*)::int AS count FROM likes WHERE post_id = $1',
      [postId]
    );

    return res.json({
      success: true,
      message: 'Post unliked successfully.',
      data: {
        liked: false,
        like_count: countRes.rows[0].count
      }
    });
  } catch (err) {
    console.error('Unlike error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to unlike post.'
    });
  }
});

// ==========================================
// 4. COMMENTS ENDPOINTS
// ==========================================

// GET /api/posts/:id/comments
app.get('/api/posts/:id/comments', optionalAuth, async (req, res) => {
  try {
    const postId = parseInt(req.params.id);
    const currentUserId = req.user ? req.user.id : null;

    const result = await query(
      `SELECT 
        c.id,
        c.post_id,
        c.user_id,
        c.content,
        c.created_at,
        c.updated_at,
        u.username,
        u.name,
        u.profile_image
       FROM comments c
       JOIN users u ON c.user_id = u.id
       WHERE c.post_id = $1
       ORDER BY c.created_at ASC`,
      [postId]
    );

    const comments = result.rows.map(row => ({
      id: row.id,
      post_id: row.post_id,
      content: row.content,
      created_at: row.created_at,
      updated_at: row.updated_at,
      is_owner: currentUserId ? (row.user_id === currentUserId) : false,
      author: {
        id: row.user_id,
        username: row.username,
        name: row.name,
        profile_image: row.profile_image
      }
    }));

    return res.json({
      success: true,
      data: comments
    });
  } catch (err) {
    console.error('Fetch comments error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch comments.'
    });
  }
});

// POST /api/posts/:id/comments
app.post('/api/posts/:id/comments', requireAuth, async (req, res) => {
  try {
    const postId = parseInt(req.params.id);
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Comment content cannot be empty.'
      });
    }

    const postCheck = await query('SELECT id FROM posts WHERE id = $1', [postId]);
    if (postCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Post not found.'
      });
    }

    const insertRes = await query(
      `INSERT INTO comments (post_id, user_id, content)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [postId, req.user.id, content.trim()]
    );

    const comment = insertRes.rows[0];

    const countRes = await query(
      'SELECT COUNT(*)::int AS count FROM comments WHERE post_id = $1',
      [postId]
    );

    return res.status(201).json({
      success: true,
      message: 'Comment added successfully.',
      data: {
        comment: {
          id: comment.id,
          post_id: comment.post_id,
          content: comment.content,
          created_at: comment.created_at,
          updated_at: comment.updated_at,
          is_owner: true,
          author: {
            id: req.user.id,
            username: req.user.username,
            name: req.user.name,
            profile_image: req.user.profile_image
          }
        },
        comment_count: countRes.rows[0].count
      }
    });
  } catch (err) {
    console.error('Add comment error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to add comment.'
    });
  }
});

// DELETE /api/comments/:id
app.delete('/api/comments/:id', requireAuth, async (req, res) => {
  try {
    const commentId = parseInt(req.params.id);

    const commentCheck = await query('SELECT * FROM comments WHERE id = $1', [commentId]);
    if (commentCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found.'
      });
    }

    const comment = commentCheck.rows[0];
    if (comment.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to delete this comment.'
      });
    }

    await query('DELETE FROM comments WHERE id = $1', [commentId]);

    const countRes = await query(
      'SELECT COUNT(*)::int AS count FROM comments WHERE post_id = $1',
      [comment.post_id]
    );

    return res.json({
      success: true,
      message: 'Comment deleted successfully.',
      data: {
        post_id: comment.post_id,
        comment_count: countRes.rows[0].count
      }
    });
  } catch (err) {
    console.error('Delete comment error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete comment.'
    });
  }
});

// ==========================================
// 5. FOLLOW / UNFOLLOW ENDPOINTS
// ==========================================

// POST /api/users/:id/follow
app.post('/api/users/:id/follow', requireAuth, async (req, res) => {
  try {
    const targetUserId = parseInt(req.params.id);

    if (req.user.id === targetUserId) {
      return res.status(400).json({
        success: false,
        message: 'You cannot follow yourself.'
      });
    }

    const userCheck = await query('SELECT id FROM users WHERE id = $1', [targetUserId]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User to follow not found.'
      });
    }

    await query(
      `INSERT INTO follows (follower_id, following_id)
       VALUES ($1, $2)
       ON CONFLICT (follower_id, following_id) DO NOTHING`,
      [req.user.id, targetUserId]
    );

    const followerCountRes = await query(
      'SELECT COUNT(*)::int AS count FROM follows WHERE following_id = $1',
      [targetUserId]
    );

    return res.json({
      success: true,
      message: 'User followed successfully.',
      data: {
        following: true,
        followers_count: followerCountRes.rows[0].count
      }
    });
  } catch (err) {
    console.error('Follow error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to follow user.'
    });
  }
});

// DELETE /api/users/:id/follow
app.delete('/api/users/:id/follow', requireAuth, async (req, res) => {
  try {
    const targetUserId = parseInt(req.params.id);

    await query(
      'DELETE FROM follows WHERE follower_id = $1 AND following_id = $2',
      [req.user.id, targetUserId]
    );

    const followerCountRes = await query(
      'SELECT COUNT(*)::int AS count FROM follows WHERE following_id = $1',
      [targetUserId]
    );

    return res.json({
      success: true,
      message: 'User unfollowed successfully.',
      data: {
        following: false,
        followers_count: followerCountRes.rows[0].count
      }
    });
  } catch (err) {
    console.error('Unfollow error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to unfollow user.'
    });
  }
});

// ==========================================
// 6. USERS & EXPLORE ENDPOINTS
// ==========================================

// GET /api/users
app.get('/api/users', optionalAuth, async (req, res) => {
  try {
    const currentUserId = req.user ? req.user.id : null;

    const usersRes = await query(
      `SELECT id, username, email, name, bio, profile_image, created_at
       FROM users
       ORDER BY created_at DESC
       LIMIT 50`
    );

    const users = await enrichUsers(usersRes.rows, currentUserId);

    return res.json({
      success: true,
      data: users
    });
  } catch (err) {
    console.error('List users error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch users.'
    });
  }
});

// GET /api/users/search?q=
app.get('/api/users/search', optionalAuth, async (req, res) => {
  try {
    const search = req.query.q ? req.query.q.trim() : '';
    const currentUserId = req.user ? req.user.id : null;

    if (!search) {
      return res.json({
        success: true,
        data: []
      });
    }

    const searchSql = `
      SELECT id, username, email, name, bio, profile_image, created_at
      FROM users
      WHERE LOWER(username) LIKE LOWER($1) OR LOWER(name) LIKE LOWER($1)
      LIMIT 25
    `;

    const result = await query(searchSql, [`%${search}%`]);
    const users = await enrichUsers(result.rows, currentUserId);

    return res.json({
      success: true,
      data: users
    });
  } catch (err) {
    console.error('Search error:', err);
    return res.status(500).json({
      success: false,
      message: 'Search query failed.'
    });
  }
});

// GET /api/users/explore (Suggested users for sidebar widget)
app.get('/api/users/explore', optionalAuth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5;
    const currentUserId = req.user ? req.user.id : null;

    let usersRes;
    if (currentUserId) {
      usersRes = await query(
        `SELECT id, username, email, name, bio, profile_image, created_at
         FROM users
         WHERE id != $1 AND id NOT IN (SELECT following_id FROM follows WHERE follower_id = $1)
         ORDER BY id DESC
         LIMIT $2`,
        [currentUserId, limit]
      );
    } else {
      usersRes = await query(
        `SELECT id, username, email, name, bio, profile_image, created_at
         FROM users
         ORDER BY id DESC
         LIMIT $1`,
        [limit]
      );
    }

    const users = await enrichUsers(usersRes.rows, currentUserId);
    return res.json({
      success: true,
      users: users,
      data: users
    });
  } catch (err) {
    console.error('Explore users error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch suggested users.'
    });
  }
});

// GET /api/explore (Alias for general explore feed)
app.get('/api/explore', optionalAuth, async (req, res) => {
  try {
    const currentUserId = req.user ? req.user.id : null;
    const usersRes = await query(
      `SELECT id, username, email, name, bio, profile_image, created_at
       FROM users
       ORDER BY id DESC
       LIMIT 20`
    );
    const users = await enrichUsers(usersRes.rows, currentUserId);
    return res.json({
      success: true,
      data: { users }
    });
  } catch (err) {
    console.error('Explore error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch explore data.'
    });
  }
});

// GET /api/users/:username
app.get('/api/users/:username', optionalAuth, async (req, res) => {
  try {
    const username = req.params.username.trim().toLowerCase();
    const currentUserId = req.user ? req.user.id : null;

    const userRes = await query(
      `SELECT id, username, email, name, bio, profile_image, created_at
       FROM users
       WHERE LOWER(username) = $1`,
      [username]
    );

    if (userRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    const enriched = await enrichUsers(userRes.rows, currentUserId);

    return res.json({
      success: true,
      data: enriched[0]
    });
  } catch (err) {
    console.error('Get profile error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch user profile.'
    });
  }
});

// PUT /api/users/:id
app.put('/api/users/:id', requireAuth, async (req, res) => {
  try {
    const targetId = parseInt(req.params.id);

    if (req.user.id !== targetId) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to update this profile.'
      });
    }

    const { name, bio, profile_image } = req.body;

    const currentRes = await query('SELECT * FROM users WHERE id = $1', [targetId]);
    if (currentRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    const current = currentRes.rows[0];
    const newName = (name && name.trim()) ? name.trim() : current.name;
    const newBio = bio !== undefined ? bio.trim() : current.bio;
    const newAvatar = profile_image !== undefined ? profile_image.trim() : current.profile_image;

    const updateRes = await query(
      `UPDATE users
       SET name = $1, bio = $2, profile_image = $3
       WHERE id = $4
       RETURNING id, username, email, name, bio, profile_image, created_at`,
      [newName, newBio, newAvatar, targetId]
    );

    const enriched = await enrichUsers(updateRes.rows, req.user.id);

    return res.json({
      success: true,
      message: 'Profile updated successfully.',
      data: enriched[0]
    });
  } catch (err) {
    console.error('Update profile error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to update profile.'
    });
  }
});

// Status endpoint
app.get('/api/status', (req, res) => {
  const inMem = isDbInMemory();
  res.json({
    success: true,
    message: 'SocialHub API is operational',
    is_memory: inMem,
    database: inMem ? 'In-Memory PostgreSQL (Preview mode)' : 'PostgreSQL Cloud Database (Connected)',
    environment: (process.env.NODE_ENV === 'production' || process.env.VERCEL) ? 'production' : 'development',
    timestamp: new Date().toISOString()
  });
});

// SPA clean URL fallbacks for standalone Node/local dev
app.get('/login', (req, res) => res.sendFile(path.join(process.cwd(), 'public/login.html')));
app.get('/register', (req, res) => res.sendFile(path.join(process.cwd(), 'public/register.html')));
app.get('/profile', (req, res) => res.sendFile(path.join(process.cwd(), 'public/profile.html')));
app.get('/explore', (req, res) => res.sendFile(path.join(process.cwd(), 'public/explore.html')));

// Catch-all 404 for unhandled API requests
app.all('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `API endpoint ${req.method} ${req.path} not found.`
  });
});

export default app;
