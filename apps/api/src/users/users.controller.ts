import { Body, Controller, Delete, Get, HttpCode, Patch, Post, UseGuards } from '@nestjs/common';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @Min(3, { message: 'Nickname too short' })
  @MaxLength(40, { message: 'Nickname too long' })
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  avatarUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  @IsOptional()
  @IsIn(['MALE', 'FEMALE', 'OTHER', 'UNSPECIFIED'])
  gender?: 'MALE' | 'FEMALE' | 'OTHER' | 'UNSPECIFIED';

  @IsOptional()
  @Matches(/^[A-Z]{2}$/)
  country?: string;

  @IsOptional()
  @IsInt()
  @Min(1900)
  @Max(new Date().getFullYear())
  birthYear?: number;
}

class DeleteAccountDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

/**
 * UsersController — /api/me + /api/me/delete
 * All routes require JWT auth.
 */
@Controller('me')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  me(@CurrentUser() user: { id: string }) {
    return this.users.getMe(user.id);
  }

  @Patch()
  async updateProfile(
    @Body() dto: UpdateProfileDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.users.updateProfile(user.id, {
      displayName: dto.displayName,
      avatarUrl: dto.avatarUrl ?? undefined,
      bio: dto.bio,
      gender: dto.gender as never,
      country: dto.country,
      birthYear: dto.birthYear,
    });
  }

  @Post('delete')
  requestDeletion(
    @Body() dto: DeleteAccountDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.users.requestDeletion(user.id, dto.reason);
  }

  @Post('delete/cancel')
  cancelDeletion(@CurrentUser() user: { id: string }) {
    return this.users.cancelDeletion(user.id);
  }
}
