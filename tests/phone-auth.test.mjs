import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizePhone} from '../server-vercel/accounts.mjs';

test('normalizes Iranian mobile numbers with leading zero',()=>{
  assert.equal(normalizePhone('0912 345 6789'),'+989123456789');
});
test('normalizes Persian and Arabic numerals',()=>{
  assert.equal(normalizePhone('۰۹۱۲۳۴۵۶۷۸۹'),'+989123456789');
  assert.equal(normalizePhone('٠٩١٢٣٤٥٦٧٨٩'),'+989123456789');
});
test('preserves international calling codes',()=>{
  assert.equal(normalizePhone('+372 5555 1234'),'+37255551234');
  assert.equal(normalizePhone('0033 6 12 34 56 78'),'+33612345678');
});
test('rejects numbers that are too short or malformed',()=>{
  assert.equal(normalizePhone('123'), '');
  assert.equal(normalizePhone('+01234567890'), '');
});
