import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { InvoiceStatus } from '@mirsonix/shared';
import { Repository } from 'typeorm';
import { Invoice } from './entities/invoice.entity';

export interface InvoiceUpsert {
  userId: string;
  subscriptionId: string | null;
  stripeInvoiceId: string;
  status: InvoiceStatus;
  amountPaidMinor: number;
  currency: string;
  paidAt: Date | null;
}

@Injectable()
export class InvoicesRepository {
  constructor(@InjectRepository(Invoice) private readonly invoices: Repository<Invoice>) {}

  /** The refunded amount is deliberately not part of the update, so re-delivering an invoice never erases a refund. */
  async upsertFromStripe(data: InvoiceUpsert): Promise<void> {
    await this.invoices.upsert(data, ['stripeInvoiceId']);
  }

  /** Returns false when no such invoice has been recorded (yet). */
  async setRefunded(stripeInvoiceId: string, amountRefundedMinor: number): Promise<boolean> {
    const result = await this.invoices.update({ stripeInvoiceId }, { amountRefundedMinor });
    return (result.affected ?? 0) > 0;
  }
}
