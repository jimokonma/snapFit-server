import { Injectable, Logger } from '@nestjs/common';

export interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: 'default' | null;
  badge?: number;
}

@Injectable()
export class PushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);
  private readonly EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

  async sendToToken(token: string, title: string, body: string, data?: Record<string, any>): Promise<boolean> {
    if (!token || !token.startsWith('ExponentPushToken[')) {
      this.logger.warn(`Invalid push token: ${token}`);
      return false;
    }

    return this.send([{ to: token, title, body, data, sound: 'default' }]);
  }

  async sendToTokens(tokens: string[], title: string, body: string, data?: Record<string, any>): Promise<number> {
    const validTokens = tokens.filter((t) => t && t.startsWith('ExponentPushToken['));
    if (!validTokens.length) return 0;

    const messages: PushMessage[] = validTokens.map((to) => ({
      to,
      title,
      body,
      data,
      sound: 'default',
    }));

    // Expo limit: 100 messages per request
    const chunks = this.chunk(messages, 100);
    let successCount = 0;

    for (const chunk of chunks) {
      const success = await this.send(chunk);
      if (success) successCount += chunk.length;
    }

    return successCount;
  }

  private async send(messages: PushMessage[]): Promise<boolean> {
    try {
      const response = await fetch(this.EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
      });

      if (!response.ok) {
        this.logger.error(`Expo push failed: ${response.status} ${await response.text()}`);
        return false;
      }

      const result: any = await response.json();
      const hasErrors = result.data?.some((r: any) => r.status === 'error');

      if (hasErrors) {
        result.data
          .filter((r: any) => r.status === 'error')
          .forEach((r: any) => this.logger.warn(`Push error: ${r.message}`));
      }

      return !hasErrors;
    } catch (err) {
      this.logger.error(`Push notification error: ${err.message}`);
      return false;
    }
  }

  private chunk<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  }
}
