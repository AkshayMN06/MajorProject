// Minimal config so client logic tests can run with the vitest already
// installed in ../server (the client has no test runner of its own):
//   ../server/node_modules/.bin/vitest run --config tests/vitest.config.mjs
// Kept outside src/ so it is not part of the client build or type check.
export default {
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
};
