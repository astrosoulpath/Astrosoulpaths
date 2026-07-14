import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Injectable()
export class ReviewService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Homepage Reviews
   */

  async getHomepageReviews() {
    /**
     * Review table implement
     */

    return {
      success: true,

      data: [
        {
          id: '1',

          customerName:
            'Astro Soul Path User',

          rating: 5,

          review:
            'Very accurate guidance and smooth consultation.',

          astrologerName:
            'Verified Astrologer',

          createdAt:
            new Date().toISOString(),
        },
      ],
    };
  }

  /**
   * Astrologer Reviews
   */

  async getAstrologerReviews(
    astrologerId: string,
  ) {
    /**
     * Future:
     * Review table complete 
     */

    return {
      success: true,

      astrologerId,

      averageRating: 0,

      totalReviews: 0,

      data: [],
    };
  }
}