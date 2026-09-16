import { IsBoolean, IsIn, IsOptional } from 'class-validator';

export class UpdatePreferencesDto {
  @IsOptional()
  @IsIn(['NORTH_INDIAN', 'SOUTH_INDIAN'])
  chartStyle?: 'NORTH_INDIAN' | 'SOUTH_INDIAN';

  @IsOptional()
  @IsIn(['AMANT', 'PURNIMANT'])
  monthType?: 'AMANT' | 'PURNIMANT';

  @IsOptional()
  @IsBoolean()
  darkMode?: boolean;

  @IsOptional()
  @IsBoolean()
  hideOuterPlanets?: boolean;

  @IsOptional()
  @IsBoolean()
  customCalendar?: boolean;
}
