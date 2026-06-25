const explicitUrlPattern = /(?:https?:\/\/|www\.)[^\s<>"')]+/i;
const bareDomainPattern =
  /(^|[^\w@])((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}(?:\/[^\s<>"')]+)?)/i;

export const containsLink = (text = "") =>
  explicitUrlPattern.test(text) || bareDomainPattern.test(text);
