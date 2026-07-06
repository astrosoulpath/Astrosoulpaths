import { Global, Module } from '@nestjs/common';
import { SupabaseService } from './supabase.service';
import { SupabaseJwtService } from './supabase-jwt.service';

@Global()
@Module({
  providers: [SupabaseService, SupabaseJwtService],
  exports: [SupabaseService, SupabaseJwtService],
})
export class SupabaseModule {}
