import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { SupabaseModule } from '../../infrastructure/supabase/supabase.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [SupabaseModule, UserModule],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
