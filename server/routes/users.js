import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../config/database.js';
import { authenticateToken, checkPermission } from '../middleware/auth.js';

const router = express.Router();

// Get all users (admin only)
router.get('/', authenticateToken, checkPermission('admin'), async (req, res) => {
  try {
    const users = await db('users')
      .select('id', 'username', 'email')
      .orderBy('username');

    // Get permissions for each user
    const usersWithPermissions = await Promise.all(
      users.map(async (user) => {
        const permissions = await db('user_permissions')
          .join('permissions', 'user_permissions.permission_id', 'permissions.id')
          .where('user_permissions.user_id', user.id)
          .select('permissions.name');
        
        return {
          ...user,
          permissions: permissions.map(p => p.name)
        };
      })
    );

    res.json(usersWithPermissions);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Create new user (admin only)
router.post('/', authenticateToken, checkPermission('admin'), async (req, res) => {
  const { username, email, password, permissions } = req.body;

  try {
    // Check if user already exists
    const existingUser = await db('users')
      .where('email', email)
      .first();

    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const [userId] = await db('users').insert({
      username,
      email,
      password: hashedPassword
    });

    // Assign permissions
    if (permissions && permissions.length > 0) {
      const permissionIds = await db('permissions')
        .whereIn('name', permissions)
        .select('id');

      const userPermissions = permissionIds.map(p => ({
        user_id: userId,
        permission_id: p.id
      }));

      await db('user_permissions').insert(userPermissions);
    }

    res.status(201).json({ message: 'User created successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    console.log('Login attempt:', { username });

    // Try to find user by username first, then by email
    let user = await db('users').where('username', username).first();
    
    // If no user found by username, try email
    if (!user) {
      user = await db('users').where('email', username).first();
    }
    
    if (!user) {
      console.log('User not found');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      console.log('Invalid password');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const permissions = await db('user_permissions')
      .join('permissions', 'user_permissions.permission_id', 'permissions.id')
      .where('user_permissions.user_id', user.id)
      .select('permissions.name');

    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    console.log('Login successful for user:', {
      id: user.id,
      username: user.username,
      permissions: permissions.map(p => p.name)
    });

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        permissions: permissions.map(p => p.name)
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Error logging in: ' + error.message });
  }
});

// Get user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const permissions = await db('user_permissions')
      .join('permissions', 'user_permissions.permission_id', 'permissions.id')
      .where('user_permissions.user_id', req.user.id)
      .select('permissions.name');

    res.json({
      user: {
        id: req.user.id,
        username: req.user.username,
        email: req.user.email,
        permissions: permissions.map(p => p.name)
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Error fetching profile' });
  }
});

// Update user (requires 'update_user' permission)
router.put('/:id', authenticateToken, checkPermission('update_user'), async (req, res) => {
  try {
    const { username, email, permissions } = req.body;
    const userId = req.params.id;

    await db('users')
      .where('id', userId)
      .update({ username, email });

    if (permissions) {
      await db('user_permissions')
        .where('user_id', userId)
        .delete();

      const permissionIds = await db('permissions')
        .whereIn('name', permissions)
        .select('id');

      const userPermissions = permissionIds.map(p => ({
        user_id: userId,
        permission_id: p.id
      }));

      await db('user_permissions').insert(userPermissions);
    }

    res.json({ message: 'User updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Error updating user' });
  }
});

// Delete user (admin only)
router.delete('/:id', authenticateToken, checkPermission('admin'), async (req, res) => {
  const { id } = req.params;

  try {
    // Delete user permissions first
    await db('user_permissions').where('user_id', id).delete();
    
    // Delete user
    await db('users').where('id', id).delete();
    
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

export default router; 