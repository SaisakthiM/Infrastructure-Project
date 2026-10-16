/**
 * Mini City Shared Economy & Safe Mode SDK
 * 
 * Provides unified cross-district financial transactions:
 * - Direct Bank communication when online
 * - Safe Mode offline ledgering (read-after-write local storage)
 * - Conflict prevention via idempotency keys
 * - PostMessage dispatching to the 3D Mini City parent frame
 */

export interface TransactionEvent {
  eventId: string;
  type: 'earn' | 'spend';
  service: string;
  amount: number;
  description: string;
  timestamp: number;
  synced: boolean;
}

const LEDGER_KEY = 'mini_city_safe_mode_ledger';
const BAL_KEY = 'mini_city_cached_balance';
const ACTIVE_SERVICE_KEY = 'mini_city_safe_mode_active_service';

export class CityBankLedger {
  private static generateId(): string {
    return 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  public static getCachedBalance(): number {
    const val = localStorage.getItem(BAL_KEY);
    return val ? parseFloat(val) : 1000;
  }

  public static setCachedBalance(bal: number): void {
    localStorage.setItem(BAL_KEY, bal.toString());
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'city:balance', balance: bal }, '*');
    }
  }

  public static getPendingLedger(): TransactionEvent[] {
    try {
      const data = localStorage.getItem(LEDGER_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  public static recordSafeModeEvent(
    type: 'earn' | 'spend',
    service: string,
    amount: number,
    description: string
  ): { success: boolean; message: string; balance: number } {
    const currentBal = this.getCachedBalance();

    if (type === 'spend') {
      // In Safe Mode, users can only spend on ONE designated service at a time to prevent state conflicts
      const activeService = localStorage.getItem(ACTIVE_SERVICE_KEY);
      if (activeService && activeService !== service) {
        return {
          success: false,
          message: `Safe Mode Active: You can only spend on ${activeService} until the bank re-syncs.`,
          balance: currentBal
        };
      }
      if (!activeService) {
        localStorage.setItem(ACTIVE_SERVICE_KEY, service);
      }

      if (currentBal < amount) {
        return {
          success: false,
          message: 'Insufficient balance in Safe Mode.',
          balance: currentBal
        };
      }

      const newBal = currentBal - amount;
      this.setCachedBalance(newBal);

      const event: TransactionEvent = {
        eventId: this.generateId(),
        type: 'spend',
        service,
        amount,
        description,
        timestamp: Date.now(),
        synced: false
      };

      const ledger = this.getPendingLedger();
      ledger.push(event);
      localStorage.setItem(LEDGER_KEY, JSON.stringify(ledger));

      return {
        success: true,
        message: 'Transaction recorded in Safe Mode.',
        balance: newBal
      };
    } else {
      // Earn events in Safe Mode go to the read-after-write offline queue
      // As stated in design: "earned money is not updated in the balance during safe mode"
      const event: TransactionEvent = {
        eventId: this.generateId(),
        type: 'earn',
        service,
        amount,
        description,
        timestamp: Date.now(),
        synced: false
      };

      const ledger = this.getPendingLedger();
      ledger.push(event);
      localStorage.setItem(LEDGER_KEY, JSON.stringify(ledger));

      return {
        success: true,
        message: 'Earnings queued in Safe Mode ledger. Will credit once bank is online.',
        balance: currentBal
      };
    }
  }

  /**
   * Replays pending ledger events to the Bank when bank is back online
   */
  public static async syncLedgerToBank(bankSyncEndpoint: string): Promise<number> {
    const ledger = this.getPendingLedger();
    const unsynced = ledger.filter(e => !e.synced);
    if (unsynced.length === 0) return 0;

    let syncedCount = 0;
    for (const evt of unsynced) {
      try {
        const res = await fetch(bankSyncEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(evt)
        });
        if (res.ok) {
          evt.synced = true;
          syncedCount++;
        }
      } catch (err) {
        console.error('Failed to sync event to bank:', evt.eventId, err);
        break; // Bank might still be unstable
      }
    }

    localStorage.setItem(LEDGER_KEY, JSON.stringify(ledger.filter(e => !e.synced)));
    if (syncedCount > 0) {
      localStorage.removeItem(ACTIVE_SERVICE_KEY);
    }
    return syncedCount;
  }
}
