export class ApiError extends Error {
  constructor(message: string, readonly status = 500) {
    super(message);
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: 'include',
    headers: {'Content-Type': 'application/json', ...(init?.headers || {})}
  });
  const data = await response.json().catch(() => ({})) as {error?: string};
  if (!response.ok) throw new ApiError(data.error || 'Request failed', response.status);
  return data as T;
}

export type BrokerStatus = {
  connected: boolean;
  broker: 'dhan' | null;
  readOnly: boolean;
  clientIdMasked?: string;
  marketData?: string;
  orderPlacement?: boolean;
  source?: 'ui' | 'env';
  message?: string;
  profile?: {dataPlan?: string; tokenValidity?: string} | null;
};

export type IndexRow = {
  name: string;
  price?: number;
  changePercent?: number;
  dataStatus: string;
};

export type Funds = {
  availabelBalance?: number;
  availableBalance?: number;
  utilizedAmount?: number;
  withdrawableBalance?: number;
};

export type Holding = {
  tradingSymbol?: string;
  availableQty?: number;
  avgCostPrice?: number;
  totalQty?: number;
};

export type BrokerPosition = {
  tradingSymbol?: string;
  netQty?: number;
  buyAvg?: number;
  sellAvg?: number;
  unrealizedProfit?: number;
  positionType?: string;
};
