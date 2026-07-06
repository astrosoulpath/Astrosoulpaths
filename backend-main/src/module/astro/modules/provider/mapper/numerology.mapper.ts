import { NumerologyParams } from '../../../../../common/types/numerology-params.type';

export class NumerologyMapper {
  static toApiFormat(params: NumerologyParams) {
    return {
      name: params.fullName,
      dob: this.formatDate(params.dob), // ⭐ convert here
      lang: params.lang,
    };
  }

  private static formatDate(dob: string) {
    const [year, month, day] = dob.split('-');
    return `${day}/${month}/${year}`; // DD/MM/YYYY
  }
}
