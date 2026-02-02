export default {
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
    "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
  },
};
