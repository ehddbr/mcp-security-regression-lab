const redosSizes = Object.freeze([8, 12, 16, 20, 24, 28]);

export const URI_CASES = Object.freeze([
  Object.freeze({
    id: 'path-valid',
    template: '/users{/id*}',
    uri: '/users/alpha,beta',
    expected: 'match',
  }),
  Object.freeze({
    id: 'simple-valid',
    template: '{id*}',
    uri: 'alpha,beta',
    expected: 'match',
  }),
  Object.freeze({
    id: 'ordinary-no-match',
    template: '/users/{id}',
    uri: '/projects/42',
    expected: 'no_match',
  }),
  Object.freeze({
    id: 'path-invalid-control',
    template: '/users{/id*}',
    uri: '/users/a,b/',
    expected: 'no_match',
  }),
  Object.freeze({
    id: 'simple-invalid-control',
    template: '{id*}',
    uri: 'a,b/',
    expected: 'no_match',
  }),
  Object.freeze({
    id: 'path-redos',
    template: '/users{/id*}',
    prefix: '/users/',
    suffix: '/',
    sizes: redosSizes,
    expectedByVersion: Object.freeze({ '1.25.1': 'slow_or_timeout', '1.25.2': 'no_match_under_budget' }),
  }),
  Object.freeze({
    id: 'simple-redos',
    template: '{id*}',
    prefix: '',
    suffix: '/',
    sizes: redosSizes,
    expectedByVersion: Object.freeze({ '1.25.1': 'slow_or_timeout', '1.25.2': 'no_match_under_budget' }),
  }),
]);

export const getUriCase = (caseId) => URI_CASES.find(({ id }) => id === caseId);
