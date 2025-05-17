import db from '../config/database.js';

async function checkUsers() {
  try {
    console.log('Checking users...');
    const users = await db('users').select('*');
    console.log('Users:', JSON.stringify(users, null, 2));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}

checkUsers(); 