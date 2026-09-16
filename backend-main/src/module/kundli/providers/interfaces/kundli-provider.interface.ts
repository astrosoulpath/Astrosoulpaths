import { AstroParams } from '../../../../common/types/astro-params.type';
import { KundliReport } from '../../types/kundli-report.type';

export interface IKundliProvider {
  generate(params: AstroParams, lang?: string): Promise<KundliReport>;
}
