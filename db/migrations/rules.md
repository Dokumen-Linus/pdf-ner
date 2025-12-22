# Migration SQL Scripts

## Naming Conventions

Migration is performed by dbmate which runs scripts in alphanumeric order.
Each script name must start with a seven-digit number to define ordering and allow for easy insertion of new scripts that should occur at any stage of the database creation process.
For example, 0000001 has not been used yet in case some operations are needed before schema and role creation.
dbmate does not support CREATE DATABASE so the database must already be created.

After the seven-digit number, the script name includes a short description of the changes made to the database.

### Consistent Leading Zeros

| Leading Zeros | Regex | Components Modified |
| --- | --- | --- |
| 6 | 000000* | TBD |
| 5 | 00000* | Schemas and Roles |
| 4 | 0000* | Tables |
| 3 | 000* | Views |
| 2 | 00* | Privileges |
| 1 | 0* | TBD |
| 0 | * | TBD |

Following this convention, at most 99 tables can be created since the fifth and sixth digits define the table order. For table scripts (4 leading zeros), the seventh digit is reserved for ALTER scripts.

## Immutable Scripts

Do not modify existing scripts that have been committed to the repository and applied to the database.
This way, the history of the database is preserved and previous states can be restored.
Instead of editing a CREATE script, write an ALTER script.
Following the naming conventions, the first ALTER script for PDFS table would be named 0000131_what_changed.sql.

## New Table Creation

After creating a new table, re-run the auth_app_privileges script to grant the app_user permission to the table.
You can do this by using either command below:

```cmd
psql -d dokumen -f ./db/migrations/0010000_auth_app_privileges.sql
```

```cmd
psql -d dokumen -c "GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA app TO app_user;"
```
