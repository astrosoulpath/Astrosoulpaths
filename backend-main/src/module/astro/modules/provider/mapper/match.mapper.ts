import { MatchParams } from '../../../../../common/types/match-params.type';

export class MatchMapper {
  static toApiFormat(params: MatchParams) {
    const { boy, girl } = params;

    return {
      boy_dob: this.formatDate(boy.dob),
      boy_tob: boy.tob.slice(0, 5),
      boy_lat: boy.lat,
      boy_lon: boy.lon,
      boy_tz: boy.timezone,

      girl_dob: this.formatDate(girl.dob),
      girl_tob: girl.tob.slice(0, 5),
      girl_lat: girl.lat,
      girl_lon: girl.lon,
      girl_tz: girl.timezone,

      lang: params.lang || 'en',
    };
  }

  private static formatDate(dob: string) {
    const [year, month, day] = dob.split('-');
    return `${day}/${month}/${year}`;
  }
}
