import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Injectable()
export class AstrologyQuestionsService {
  constructor(private readonly prisma: PrismaService) {}

  async getCategories() {
    const categories = await this.prisma.astrologyQuestionCategory.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        sortOrder: 'asc',
      },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        icon: true,
        sortOrder: true,
        _count: {
          select: {
            questions: {
              where: {
                isActive: true,
              },
            },
          },
        },
      },
    });

    return {
      success: true,
      data: categories.map((category) => ({
        id: category.id,
        slug: category.slug,
        name: category.name,
        description: category.description,
        icon: category.icon,
        sortOrder: category.sortOrder,
        questionCount: category._count.questions,
      })),
    };
  }

  async getQuestionsByCategory(slug: string) {
    const category = await this.prisma.astrologyQuestionCategory.findUnique({
      where: {
        slug,
      },
    });

    if (!category || !category.isActive) {
      throw new NotFoundException('Astrology question category not found.');
    }

    const questions = await this.prisma.astrologyQuestion.findMany({
      where: {
        categoryId: category.id,
        isActive: true,
      },
      orderBy: {
        sortOrder: 'asc',
      },
      select: {
        id: true,
        text: true,
        description: true,
        sortOrder: true,
      },
    });

    return {
      success: true,
      data: {
        category: {
          id: category.id,
          slug: category.slug,
          name: category.name,
          description: category.description,
          icon: category.icon,
        },
        questions,
      },
    };
  }
}
