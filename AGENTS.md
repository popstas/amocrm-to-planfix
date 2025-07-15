# Repository Guidelines

- Use `npm test` to run the vitest suite before committing changes.
- Ensure the server in `src/index.ts` only starts when the file is executed directly (the file already checks `require.main`).
- Use environment variables only for `CONFIG`, `PORT` and `NODE_ENV`.
