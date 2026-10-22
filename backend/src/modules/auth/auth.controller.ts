import { Body, Controller, Get, Ip, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  AuthenticatedUser,
  CurrentUser,
  Public,
} from '../../common/decorators/auth.decorators';
import { AuthService } from './auth.service';
import {
  ForgotPasswordDto,
  LoginDto,
  RefreshTokenDto,
  RegisterDto,
  ResetPasswordDto,
  SocialLoginDto,
  VerifyEmailDto,
} from './dto/auth.dto';

@ApiTags('Autenticación y Seguridad')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Registrar nuevo usuario con política de contraseña fuerte' })
  register(@Body() dto: RegisterDto, @Ip() ip: string) {
    return this.authService.register(dto, ip);
  }

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Iniciar sesión con email y contraseña (emite JWT + Refresh rotativo)' })
  login(@Body() dto: LoginDto, @Ip() ip: string) {
    return this.authService.login(dto, ip);
  }

  @Public()
  @Post('social')
  @ApiOperation({
    summary:
      'Inicio de sesión social (Google, Facebook, GitHub) con vinculación automática por email',
  })
  socialLogin(@Body() dto: SocialLoginDto, @Ip() ip: string) {
    return this.authService.socialLogin(dto, ip);
  }

  @Public()
  @Post('refresh')
  @ApiOperation({
    summary: 'Rotar Refresh Token y obtener nuevo par Access/Refresh con detección de reuso',
  })
  refresh(@Body() dto: RefreshTokenDto, @Ip() ip: string) {
    return this.authService.refreshTokens(dto, ip);
  }

  @ApiBearerAuth('jwt-auth')
  @Post('logout')
  @ApiOperation({ summary: 'Cerrar sesión y revocar refresh tokens activos' })
  logout(@CurrentUser() user: AuthenticatedUser, @Ip() ip: string) {
    return this.authService.logout(user.sub, ip);
  }

  @ApiBearerAuth('jwt-auth')
  @Get('me')
  @ApiOperation({ summary: 'Obtener perfil y permisos del usuario autenticado' })
  me(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }

  @Public()
  @Post('verify-email')
  @ApiOperation({ summary: 'Verificar correo electrónico mediante token' })
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto);
  }

  @Public()
  @Post('forgot-password')
  @ApiOperation({ summary: 'Solicitar recuperación de contraseña por email' })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Public()
  @Post('reset-password')
  @ApiOperation({ summary: 'Restablecer contraseña con token de recuperación' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }
}
