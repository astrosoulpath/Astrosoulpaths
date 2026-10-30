import {Equals,IsInt,IsObject,IsUUID,Min,IsISO31661Alpha2} from 'class-validator';
export class ApplicationCorrectionsDto {
  @IsUUID('4') requestId!:string;
  @IsInt() @Min(0) expectedVersion!:number;
  @IsObject() updates!:Record<string,unknown>;
  @Equals(true) consentAccepted!:boolean;
  @IsISO31661Alpha2() countryCode!:string;
}
