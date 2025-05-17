export async function up(knex) {
  return knex.schema.createTable('user_permissions', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE');
    table.integer('permission_id').unsigned().references('id').inTable('permissions').onDelete('CASCADE');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.unique(['user_id', 'permission_id']);
  });
}

export async function down(knex) {
  return knex.schema.dropTable('user_permissions');
} 