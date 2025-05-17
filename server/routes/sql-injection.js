import express from 'express';
import db from '../config/database.js';

const router = express.Router();

//backup data to restore later
let userBackups = [];
let permissionBackups = [];
let userPermissionBackups = [];

//initialize backups immediately
(async function initializeBackups() {
  try {
    userBackups = await db('users').select('*');
    permissionBackups = await db('permissions').select('*');
    userPermissionBackups = await db('user_permissions').select('*');
    console.log('Initial backups created:', {
      users: userBackups.length,
      permissions: permissionBackups.length,
      userPermissions: userPermissionBackups.length
    });
  } catch (error) {
    console.error('Error creating initial backups:', error);
  }
})();

//reset endpoint to restore original data
router.post('/reset', async (req, res) => {
  try {
    await db.transaction(async trx => {
      await trx.raw('SET FOREIGN_KEY_CHECKS = 0');
      
      await trx('user_permissions').delete();
      await trx('users').delete();

      if (userBackups.length > 0) {
        for (const user of userBackups) {
          const userData = {...user};
          await trx('users').insert(userData).onConflict('id').merge();
        }
      }
      
      if (userPermissionBackups.length > 0) {
        for (const perm of userPermissionBackups) {
          const permData = {...perm};
          await trx('user_permissions').insert(permData).onConflict(['user_id', 'permission_id']).ignore();
        }
      }
      
      await trx.raw('SET FOREIGN_KEY_CHECKS = 1');
    });
    
    res.json({ 
      message: 'Database reset successful', 
      stats: {
        usersRestored: userBackups.length,
        permissionsRestored: permissionBackups.length,
        userPermissionsRestored: userPermissionBackups.length
      }
    });
  } catch (error) {
    console.error('Error resetting database:', error);
    res.status(500).json({ error: error.message });
  }
});

//Part A: Vulnerable SELECT endpoint for SQL injection
router.get('/unsafe-select', async (req, res) => {
  try {
    const { query } = req.query;
    
    console.log('Executing SELECT query:', query);
    
    const result = await db.raw(query);
    res.json(result[0]);
  } catch (error) {
    console.error('Error in unsafe-select:', error);
    res.status(500).json({ error: error.message });
  }
});

//Part B: Vulnerable UPDATE endpoint for SQL injection
router.post('/unsafe-update', async (req, res) => {
  try {
    const { query } = req.body;
    
    console.log('Executing UPDATE query:', query);
    
    const result = await db.raw(query);
    res.json({ 
      message: 'Query executed', 
      rowsAffected: result[0].affectedRows || 0,
      query
    });
  } catch (error) {
    console.error('Error in unsafe-update:', error);
    res.status(500).json({ error: error.message });
  }
});

//Part C: Safe SELECT endpoint using prepared statements
router.get('/safe-select', async (req, res) => {
  try {
    const { username } = req.query;

    const result = await db('users')
      .where('username', 'like', `%${username}%`)
      .select('*');
      
    res.json(result);
  } catch (error) {
    console.error('Error in safe-select:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router; 