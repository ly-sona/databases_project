import bcrypt from 'bcryptjs';
import db from '../config/database.js';

async function createTestUsers() {
  try {
    // First, get all permissions
    const permissions = await db('permissions').select('*');
    const permissionMap = permissions.reduce((acc, p) => {
      acc[p.name] = p.id;
      return acc;
    }, {});

    // Create admin user if not exists
    const adminExists = await db('users')
      .where('email', 'admin@example.com')
      .first();

    if (!adminExists) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      const [adminId] = await db('users').insert({
        username: 'admin',
        email: 'admin@example.com',
        password: hashedPassword
      });

      // Assign all permissions to admin
      const adminPermissions = permissions.map(p => ({
        user_id: adminId,
        permission_id: p.id
      }));
      await db('user_permissions').insert(adminPermissions);
      console.log('Admin user created');
    }

    // Create read-write user
    const writerExists = await db('users')
      .where('email', 'writer@example.com')
      .first();

    if (!writerExists) {
      const hashedPassword = await bcrypt.hash('password123', 10);
      const [writerId] = await db('users').insert({
        username: 'writer',
        email: 'writer@example.com',
        password: hashedPassword
      });

      // Assign write_query permission
      await db('user_permissions').insert({
        user_id: writerId,
        permission_id: permissionMap['write_query']
      });
      console.log('Read-write user created');
    }

    // Create read-only user
    const readerExists = await db('users')
      .where('email', 'reader@example.com')
      .first();

    if (!readerExists) {
      const hashedPassword = await bcrypt.hash('password123', 10);
      const [readerId] = await db('users').insert({
        username: 'reader',
        email: 'reader@example.com',
        password: hashedPassword
      });

      // Assign read_query permission
      await db('user_permissions').insert({
        user_id: readerId,
        permission_id: permissionMap['read_query']
      });
      console.log('Read-only user created');
    }

    console.log('All test users created successfully!');
    console.log('\nTest Users:');
    console.log('1. Admin User:');
    console.log('   Email: admin@example.com');
    console.log('   Password: admin123');
    console.log('   Permissions: All permissions');
    console.log('\n2. Read-Write User:');
    console.log('   Email: writer@example.com');
    console.log('   Password: password123');
    console.log('   Permissions: Can run SELECT, INSERT, UPDATE queries');
    console.log('\n3. Read-Only User:');
    console.log('   Email: reader@example.com');
    console.log('   Password: password123');
    console.log('   Permissions: Can only run SELECT queries');

  } catch (error) {
    console.error('Error creating test users:', error);
  } finally {
    process.exit();
  }
}

createTestUsers(); 