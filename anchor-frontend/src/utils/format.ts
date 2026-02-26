export function formatNumber(value: number, decimals: number = 2): string {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(decimals)}B`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(decimals)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(decimals)}K`;
  }
  return value.toFixed(decimals);
}

export function formatUsd(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 1_000) {
    return `$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  }
  if (value < 0.01) {
    return `$${value.toFixed(6)}`;
  }
  return `$${value.toFixed(2)}`;
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function formatAddress(address: string, start: number = 6, end: number = 4): string {
  if (address.length <= start + end + 3) return address;
  return `${address.slice(0, start)}...${address.slice(-end)}`;
}

export function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function formatBlocks(blocks: number): string {
  const minutes = blocks * 10;
  if (minutes < 60) return `~${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours < 24) {
    return remainingMinutes > 0 ? `~${hours}h ${remainingMinutes}m` : `~${hours}h`;
  }
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours > 0 ? `~${days}d ${remainingHours}h` : `~${days}d`;
}
