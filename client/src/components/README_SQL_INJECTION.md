# SQL Injection Assignment

This folder contains the SQL Injection demonstration components that fulfill the requirements of the SQL Injection assignment.

## Overview

The demonstration includes:

1. A vulnerable form that allows SQL injection through a SELECT statement
2. A vulnerable form that allows SQL injection through an UPDATE statement
3. A protected form that uses prepared statements to prevent SQL injection

## How to Use

1. Run the server and client applications
2. Navigate to the SQL Injection Demo page from the sidebar
3. Use the forms to test SQL injection techniques

## SQL Injection Examples

### Part A: Vulnerable SELECT Query

Try these SQL injections in the username field:

- Normal input: `john`
- SQL Injection to see all users: `' OR '1'='1`
- SQL Injection to see admin users: `' AND username LIKE '%admin%`
- SQL Injection to extract table information: `' UNION SELECT table_name, column_name, 1, 2, 3 FROM information_schema.columns WHERE table_schema = DATABASE() --`

### Part B: Vulnerable UPDATE Query

Try these SQL injections in the email field (after entering a valid ID):

- Normal input: `new@email.com`
- SQL Injection to update all users: `x'; UPDATE users SET email='hacked@example.com' --`
- SQL Injection to update admin privileges: `x'; UPDATE users SET is_admin=1 WHERE username='yourusername' --`

### Part C: Safe SELECT Query (Using Prepared Statement)

The same SQL injections from Part A will not work here because the query is protected using prepared statements.

## Code Explanation

### Server-side Code

The server-side implementation includes:

1. Vulnerable route handlers that directly concatenate user input into SQL queries
2. A protected route handler that uses prepared statements via the Knex query builder

### Client-side Code

The client-side implementation includes:

1. A React component with forms for each part of the assignment
2. Visual feedback showing the executed queries and results
3. Error handling for failed queries

## Screenshots for Submission

To prepare for submission Option 2, take screenshots of:

1. The code for parts A, B, and C
2. The forms with injected SQL commands
3. The results of executing each injected command

Combine these screenshots into a single PDF file for submission. 