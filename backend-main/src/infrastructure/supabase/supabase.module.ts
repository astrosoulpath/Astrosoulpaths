import { Global, Module } from '@nestjs/common';
import { SupabaseService } from './supabase.service';
import { SupabaseJwtService } from './supabase-jwt.service';
import { CommunicationAuthService } from './communication-auth.service';

@Global()
@Module({
  providers: [SupabaseService, SupabaseJwtService, CommunicationAuthService],
  exports: [SupabaseService, SupabaseJwtService, CommunicationAuthService],
})
export class SupabaseModule {}
