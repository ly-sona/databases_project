import express from 'express';
import db from '../config/database.js';

const router = express.Router();

// Get database schema with enhanced metadata
router.get('/schema', async (req, res) => {
  try {
    const [tables] = await db.raw(`
      SELECT 
        t.TABLE_NAME                              AS table_name,
        GROUP_CONCAT(DISTINCT c.COLUMN_NAME)      AS columns,
        GROUP_CONCAT(DISTINCT CONCAT(
          c.COLUMN_NAME, ':',
          c.DATA_TYPE, ':',
          COALESCE(c.CHARACTER_MAXIMUM_LENGTH, ''), ':',
          c.IS_NULLABLE, ':',
          COALESCE(c.COLUMN_DEFAULT, ''), ':',
          COALESCE(c.EXTRA, '')
        ))                                         AS column_details,
        GROUP_CONCAT(DISTINCT CONCAT(
          k.REFERENCED_TABLE_NAME, ':',
          k.COLUMN_NAME, ':',
          k.REFERENCED_COLUMN_NAME
        ))                                         AS foreign_keys
      FROM information_schema.tables  t
      LEFT JOIN information_schema.columns        c  ON t.TABLE_SCHEMA = c.TABLE_SCHEMA AND t.TABLE_NAME = c.TABLE_NAME
      LEFT JOIN information_schema.key_column_usage k ON k.TABLE_SCHEMA = t.TABLE_SCHEMA AND k.TABLE_NAME = t.TABLE_NAME AND k.REFERENCED_TABLE_NAME IS NOT NULL
      WHERE t.TABLE_SCHEMA = DATABASE() AND t.TABLE_TYPE = 'BASE TABLE'
      GROUP BY t.TABLE_NAME;
    `);

    const [pkRows] = await db.raw(`
      SELECT TABLE_NAME, GROUP_CONCAT(COLUMN_NAME) AS primary_keys
      FROM   information_schema.key_column_usage
      WHERE  CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'PRIMARY'
      GROUP BY TABLE_NAME;
    `);

    const pkMap = Object.fromEntries(pkRows.map(r => [r.TABLE_NAME, r.primary_keys.split(',')]));

    const schema = tables.map(t => {
      const cols = (t.column_details || '').split(',').filter(Boolean).map(col => {
        const [name, type, len, nullable, def, extra] = col.split(':');
        return { name, type, length: len || null, nullable: nullable === 'YES', defaultValue: def || null, extra };
      });
      const fks = (t.foreign_keys || '').split(',').filter(Boolean).map(fk => {
        const [refTable, fromCol, toCol] = fk.split(':');
        return { table: refTable, fromColumn: fromCol, toColumn: toCol };
      });
      const dependsOn = [...new Set(fks.map(fk => fk.table))];
      return {
        name: t.table_name,
        columns: cols,
        primaryKeys: pkMap[t.table_name] || [],
        relationships: fks,
        dependsOn,
        isIndependentTable: dependsOn.length === 0,
        supportsInsert: true,
      };
    });

    res.json(schema);
  } catch (err) {
    console.error('Error fetching schema:', err);
    res.status(500).json({ error: 'Failed to fetch database schema' });
  }
});

