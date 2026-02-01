/**
 * Tezos address validation and .tez domain resolution
 */

/**
 * Regular expression for validating Tezos addresses
 * Matches tz1/tz2/tz3 (implicit accounts) and KT1 (contract addresses)
 * Base58check encoding with 33 characters after the prefix
 */
const TEZOS_ADDRESS_REGEX = /^(tz[1-3]|KT1)[1-9A-HJ-NP-Za-km-z]{33}$/;

/**
 * Check if a string is a valid Tezos address
 * @param input String to validate
 * @returns true if valid Tezos address (tz1/tz2/tz3/KT1)
 */
export function isTezosAddress(input: string): boolean {
  return TEZOS_ADDRESS_REGEX.test(input);
}

/**
 * Check if input looks like a .tez domain name
 * @param input String to check
 * @returns true if ends with .tez
 */
export function isTezDomain(input: string): boolean {
  return input.endsWith('.tez') && input.length > 4 && !isTezosAddress(input);
}

/**
 * Result of resolving a Tezos address or domain
 */
export interface TezosResolveResult {
  address: string;
  warning?: string;
}

/**
 * Resolve a .tez domain to its Tezos address using TzKT API
 * @param domain The .tez domain to resolve (e.g., "alice.tez")
 * @returns The resolved Tezos address
 * @throws Error if domain cannot be resolved
 */
export async function resolveTezDomain(domain: string): Promise<string> {
  // Remove .tez suffix for API call
  const name = domain.toLowerCase().replace(/\.tez$/, '');

  const url = `https://api.tzkt.io/v1/domains?name=${encodeURIComponent(name)}&select=address`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to resolve .tez domain "${domain}": HTTP ${response.status}`);
  }

  const data = await response.json() as Array<{ address: string }>;

  if (!data || data.length === 0 || !data[0].address) {
    throw new Error(`.tez domain "${domain}" could not be resolved to an address`);
  }

  return data[0].address;
}

/**
 * Validate and optionally resolve a Tezos address or .tez domain
 * @param input Tezos address (tz1/tz2/tz3/KT1) or .tez domain
 * @returns Resolved address
 * @throws Error if input is invalid or cannot be resolved
 */
export async function resolveTezosAddress(input: string): Promise<TezosResolveResult> {
  // If it's already a valid Tezos address, return it
  if (isTezosAddress(input)) {
    return { address: input };
  }

  // Check if it looks like a .tez domain
  if (!isTezDomain(input)) {
    throw new Error(
      `Invalid input: "${input}" is not a valid Tezos address or .tez domain`
    );
  }

  // Resolve .tez domain
  const address = await resolveTezDomain(input);
  return { address };
}
