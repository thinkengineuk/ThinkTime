// Base44 encoding for generating human-readable ticket IDs
const BASE44_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefgh';

export function encodeBase44(num) {
  if (num === 0) return BASE44_ALPHABET[0];
  
  let result = '';
  while (num > 0) {
    result = BASE44_ALPHABET[num % 44] + result;
    num = Math.floor(num / 44);
  }
  return result;
}

export function decodeBase44(str) {
  let result = 0;
  for (let i = 0; i < str.length; i++) {
    result = result * 44 + BASE44_ALPHABET.indexOf(str[i]);
  }
  return result;
}

export function generateTicketId(prefix, counter) {
    return `${prefix}-${counter}`;
}

export function parseTicketId(displayId) {
  const parts = displayId.split('-');
  if (parts.length !== 2) return null;
  return {
    prefix: parts[0],
    number: decodeBase44(parts[1])
  };
}