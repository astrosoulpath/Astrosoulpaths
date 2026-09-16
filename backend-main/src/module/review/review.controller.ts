import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReviewService } from './review.service';

@Controller('review')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  /**
   * Homepage Reviews
   */
  @Get('public')
  @Header('Cache-Control', 'public,max-age=60')
  getHomepageReviews() {
    return this.reviewService.getHomepageReviews();
  }

  /**
   * Astrologer Reviews
   */
  @Get('astrologer/:id')
  @Header('Cache-Control', 'public,max-age=60')
  getAstrologerReviews(@Param('id') id: string) {
    return this.reviewService.getAstrologerReviews(id);
  }

  /**
   * Customer submits one review for one completed consultation.
   *
   * Security:
   * - authenticated request only
   * - customer identity never accepted from request body
   * - call session must belong to authenticated customer
   * - call must be ended
   * - one review per callSessionId
   */
  @Post()
  @UseGuards(SupabaseAuthGuard)
  createReview(
    @Req() req: any,
    @Body() body: CreateReviewDto,
  ) {
    const authenticatedUserId =
      req?.user?.id ??
      req?.user?.userId ??
      req?.user?.sub;

    return this.reviewService.createReview(
      authenticatedUserId,
      body,
    );
  }
}
