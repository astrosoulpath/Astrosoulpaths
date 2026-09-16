import { AstroParams } from '../../../../common/types/astro-params.type';


export interface AstrologyProvider {

  getBirthChart(
    params: AstroParams
  ): Promise<any>;


  getNavamsaChart(
    params: AstroParams
  ): Promise<any>;


  getPlanetPositions(
    params: AstroParams
  ): Promise<any>;


  getDasha(
    params: AstroParams
  ): Promise<any>;

}