import base from '@mirsonix/eslint-config/base';

export default [
  ...base,
  {
    // Nest DI relies on runtime class imports for emitDecoratorMetadata; `import type` would break injection.
    rules: { '@typescript-eslint/consistent-type-imports': 'off' },
  },
];
