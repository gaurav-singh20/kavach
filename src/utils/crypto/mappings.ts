import { type EncodedChar } from './types';

export const Charset: Record<string, EncodedChar> = {
  A: '00000',
  B: '00001',
  C: '00010',
  D: '00011',
  E: '00100',
  F: '00101',
  G: '00110',
  H: '00111',
  I: '01000',
  J: '01001',
  K: '01010',
  L: '01011',
  M: '01100',
  N: '01101',
  O: '01110',
  P: '01111',
  Q: '10000',
  R: '10001',
  S: '10010',
  T: '10011',
  U: '10100',
  V: '10101',
  W: '10110',
  X: '10111',
  Y: '11000',
  Z: '11001',
  '\x20': '11010', // space
  '\x00': '11011', // null byte
  // rest reserved till 31
};

export const ReverseCharset = Object.fromEntries(
  Object.entries(Charset).map(([key, value]) => [value, key]),
);
