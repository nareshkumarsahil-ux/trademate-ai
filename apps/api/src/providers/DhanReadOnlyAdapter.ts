import type {BrokerAdapter} from './BrokerAdapter.js';
import {asArray, dhanGet} from './dhanHttp.js';

/**
 * DhanHQ v2 read-only adapter.
 * Deliberately exposes only GET account-information calls. There are no methods
 * for placing, modifying, cancelling, converting or exiting orders/positions.
 */
export class DhanReadOnlyAdapter implements BrokerAdapter {
  constructor(private readonly accessToken: string, private readonly clientId: string) {
    if (!accessToken) throw new Error('DHAN_ACCESS_TOKEN is not configured');
    if (!clientId) throw new Error('DHAN_CLIENT_ID is not configured');
  }

  async authenticate() {
    await this.getProfile();
  }

  getProfile() {
    return dhanGet('/profile', this.accessToken, this.clientId);
  }

  getFunds() {
    return dhanGet('/fundlimit', this.accessToken, this.clientId);
  }

  async getHoldings() {
    return asArray(await dhanGet('/holdings', this.accessToken, this.clientId));
  }

  async getPositions() {
    return asArray(await dhanGet('/positions', this.accessToken, this.clientId));
  }

  async getOrders() {
    return asArray(await dhanGet('/orders', this.accessToken, this.clientId));
  }
}
