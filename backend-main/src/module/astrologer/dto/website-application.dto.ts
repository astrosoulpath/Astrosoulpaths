import { Equals, IsISO31661Alpha2, IsIn } from 'class-validator';
import { RegisterAstrologerDto } from './register-astrologer.dto';
/** Separate additive website contract; existing Flutter registration is unchanged. */
export class WebsiteApplicationDto extends RegisterAstrologerDto {
  @Equals(true) consentAccepted!: boolean;
  @IsISO31661Alpha2() countryCode!: string;
}
export class WebsiteKycUploadDto {
  @Equals('true') consentAccepted!: string;
  @IsISO31661Alpha2() countryCode!: string;
  @IsIn(['identity','certificate','experience']) documentType!: string;
}
