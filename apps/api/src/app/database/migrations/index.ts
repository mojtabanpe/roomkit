import { InitialSchema1785658283780 } from './1785658283780-InitialSchema';

/**
 * Migrations are listed explicitly rather than found with a glob.
 *
 * The API ships as a single webpack bundle (`apps/api/webpack.config.cjs`), and
 * a glob resolved at runtime finds nothing inside it — the files no longer
 * exist as files. Anything added here must be imported, or it will run in
 * development and silently not in production, which is the worst of both.
 *
 * Order matters: TypeORM runs them in array order, not by timestamp.
 */
export const MIGRATIONS = [InitialSchema1785658283780];
