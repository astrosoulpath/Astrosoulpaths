import {
  Controller,
  Get,
  Header,
  Param,
} from '@nestjs/common';

import { ReviewService } from './review.service';

@Controller('review')
export class ReviewController {
  constructor(
    private readonly reviewService: ReviewService,
  ) {}

  /**
   * Homepage Reviews
   */

  @Get('public')
  @Header(
    'Cache-Control',
    'public,max-age=60',
  )
  getHomepageReviews() {
    return this.reviewService.getHomepageReviews();
  }

  /**
   * Astrologer Reviews
   */

  @Get('astrologer/:id')
  @Header(
    'Cache-Control',
    'public,max-age=60',
  )
  getAstrologerReviews(
    @Param('id') id: string,
  ) {
    return this.reviewService.getAstrologerReviews(
      id,
    );
  }
}