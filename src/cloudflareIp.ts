import { BlockList, isIP } from "node:net";

/**
 * Cloudflare's published edge ranges (https://www.cloudflare.com/ips). If
 * Cloudflare adds a range that is missing here, callers reaching us through it
 * are keyed on the shared edge address instead of their own IP until it is added.
 */
const CLOUDFLARE_IPV4_RANGES: { network: string; prefix: number }[] = [
  { network: "103.21.244.0", prefix: 22 },
  { network: "103.22.200.0", prefix: 22 },
  { network: "103.31.4.0", prefix: 22 },
  { network: "104.16.0.0", prefix: 13 },
  { network: "104.24.0.0", prefix: 14 },
  { network: "108.162.192.0", prefix: 18 },
  { network: "131.0.72.0", prefix: 22 },
  { network: "141.101.64.0", prefix: 18 },
  { network: "162.158.0.0", prefix: 15 },
  { network: "172.64.0.0", prefix: 13 },
  { network: "173.245.48.0", prefix: 20 },
  { network: "188.114.96.0", prefix: 20 },
  { network: "190.93.240.0", prefix: 20 },
  { network: "197.234.240.0", prefix: 22 },
  { network: "198.41.128.0", prefix: 17 },
];

const CLOUDFLARE_IPV6_RANGES: { network: string; prefix: number }[] = [
  { network: "2400:cb00::", prefix: 32 },
  { network: "2405:8100::", prefix: 32 },
  { network: "2405:b500::", prefix: 32 },
  { network: "2606:4700::", prefix: 32 },
  { network: "2803:f800::", prefix: 32 },
  { network: "2a06:98c0::", prefix: 29 },
  { network: "2c0f:f248::", prefix: 32 },
];

const cloudflareRanges = (() => {
  const blockList = new BlockList();

  for (const { network, prefix } of CLOUDFLARE_IPV4_RANGES) {
    blockList.addSubnet(network, prefix, "ipv4");
  }

  for (const { network, prefix } of CLOUDFLARE_IPV6_RANGES) {
    blockList.addSubnet(network, prefix, "ipv6");
  }

  return blockList;
})();

export const getIsCloudflareIp = (ip: string): boolean => {
  switch (isIP(ip)) {
    case 4:
      return cloudflareRanges.check(ip, "ipv4");
    case 6:
      return cloudflareRanges.check(ip, "ipv6");
    default:
      return false;
  }
};
