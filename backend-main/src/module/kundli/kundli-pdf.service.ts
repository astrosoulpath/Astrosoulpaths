import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class KundliPdfService {
  private readonly logger = new Logger(KundliPdfService.name);

  async triggerGeneration(input: {
    kundliOrderId: string;
    kundliId?: string;
    lang?: string;
  }) {
    // Placeholder hook for future PDF generation or queue integration.
    this.logger.log(
      `kundli_pdf.triggered kundliOrderId=${input.kundliOrderId} kundliId=${input.kundliId ?? 'unknown'} lang=${input.lang ?? 'default'}`,
    );
  }
}
