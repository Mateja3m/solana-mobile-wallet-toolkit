module.exports = {
  root: true,
  ignorePatterns: [
    '**/node_modules/**',
    'demo/android/**',
    'demo/ios/**',
    'docs/**'
  ],
  overrides: [
    {
      files: ['demo/**/*.{js,jsx}'],
      extends: ['expo'],
      rules: {
        'react-hooks/exhaustive-deps': 'error'
      }
    },
    {
      files: ['toolkit/**/*.js'],
      extends: ['eslint:recommended'],
      env: {
        es2022: true
      },
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module'
      }
    }
  ]
};
