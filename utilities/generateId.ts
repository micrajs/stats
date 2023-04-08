export function generateId(prefix = 'id') {
  return [
    prefix,
    (Math.random() + 1).toString(36).substring(2),
    (Math.random() + 1).toString(36).substring(2),
  ].join('-');
}
