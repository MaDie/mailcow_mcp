import { APIClient } from '../client';
import { MailcowQueueItem, ListQueueParams, APIAction } from '../../types';
import { buildQueueEndpoint } from '../endpoints';
import { asObjectList, mailcowDeleteItems, mailcowEditBody } from '../mailcow-response';

export class QueuesAPI {
  constructor(private client: APIClient) {}

  async listQueueItems(params?: ListQueueParams): Promise<MailcowQueueItem[]> {
    void params;
    return asObjectList<MailcowQueueItem>(
      await this.client.get<unknown>(buildQueueEndpoint(APIAction.LIST))
    );
  }

  async flushQueue(): Promise<void> {
    await this.client.post<void>(buildQueueEndpoint(APIAction.FLUSH), {});
  }

  async deleteQueueItems(itemIds: string[]): Promise<void> {
    await this.client.post<void>(
      buildQueueEndpoint(APIAction.DELETE),
      mailcowDeleteItems(itemIds)
    );
  }

  async getQueueItemDetails(itemId: string): Promise<MailcowQueueItem> {
    const items = asObjectList<MailcowQueueItem>(
      await this.client.get<unknown>(buildQueueEndpoint(APIAction.GET))
    );
    const item = items.find(
      (i) => i.id === itemId || String((i as { queue_id?: string }).queue_id) === itemId
    );
    if (!item) {
      throw new Error(`Queue item not found: ${itemId}`);
    }
    return item;
  }

  async retryQueueItem(itemId: string): Promise<void> {
    // This would typically be handled by the queue system
    // For now, we'll delete and potentially recreate the item
    await this.deleteQueueItems([itemId]);
  }

  async holdQueueItem(itemId: string): Promise<void> {
    await this.client.post<void>(
      buildQueueEndpoint(APIAction.HOLD),
      mailcowEditBody([itemId], { action: 'hold' })
    );
  }

  async releaseQueueItem(itemId: string): Promise<void> {
    // Mailcow action is `unhold`. Edit JSON unwraps only items + attr.
    await this.client.post<void>(
      buildQueueEndpoint(APIAction.RELEASE),
      mailcowEditBody([itemId], { action: 'unhold' })
    );
  }
} 