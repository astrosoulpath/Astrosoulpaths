import {BadRequestException} from '@nestjs/common';
export function profileImageMime(file:{buffer:Buffer;size:number;mimetype?:string;originalname?:string}){
 if(!Buffer.isBuffer(file.buffer)||file.size!==file.buffer.length||file.size<=0||file.size>5*1024*1024)throw new BadRequestException('Profile image must be a non-empty image of 5 MB or smaller');
 const bytes=file.buffer;
 const detected=bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255?'image/jpeg':bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'image/png':bytes.length>=12&&bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP'?'image/webp':null;
 const mime=file.mimetype?.toLowerCase().replace('image/jpg','image/jpeg');
 if(!detected||(mime&&mime!=='application/octet-stream'&&mime!==detected))throw new BadRequestException('Choose a valid JPEG, PNG or WebP image matching its content type');
 return detected;
}
