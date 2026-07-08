import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { RegisterAstrologerDto } from './dto/register-astrologer.dto';

@Injectable()
export class AstrologerService {
  constructor(private readonly prisma: PrismaService) {}

  async register(supabaseId: string, dto: RegisterAstrologerDto) {
    const user = await this.prisma.user.findUnique({
      where: { supabaseId },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException('User account not found');
    }

    const existing = await this.prisma.astrologer.findUnique({
      where: { userId: user.id },
    });

    if (existing) {
      throw new BadRequestException('Astrologer profile already exists');
    }

    const expertiseRecords = await Promise.all(
      dto.expertise.map((name) =>
        this.prisma.expertise.upsert({
          where: { name },
          update: {},
          create: { name },
        }),
      ),
    );

    const astrologer = await this.prisma.astrologer.create({
      data: {
        userId: user.id,
        Gender: dto.gender ?? null,
        bio: dto.bio ?? null,
        languages: dto.languages,
        experience: dto.experienceYears,
        pricePerMin: dto.consultationPrice,
        isApproved: false,
        isVerified: false,
        expertise: {
          create: expertiseRecords.map((expertise) => ({
            expertiseId: expertise.id,
          })),
        },
      },
      include: {
        expertise: {
          include: {
            expertise: true,
          },
        },
      },
    });

    return {
      success: true,
      message: 'Astrologer registration submitted for admin approval',
      data: astrologer,
    };
  }
}