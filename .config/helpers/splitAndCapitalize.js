import { capitalize } from './capitalize';

export const splitAndCapitalize = (...needles) => (value) =>
  needles.reduce(
    (parsed, needle) => parsed.split(needle).map(capitalize).join(''),
    value,
  );
