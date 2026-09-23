import { IsOptional, IsString, MaxLength, Matches } from 'class-validator';

/** Verify phone OTP — client sends idToken from Firebase Auth. */
export class VerifyPhoneDto {
  /** Firebase Auth ID token (from signInWithPhoneNumber on the client). */
  @IsString()
  idToken!: string;

  /** E.164 phone (e.g. +905555555555). Used as a fallback for user lookup. */
  @Matches(/^\+\d{10,15}$/, {
    message: 'phone must be E.164 format (+<country><number>)',
  })
  phone!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  androidId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  fcmToken?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  appVersion?: string;
}

/** Verify Google Sign-In — client sends idToken from GoogleSignIn SDK. */
export class VerifyGoogleDto {
  @IsString()
  idToken!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  androidId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  fcmToken?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  appVersion?: string;
}

export class RefreshDto {
  @IsString()
  refreshToken!: string;
}

export class LogoutDto {
  @IsString()
  refreshToken!: string;
}

export class AdminLoginDto {
  @IsString()
  email!: string;

  @IsString()
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(6)
  totpCode?: string;
}
