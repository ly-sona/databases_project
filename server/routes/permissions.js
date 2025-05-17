import express from 'express';
import db from '../config/database.js';
import { authenticateToken, checkPermission } from '../middleware/auth.js';

const router = express.Router();

// Get all permissions
router.get('/', authenticateToken, checkPermission('admin'), async (req, res) => {
  try {
    const permissions = await db('permissions').select('*');
    res.json(permissions);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch permissions' });
  }
});

export default router; 