// Build and execute queries
router.post('/query', async (req, res) => {
  try {
    const { operation, table, fields = [], joins = [], conditions = [], updates = {} } = req.body;

    if (!table) throw new Error('Table not specified');

    let query = db(table);

    // ---- joins ----------------------------------------------------------
    for (const j of joins) {
      const method = `${j.joinType.toLowerCase()}Join`; // innerJoin / leftJoin etc.
      if (typeof query[method] !== 'function') throw new Error(`Invalid join type: ${j.joinType}`);
      query = query[method](j.toTable, `${j.fromTable}.${j.fromColumn}`, `${j.toTable}.${j.toColumn}`);
    }

    // ---- operations -----------------------------------------------------
    switch (operation) {
      /* ------------------------- SELECT ------------------------------- */
      case 'SELECT': {
        query = query.select(fields.length ? fields : '*');
        for (const c of conditions) {
          if (c.operator === 'LIKE') query = query.where(c.field, c.operator, `%${c.value}%`);
          else query = query.where(c.field, c.operator, c.value);
        }
        break;
      }

      /* ------------------------- INSERT ------------------------------- */
      case 'INSERT': {
        // expect "data" object OR fallback to fields+conditions pair list
        const { data } = req.body;
        const toInsert = data || Object.fromEntries(conditions.map(c => [c.field, c.value]));
        if (!Object.keys(toInsert).length) throw new Error('No values supplied for INSERT');
        query = query.insert(toInsert);
        break;
      }

      /* ------------------------- UPDATE ------------------------------- */
      case 'UPDATE': {
        // -----------------------------------------------------------------
        //  Prevent accidental primary-key updates (would break FK integrity)
        // -----------------------------------------------------------------
        // 1) Get the primary-key columns for the target table.
        const [pkRows] = await db.raw(
          `SELECT COLUMN_NAME
             FROM information_schema.key_column_usage
            WHERE CONSTRAINT_SCHEMA = DATABASE()
              AND TABLE_NAME = ?
              AND CONSTRAINT_NAME = 'PRIMARY'`,
          [table]
        );

        const pkCols = pkRows.map(r => r.COLUMN_NAME);

        // 2) Drop any PK fields from the requested updates
        const safeUpdates = Object.fromEntries(
          Object.entries(updates).filter(([col]) => !pkCols.includes(col))
        );

        // 3) If nothing remains to update, abort with a 400
        if (Object.keys(safeUpdates).length === 0) {
          return res.status(400).json({
            error: `Refusing to update primary-key column(s) ${pkCols.join(', ')}. ` +
                   `Modify non-key columns or use a controlled cascade procedure instead.`
          });
        }

        if (!Object.keys(updates).length) throw new Error('No column values supplied for UPDATE');
        if (!conditions.length)       throw new Error('Refusing to UPDATE without WHERE clause');
        query = query.update(safeUpdates);
        for (const c of conditions) {
          query = query.where(c.field, c.operator, c.value);
        }
        break;
      }

      /* ------------------------- DELETE ------------------------------- */
      case 'DELETE': {
        if (!conditions.length) throw new Error('Refusing to DELETE without WHERE clause');
        for (const c of conditions) {
          query = query.where(c.field, c.operator, c.value);
        }

        // apply delete action
        query = query.del();

        // execute with FK-error handling later
        break;
      }

      default:
        throw new Error(`Unsupported operation: ${operation}`);
    }

    // If we reached here the query variable is ready
    try {
      const result = await query;
      return res.json(result);
    } catch (e) {
      // MySQL foreign-key violation when deleting parent row
      if (e.code === 'ER_ROW_IS_REFERENCED_2' || e.code === 'ER_ROW_IS_REFERENCED') {
        return res.status(409).json({
          error: 'Delete blocked by foreign-key constraint',
          detail: e.message
        });
      }
      throw e; // let global handler return 500 for other errors
    }
  } catch (err) {
    console.error('Error executing query:', err);
    res.status(500).json({ error: err.message || 'Failed to execute query' });
  }
});

// Execute raw SQL statements with better error handling
router.post('/sql', async (req, res) => {
  try {
    const { sql } = req.body;
    
    if (!sql || typeof sql !== 'string') {
      return res.status(400).json({ 
        success: false,
        error: 'SQL statement is required' 
      });
    }
    
    // Log the SQL being executed (for debugging)
    console.log('Executing SQL:', sql);
    
    try {
      // Execute with multiple statements enabled (needed for transactions)
      const result = await db.raw(sql, { multipleStatements: true });
      
      console.log('SQL executed successfully');
      
      // Return success with results
      res.json({
        success: true,
        result: Array.isArray(result) && result.length > 0 ? result[0] : result
      });
    } catch (sqlError) {
      console.error('SQL execution error:', sqlError);
      
      // Format the error for better client-side handling
      const errorDetails = {
        message: sqlError.message,
        code: sqlError.code,
        sqlState: sqlError.sqlState,
        errno: sqlError.errno
      };
      
      res.status(500).json({ 
        success: false,
        error: `SQL Error: ${sqlError.message}`,
        details: errorDetails
      });
    }
  } catch (err) {
    console.error('Error in SQL endpoint:', err);
    res.status(500).json({ 
      success: false,
      error: err.message || 'Failed to process SQL request'
    });
  }
});

// -----------------------------------------------------------------
// 3.  /count  – simple count(*) endpoint to support DELETE preview
// -----------------------------------------------------------------
router.post('/count', async (req, res) => {
  try {
    const { table, conditions = [] } = req.body;
    if (!table) return res.status(400).json({ error: 'Table not specified' });

    const validConds = (conditions || []).filter(c => c.field && c.operator && c.value !== undefined);
    if (validConds.length === 0) {
      return res.status(400).json({ error: 'No valid conditions supplied' });
    }

    let q = db(table).count({ cnt: '*' });
    validConds.forEach(c => {
      q = q.where(c.field, c.operator, c.value);
    });

    const [{ cnt }] = await q;
    res.json({ count: cnt });
  } catch (err) {
    console.error('Error executing count:', err);
    res.status(500).json({ error: err.message || 'Failed to count records' });
  }
});

// allow simple GET /count?table=... with JSON encoded conditions for easier testing
router.get('/count', async (req, res) => {
  try {
    const table = req.query.table;
    const conditions = req.query.conditions ? JSON.parse(req.query.conditions) : [];
    if (!table) return res.status(400).json({ error: 'Table not specified' });

    let q = db(table).count({ cnt: '*' });
    (conditions || []).forEach(c => {
      q = q.where(c.field, c.operator, c.value);
    });

    const [{ cnt }] = await q;
    res.json({ count: cnt });
  } catch (err) {
    console.error('Error executing count (GET):', err);
    res.status(500).json({ error: err.message || 'Failed to count records' });
  }
});

export default router; 