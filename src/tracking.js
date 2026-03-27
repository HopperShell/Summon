// Package tracking module — Gmail-only approach
// Searches Gmail for shipping emails, extracts tracking numbers,
// and scrapes carrier tracking pages for status. No API keys needed.

// Common tracking number patterns for parsing from email text
const TRACKING_PATTERNS = [
  // UPS: 1Z followed by 16 alphanumeric
  { carrier: 'UPS', pattern: /\b1Z[A-Z0-9]{16}\b/gi },
  // FedEx: 12, 15, 20, or 22 digits
  { carrier: 'FedEx', pattern: /\b\d{12,22}\b/g },
  // USPS: 20-34 digits or starts with specific prefixes
  { carrier: 'USPS', pattern: /\b(?:94|93|92|95)\d{18,30}\b/g },
  { carrier: 'USPS', pattern: /\b[A-Z]{2}\d{9}US\b/gi },
  // Amazon: TBA followed by digits
  { carrier: 'Amazon', pattern: /\bTBA\d{10,}\b/gi },
  // DHL: JD followed by digits
  { carrier: 'DHL', pattern: /\bJD\d{18,}\b/gi },
];

// Tracking URL patterns found in email bodies
const TRACKING_URL_PATTERNS = [
  // Amazon progress tracker
  { carrier: 'Amazon', pattern: /https:\/\/www\.amazon\.com\/progress-tracker\/package[^\s)\]"<>]*/gi },
  // UPS tracking
  { carrier: 'UPS', pattern: /https:\/\/(?:www\.)?ups\.com\/track[^\s)\]"<>]*/gi },
  // FedEx tracking
  { carrier: 'FedEx', pattern: /https:\/\/(?:www\.)?fedex\.com\/(?:fedextrack|apps\/fedextrack)[^\s)\]"<>]*/gi },
  // USPS tracking
  { carrier: 'USPS', pattern: /https:\/\/tools\.usps\.com\/go\/Track[^\s)\]"<>]*/gi },
  // DHL tracking
  { carrier: 'DHL', pattern: /https:\/\/(?:www\.)?dhl\.com\/[^\s)\]"<>]*tracking[^\s)\]"<>]*/gi },
  // Narvar tracking (used by many retailers)
  { carrier: 'Narvar', pattern: /https:\/\/[a-z]+\.narvar\.com\/[^\s)\]"<>]*/gi },
  // Shop app / Shopify tracking
  { carrier: 'Shopify', pattern: /https:\/\/shop\.app\/[^\s)\]"<>]*/gi },
];

// Extract tracking numbers from email text
export function extractTrackingNumbers(text) {
  const found = new Map();
  for (const { carrier, pattern } of TRACKING_PATTERNS) {
    const matches = text.match(pattern) || [];
    for (const m of matches) {
      // Skip pure numeric strings shorter than 12 digits (too many false positives)
      if (/^\d+$/.test(m) && m.length < 12) continue;
      if (!found.has(m)) {
        found.set(m, carrier);
      }
    }
  }
  return Array.from(found.entries()).map(([number, carrier]) => ({ number, carrier }));
}

// Extract tracking URLs directly from email text
export function extractTrackingUrls(text) {
  const found = new Map();
  for (const { carrier, pattern } of TRACKING_URL_PATTERNS) {
    const matches = text.match(pattern) || [];
    for (const url of matches) {
      if (!found.has(url)) {
        found.set(url, carrier);
      }
    }
  }
  return Array.from(found.entries()).map(([url, carrier]) => ({ url, carrier }));
}

// Build a carrier tracking URL for the user
export function getTrackingUrl(number, carrier) {
  switch (carrier) {
    case 'UPS':
      return `https://www.ups.com/track?tracknum=${number}`;
    case 'FedEx':
      return `https://www.fedex.com/fedextrack/?trknbr=${number}`;
    case 'USPS':
      return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${number}`;
    case 'Amazon':
      return `https://www.amazon.com/progress-tracker/package/?itemId=${number}`;
    case 'DHL':
      return `https://www.dhl.com/us-en/home/tracking.html?tracking-id=${number}`;
    default:
      return `https://www.google.com/search?q=${number}+tracking`;
  }
}

// Parse shipping status from email content
// Looks for common status keywords in subject and body
export function parseStatusFromEmail(subject, body) {
  const text = `${subject} ${body}`.toLowerCase();

  if (text.includes('delivered')) return 'Delivered';
  if (text.includes('out for delivery')) return 'Out for Delivery';
  if (text.includes('available for pickup')) return 'Available for Pickup';
  if (text.includes('delivery attempt') || text.includes('delivery exception')) return 'Delivery Exception';
  if (text.includes('in transit') || text.includes('on its way') || text.includes('on the way')) return 'In Transit';
  if (text.includes('shipped') || text.includes('has shipped') || text.includes('shipment confirmed')) return 'Shipped';
  if (text.includes('label created') || text.includes('shipping label')) return 'Label Created';
  if (text.includes('preparing') || text.includes('processing')) return 'Processing';
  return 'Shipped';
}

// Detect which retailer/sender the email is from
export function detectSender(from) {
  const f = from.toLowerCase();
  if (f.includes('amazon')) return 'Amazon';
  if (f.includes('walmart')) return 'Walmart';
  if (f.includes('target')) return 'Target';
  if (f.includes('bestbuy') || f.includes('best buy')) return 'Best Buy';
  if (f.includes('ups')) return 'UPS';
  if (f.includes('fedex')) return 'FedEx';
  if (f.includes('usps')) return 'USPS';
  if (f.includes('dhl')) return 'DHL';
  if (f.includes('ebay')) return 'eBay';
  if (f.includes('etsy')) return 'Etsy';
  if (f.includes('shopify') || f.includes('shop.app')) return 'Shopify';
  if (f.includes('narvar')) return 'Narvar';
  return from.split('<')[0].trim() || from;
}
