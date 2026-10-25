# Historical setup snippets

These files predate the deployed migration history. They contain obsolete table,
policy and webhook assumptions. They are retained as reference, outside the CLI
migration directory, and must not be run as production repair scripts.

The files in `../migrations/` were fetched from the linked project's actual migration
history after the October 2026 repairs. Their timestamps match the database.
The earliest historical migrations still assume some manually created base tables;
the history alone is not a verified empty-database bootstrap.
