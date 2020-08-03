import { join } from 'path';

export const config = (...path) => join(__dirname, '../', ...(path || []));
export const root = (...path) => join(__dirname, '../../', ...(path || []));
export const build = (...path) => join(__dirname, '../../.micra', ...(path || []));
