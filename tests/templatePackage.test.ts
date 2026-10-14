import { readFileSync } from 'node:fs';

import { expect, test } from 'vitest';

const rootPackage = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const templatePackage = JSON.parse(
  readFileSync(new URL('../template/package.json', import.meta.url), 'utf8'),
);

test('keeps the generated demo aligned with the released package peers', () => {
  expect(templatePackage.version).toBe(rootPackage.version);
  expect(templatePackage.dependencies['@milkdown/crepe']).toBe(
    rootPackage.peerDependencies['@milkdown/crepe'],
  );
  expect(templatePackage.dependencies['@milkdown/kit']).toBe(
    rootPackage.peerDependencies['@milkdown/kit'],
  );
  expect(templatePackage.dependencies.katex).toBe(rootPackage.devDependencies.katex);
});
