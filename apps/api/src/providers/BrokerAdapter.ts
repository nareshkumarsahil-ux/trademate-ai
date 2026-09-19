/** Read-only by design. Order mutation methods intentionally do not exist. */
export interface BrokerAdapter{authenticate():Promise<void>;getProfile():Promise<unknown>;getFunds():Promise<unknown>;getHoldings():Promise<unknown[]>;getPositions():Promise<unknown[]>;getOrders():Promise<unknown[]>}
