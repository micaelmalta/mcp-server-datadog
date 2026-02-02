/* eslint-env node */
module.exports = {
  env: {
    node: true,
    es2024: true,
  },
  extends: ["standard", "prettier"],
  parserOptions: {
    ecmaVersion: 2024,
    sourceType: "module",
  },
  rules: {
    "no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
  },
  overrides: [
    {
      files: ["test/**/*.js", "**/*.test.js"],
      env: { node: true, es2024: true },
      globals: {
        describe: "readonly",
        it: "readonly",
        expect: "readonly",
        vi: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
      },
      rules: {
        "no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }],
        "import/first": "off",
        "no-use-before-define": "off",
      },
    },
  ],
};
