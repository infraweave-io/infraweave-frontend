/** Length of a git short sha — enough of the build metadata to identify a build. */
const METADATA_PREFIX = 7;
/** A few trailing characters, so two builds sharing a prefix stay distinguishable. */
const METADATA_SUFFIX = 3;
const ELLIPSIS = '...';

/** Below this, nothing is gained by eliding. */
const MIN_LENGTH_TO_SHORTEN = 25;

/**
 * Shortens a version for display in a table cell.
 *
 * Dev builds carry a full 40-character commit sha as semver build metadata
 * (`0.0.0-dev+e9eb0882…743281`), which is far wider than the version column and
 * pushes every other column off-screen. Where the build metadata is long enough
 * to elide on its own, only the metadata is cut and the part before `+` is kept
 * intact, since that is what identifies the release. Otherwise the middle of the
 * whole string is elided, which can cut through the semver core — a long version
 * has to be shortened one way or another.
 *
 * The result is lossy, so every caller must expose the full string as well —
 * a tooltip, a `title`, or a copy affordance.
 */
export const shortenVersion = (version: string): string => {
  if (!version) return '';
  if (version.length < MIN_LENGTH_TO_SHORTEN) return version;

  const [base, ...rest] = version.split('+');
  if (rest.length > 0) {
    // Rejoin: '+' is only special on its first occurrence.
    const metadata = rest.join('+');
    if (metadata.length > METADATA_PREFIX + METADATA_SUFFIX + ELLIPSIS.length) {
      return `${base}+${metadata.slice(0, METADATA_PREFIX)}${ELLIPSIS}${metadata.slice(
        -METADATA_SUFFIX,
      )}`;
    }
    // Metadata too short to elide on its own, but the version as a whole is still
    // too long for the column — fall through to the generic elision rather than
    // returning it at full width.
  }

  // Either no build metadata, or metadata not worth eliding — elide the middle.
  return `${version.slice(0, 10)}${ELLIPSIS}${version.slice(-8)}`;
};

export default shortenVersion;
