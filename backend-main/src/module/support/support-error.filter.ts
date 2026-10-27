import {ArgumentsHost,Catch,ExceptionFilter,HttpException,Logger} from '@nestjs/common';
/** Scope unknown database/provider failures to a public, non-sensitive contract. */
@Catch()
export class SupportErrorFilter implements ExceptionFilter {
 private readonly logger=new Logger(SupportErrorFilter.name);
 catch(error:unknown,host:ArgumentsHost){
  const response=host.switchToHttp().getResponse();
  if(error instanceof HttpException)return response.status(error.getStatus()).json(error.getResponse());
  const candidate=error&&typeof error==='object'&&'code' in error?error.code:undefined;
  const code=['P2002','P2025','P2010','P2028'].includes(String(candidate))?String(candidate):'UNKNOWN';
  this.logger.warn('Support operation not confirmed: '+code);
  return response.status(code==='P2002'?409:503).json({message:'Request result was not confirmed. Refresh before retrying.'});
 }
}
