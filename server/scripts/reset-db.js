import knex from 'knex';
import dotenv from 'dotenv';

dotenv.config();

const db = knex({
  client: 'mysql2',
  connection: {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PW
  }
});

async function resetDatabase() {
  try {
    // Drop database if exists
    await db.raw(`DROP DATABASE IF EXISTS ${process.env.DB_NAME}`);
    console.log('Dropped database if existed');

    // Create database
    await db.raw(`CREATE DATABASE ${process.env.DB_NAME}`);
    console.log('Created new database');

    process.exit(0);
  } catch (error) {
    console.error('Error resetting database:', error);
    process.exit(1);
  }
}

resetDatabase(); 