export async function up(knex) {
  await knex.schema.createTable('departments', (table) => {
    table.increments('dept_id').primary();
    table.string('dept_name').notNullable().unique();
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('employees', (table) => {
    table.increments('emp_id').primary();
    table.integer('supervisor_id').unsigned().references('emp_id').inTable('employees').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('emp_dept_assignments', (table) => {
    table.increments('id').primary();
    table.integer('emp_id').unsigned().references('emp_id').inTable('employees').onDelete('CASCADE');
    table.integer('dept_id').unsigned().references('dept_id').inTable('departments').onDelete('CASCADE');
    table.date('start_date').notNullable();
    table.date('end_date').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('job_positions', (table) => {
    table.increments('job_id').primary();
    table.integer('dept_id').unsigned().references('dept_id').inTable('departments');
    table.string('description').notNullable();
    table.date('posted_date').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('applications', (table) => {
    table.increments('app_id').primary();
    table.integer('person_id').unsigned().references('id').inTable('users');
    table.integer('job_id').unsigned().references('job_id').inTable('job_positions');
    table.date('app_date').notNullable();
    table.boolean('selected_flag').defaultTo(false);
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('interviews', (table) => {
    table.increments('interview_id').primary();
    table.integer('app_id').unsigned().references('app_id').inTable('applications');
    table.date('interview_date').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('interview_participation', (table) => {
    table.increments('id').primary();
    table.integer('interview_id').unsigned().references('interview_id').inTable('interviews');
    table.integer('interviewer_id').unsigned().references('emp_id').inTable('employees');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('products', (table) => {
    table.increments('product_id').primary();
    table.string('prod_type').notNullable();
    table.decimal('list_price', 10, 2).notNullable();
    table.decimal('weight', 10, 2);
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('sales', (table) => {
    table.increments('sale_id').primary();
    table.integer('emp_id').unsigned().references('emp_id').inTable('employees');
    table.integer('site_id').unsigned();
    table.timestamp('sale_time').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('sale_lines', (table) => {
    table.increments('id').primary();
    table.integer('sale_id').unsigned().references('sale_id').inTable('sales');
    table.integer('product_id').unsigned().references('product_id').inTable('products');
    table.integer('quantity').notNullable();
    table.decimal('sold_price', 10, 2).notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
}

export async function down(knex) {
  await knex.schema.dropTable('sale_lines');
  await knex.schema.dropTable('sales');
  await knex.schema.dropTable('products');
  await knex.schema.dropTable('interview_participation');
  await knex.schema.dropTable('interviews');
  await knex.schema.dropTable('applications');
  await knex.schema.dropTable('job_positions');
  await knex.schema.dropTable('emp_dept_assignments');
  await knex.schema.dropTable('employees');
  await knex.schema.dropTable('departments');
} 