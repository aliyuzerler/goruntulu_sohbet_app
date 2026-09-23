import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { IsString, Matches } from 'class-validator';
import { FiltersService } from './filters.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

class ActivateCountryFilterDto {
  @IsString()
  @Matches(/^[A-Z]{2}$/, { message: 'countryCode must be ISO 3166-1 alpha-2' })
  countryCode!: string;
}

/**
 * FiltersController — Phase 7 country filter activation + status.
 * Gender filter doesn't have an endpoint — it's gated by VIP status directly.
 *
 *   POST /api/filters/activate-country  — activate country filter (coin cost OR free for VIP)
 *   GET  /api/filters/active            — current active filters
 */
@Controller('filters')
@UseGuards(JwtAuthGuard)
export class FiltersController {
  constructor(private readonly filters: FiltersService) {}

  @Post('activate-country')
  async activateCountry(
    @Body() dto: ActivateCountryFilterDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.filters.activateCountryFilter({
      userId: user.id,
      countryCode: dto.countryCode,
    });
  }

  @Get('active')
  async active(@CurrentUser() user: { id: string }) {
    return this.filters.getActiveFilters(user.id);
  }
}
