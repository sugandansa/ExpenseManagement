import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const FLOW_URL = 'https://control.msg91.com/api/v5/flow';

@Injectable()
export class Msg91Service {
  private readonly logger = new Logger(Msg91Service.name);

  constructor(private readonly config: ConfigService) {}

  async sendOtp(phone: string, otp: string, name = 'User'): Promise<boolean> {
    try {
      await this.sendSms(phone, otp, name);
      return true;
    } catch (error) {
      this.logger.error(error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  async sendSms(mobile: string, otp: string, name = 'User') {
    const phone = normalizeIndianMobile(mobile);
    const recipientName = String(name || 'User').trim() || 'User';
    const otpValue = String(otp ?? '').trim();
    const otpKey = this.otpVarName();

    if (!phone || phone.length < 10) {
      throw new Error(`MSG91: mobile number missing/invalid (${mobile})`);
    }
    if (!otpValue) {
      throw new Error('MSG91: OTP value missing');
    }

    const flowId = this.templateId();
    if (!flowId) {
      throw new Error('MSG91_TEMPLATE_ID is not configured');
    }

    const mobiles = `91${phone}`;

    if (this.isMockMode()) {
      this.logger.log(
        `[Mock MSG91] OTP ${otpValue} → ${mobiles} (${otpKey}=${otpValue}, NAME=${recipientName}) flow=${flowId} sender=${this.senderId()}`,
      );
      return { type: 'success', message: 'mock', mock: true };
    }

    const recipient = {
      mobiles,
      [otpKey]: otpValue,
      OTP: otpValue,
      NAME: recipientName,
    };

    const payload = {
      template_id: flowId,
      flow_id: flowId,
      sender: this.senderId(),
      short_url: '0',
      recipients: [recipient],
    };

    const response = await fetch(FLOW_URL, {
      method: 'POST',
      headers: {
        authkey: this.authKey(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      this.logger.error(`MSG91 OTP failed: ${JSON.stringify(data)}`);
      throw new Error('MSG91 OTP failed');
    }

    this.logger.log(`MSG91 OTP sent to ${mobiles}`);
    return data;
  }

  private authKey(): string {
    return String(this.config.get('MSG91_AUTH_KEY') || '').trim();
  }

  private templateId(): string {
    return String(this.config.get('MSG91_TEMPLATE_ID') || '').trim();
  }

  private senderId(): string {
    return String(this.config.get('MSG91_SENDER_ID') || 'WHTOCN').trim();
  }

  private otpVarName(): string {
    return String(this.config.get('MSG91_OTP_VAR') || '').trim() || 'num';
  }

  private isMockMode(): boolean {
    const key = this.authKey();
    return !key || key.toLowerCase() === 'test' || key.includes('xxxx');
  }
}

export function normalizeIndianMobile(mobile: string): string {
  const digits = String(mobile || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2);
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return digits.slice(1);
  }
  return digits;
}
