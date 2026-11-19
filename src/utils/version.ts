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

// https://semver.org/#is-there-a-suggested-regular-expression-regex-to-check-a-semver-string
// Capture groups are core parts, prerelease, build. Core parts stay strings so huge numbers keep precision.
const SEMVER =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

type ParsedVersion = {
  core: [string, string, string];
  prerelease: string[];
  build: string[];
};

const parseVersion = (version: string): ParsedVersion | null => {
  const match = SEMVER.exec(version);
  if (!match) return null;
  return {
    core: [match[1], match[2], match[3]],
    prerelease: match[4] ? match[4].split('.') : [],
    build: match[5] ? match[5].split('.') : [],
  };
};

const compareStrings = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

/**
 * Numeric strings compare by value, so `006` equals `6`. Build metadata can carry leading
 * zeros. Values that are equal after stripping them fall back to the raw strings, so distinct
 * strings never compare equal.
 */
const compareNumeric = (left: string, right: string): number => {
  const a = left.replace(/^0+(?=\d)/, '');
  const b = right.replace(/^0+(?=\d)/, '');
  return a.length - b.length || compareStrings(a, b) || compareStrings(left, right);
};

/**
 * Compares dot-separated identifiers. Numeric ones compare as numbers and sort before
 * alphanumeric ones, which compare as ASCII. When one list is a prefix of the other,
 * the shorter one is lower.
 */
const compareIdentifiers = (left: string[], right: string[]): number => {
  const shared = Math.min(left.length, right.length);
  for (let index = 0; index < shared; index += 1) {
    const a = left[index];
    const b = right[index];
    const aNumeric = /^\d+$/.test(a);
    const bNumeric = /^\d+$/.test(b);
    const result =
      aNumeric && bNumeric
        ? compareNumeric(a, b)
        : aNumeric !== bNumeric
          ? aNumeric
            ? -1
            : 1
          : compareStrings(a, b);
    if (result !== 0) return result;
  }
  return left.length - right.length;
};

const compareParsed = (left: ParsedVersion, right: ParsedVersion): number => {
  for (let index = 0; index < 3; index += 1) {
    const result = compareNumeric(left.core[index], right.core[index]);
    if (result !== 0) return result;
  }
  // A release outranks any of its own prereleases (1.2.3-beta < 1.2.3).
  if (left.prerelease.length === 0 && right.prerelease.length > 0) return 1;
  if (left.prerelease.length > 0 && right.prerelease.length === 0) return -1;
  const prerelease = compareIdentifiers(left.prerelease, right.prerelease);
  if (prerelease !== 0) return prerelease;
  // Beyond the semver spec, which ignores build metadata. Dev builds here carry
  // `branch.counter` as metadata, so it is the only thing that orders them.
  return compareIdentifiers(left.build, right.build);
};

export type VersionOrder = 'asc' | 'desc';

/**
 * Comparator for sorting version strings by semver precedence.
 *
 * Differs from the spec in two ways, both so that distinct strings never compare equal:
 * - Build metadata breaks ties between otherwise equal versions, numeric parts as numbers
 *   (`+test.6` before `+test.10`).
 * - Strings that are not valid semver sort after every valid one, by raw string, in both
 *   directions. They are never dropped, so a malformed tag stays visible at the end.
 *
 * Prerelease tags compare as ASCII per the spec, so `1.2.3-beta` sorts before `1.2.3-dev`.
 */
export const compareVersions = (
  left: string,
  right: string,
  order: VersionOrder = 'asc',
): number => {
  const parsedLeft = parseVersion(left);
  const parsedRight = parseVersion(right);
  if (parsedLeft && parsedRight) {
    const result = compareParsed(parsedLeft, parsedRight) || compareStrings(left, right);
    return order === 'asc' ? result : -result;
  }
  if (parsedLeft) return -1;
  if (parsedRight) return 1;
  const result = compareStrings(left, right);
  return order === 'asc' ? result : -result;
};

export default shortenVersion;
