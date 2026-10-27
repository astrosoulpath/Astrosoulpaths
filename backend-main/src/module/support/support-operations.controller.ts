import {UseFilters} from '@nestjs/common';
import {SupportErrorFilter} from './support-error.filter';
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { Roles, Role } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  resolveSupportActor,
  supportLock,
  supportPage,
  supportText,
} from './support-policy';
import {
  auditSupport,
  requireSupportOperations,
  supportOperationsEnabled,
} from './support-operations';
export class PrivateSupportNoteDto {
  @IsString() @MinLength(1) @MaxLength(5000) content!: string;
}
@UseFilters(SupportErrorFilter)
@Controller('admin/support/tickets')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles(Role.Admin)
export class SupportOperationsController {
  constructor(private readonly db: PrismaService) {}
  @Get(':id/operations')
  async history(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Query('page') page?: string,
  ) {
    await resolveSupportActor(this.db, user, true);
    if (!supportOperationsEnabled())
      return { success: true, enabled: false, notes: [], audit: [] };
    const paging = supportPage({
      page: page === undefined ? 1 : Number(page),
      limit: 25,
    });
    const notes = await this.db
      .$queryRaw`SELECT "id","authorId","content","createdAt" FROM public."SupportPrivateNote" WHERE "ticketId"=${id} ORDER BY "createdAt" DESC,"id" LIMIT 25 OFFSET ${(paging.page - 1) * 25}`;
    const audit = await this.db
      .$queryRaw`SELECT "id","actorId","action","details","createdAt" FROM public."SupportOperationAudit" WHERE "objectType"='TICKET' AND "objectId"=${id} ORDER BY "createdAt" DESC,"id" LIMIT 25 OFFSET ${(paging.page - 1) * 25}`;
    return { success: true, enabled: true, notes, audit };
  }
  @Post(':id/notes')
  async note(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: PrivateSupportNoteDto,
  ) {
    requireSupportOperations();
    const actor = await resolveSupportActor(this.db, user, true);
    const content = supportText(dto.content, 5000);
    return this.db.$transaction(async (tx) => {
      await supportLock(tx, 'ticket:' + id);
      await tx.supportTicket.findUniqueOrThrow({ where: { id } });
      const noteId = randomUUID();
      await tx.$executeRaw`INSERT INTO public."SupportPrivateNote" ("id","ticketId","authorId","content") VALUES (${noteId},${id},${actor.id},${content})`;
      await auditSupport(tx, actor.id, 'TICKET', id, 'PRIVATE_NOTE_ADDED', {
        noteId,
      });
      return { success: true, id: noteId };
    });
  }
}
