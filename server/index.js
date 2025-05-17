import express from "express";
import cors from "cors";
import "dotenv/config";
import userRoutes from './routes/users.js';
import permissionRoutes from './routes/permissions.js';
import sqlInjectionRoutes from './routes/sql-injection.js';
import queryRoutes from './routes/query.js';
import db from './config/database.js';

const app = express();
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/users', userRoutes);
app.use('/api/permissions', permissionRoutes);
app.use('/api/sql-injection', sqlInjectionRoutes);
app.use('/api/query-builder', queryRoutes);

/* ---- 4 simple endpoints backed by your new VIEWS ------------ */
app.get("/avg-salary", async (_, res) => {
  const data = await db("Employee")
    .join("Person", "Employee.EmpID", "Person.PersonID")
    .leftJoin("v_avg_monthly_salary", "Employee.EmpID", "v_avg_monthly_salary.EmpID")
    .select(
      "Employee.EmpID",
      "Person.FName",
      "Person.LName",
      "v_avg_monthly_salary.AvgMonthlySalary"
    );
  res.json(data);
});

app.get("/rounds", async (_, res) => {
  const data = await db("v_rounds_passed")
    .join("Person", "v_rounds_passed.IntervieweeID", "Person.PersonID")
    .join("Job_Position", "v_rounds_passed.JobID", "Job_Position.JobID")
    .select("v_rounds_passed.*", "Person.FName", "Person.LName", "Job_Position.Description");
  res.json(data);
});

app.get("/items-sold", async (_, res) => res.json(await db.select().from("v_items_sold")));

app.get("/part-cost", async (_, res) => {
  const data = await db("v_part_cost_per_product")
    .join("Product", "v_part_cost_per_product.ProductID", "Product.ProductID")
    .select(
      "v_part_cost_per_product.ProductID",
      "v_part_cost_per_product.TotalPartCost",
      "Product.ProdType",
      db.raw("CAST(Product.ListPrice AS DECIMAL(10,2)) as ListPrice")
    );
  res.json(data);
});

app.post("/query", async (req, res) => {
  const sql = req.body.sql?.trim();
  // Only allow SELECT queries
  if (!sql || !/^select/i.test(sql)) {
    return res.status(400).json({ error: "Only SELECT queries are allowed." });
  }
  try {
    const result = await db.raw(sql);
    res.json(result[0]); // knex returns [rows, fields] for mysql2
  } catch (e) {
    res.status(400).json({ error: e.sqlMessage || e.message });
  }
});

// Initialize database and start server
const PORT = process.env.PORT || 3000;

// Create initial permissions
async function initializePermissions() {
  const permissions = [
    // User management permissions
    { name: 'create_user', description: 'Can create new users' },
    { name: 'update_user', description: 'Can update user information' },
    { name: 'delete_user', description: 'Can delete users' },
    { name: 'view_users', description: 'Can view user information' },
    
    // Query permissions
    { name: 'admin', description: 'Full database access' },
    { name: 'write_query', description: 'Can run SELECT, INSERT, and UPDATE queries' },
    { name: 'read_query', description: 'Can run SELECT queries' }
  ];

  // Insert permissions
  for (const permission of permissions) {
    await db('permissions')
      .insert(permission)
      .onConflict('name')
      .ignore();
  }

  // Get all permissions
  const allPermissions = await db('permissions').select('*');
  
  // Get admin user
  const admin = await db('users')
    .where('email', 'admin@example.com')
    .first();

  if (admin) {
    // Delete existing permissions for admin
    await db('user_permissions')
      .where('user_id', admin.id)
      .delete();

    // Assign all permissions to admin
    const adminPermissions = allPermissions.map(p => ({
      user_id: admin.id,
      permission_id: p.id
    }));

    await db('user_permissions').insert(adminPermissions);
    console.log('Admin permissions updated');
  }
}

// Initialize database and start server
async function startServer() {
  try {
    // Test database connection
    console.log('Testing database connection...');
    const testConnection = await db.raw('SELECT 1');
    console.log('Database connection successful:', testConnection);

    // Check if tables exist
    console.log('Checking tables...');
    const tables = await db.raw('SHOW TABLES');
    console.log('Available tables:', tables[0]);

    // Check users table
    console.log('Checking users table...');
    const users = await db('users').select('*');
    console.log('Users in database:', users);

    // Check permissions table
    console.log('Checking permissions table...');
    const permissions = await db('permissions').select('*');
    console.log('Permissions in database:', permissions);

    await initializePermissions();
    
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Error starting server:', error);
    process.exit(1);
  }
}

startServer(); 