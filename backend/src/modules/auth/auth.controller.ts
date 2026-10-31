import { Body, Controller, Get, Ip, Param, Post, Query, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
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
  VerifyOtpCodeDto,
  VerifyRegistrationCodeDto,
} from './dto/auth.dto';

@ApiTags('Autenticación y Seguridad')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private resolvePublicBase(req: Request): string {
    const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
    const host = (req.headers['x-forwarded-host'] as string) || req.get('host') || 'localhost:3000';
    return `${proto.split(',')[0].trim()}://${host.split(',')[0].trim()}`.replace(/\/+$/, '');
  }

  @Public()
  @Post('register')
  @ApiOperation({
    summary:
      'Iniciar registro de Agencia y enviar código de verificación de 6 dígitos vía n8n desde lucasegura2007@gmail.com',
  })
  register(@Body() dto: RegisterDto, @Ip() ip: string) {
    return this.authService.register(dto, ip);
  }

  @Public()
  @Post('verify-registration')
  @ApiOperation({
    summary: 'Verificar código de 6 dígitos enviado al correo al crear cuenta y abrir sesión',
  })
  verifyRegistration(@Body() dto: VerifyRegistrationCodeDto, @Ip() ip: string) {
    return this.authService.verifyRegistrationCode(dto, ip);
  }

  @Public()
  @Post('login')
  @ApiOperation({
    summary:
      'Iniciar sesión con email y contraseña (o enviar código de 6 dígitos si la cuenta fue creada con Google sin contraseña)',
  })
  login(@Body() dto: LoginDto, @Ip() ip: string) {
    return this.authService.login(dto, ip);
  }

  @Public()
  @Post('social')
  @ApiOperation({
    summary: 'Inicio de sesión social (Google, Facebook, GitHub) con Nombre, Apellido y Agencia',
  })
  socialLogin(@Body() dto: SocialLoginDto, @Ip() ip: string) {
    return this.authService.socialLogin(dto, ip);
  }

  @Public()
  @Get('social/config')
  @ApiOperation({
    summary: 'Identificadores públicos de apps para iniciar sesión con Google, Facebook y GitHub',
  })
  socialConfig() {
    return this.authService.getSocialPublicConfig();
  }

  @Public()
  @Get('oauth/:provider')
  @ApiOperation({
    summary: 'Redirigir al flujo OAuth 2.0 de Facebook o GitHub',
  })
  oauthRedirect(
    @Param('provider') provider: string,
    @Query('firstName') firstName: string | undefined,
    @Query('lastName') lastName: string | undefined,
    @Query('agencyName') agencyName: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const publicBase = this.resolvePublicBase(req);
    try {
      const url = this.authService.getOAuthAuthorizeUrl(
        provider,
        { firstName, lastName, agencyName },
        publicBase,
      );
      return res.redirect(url);
    } catch (err: any) {
      const msg = encodeURIComponent(err.message || 'No se pudo iniciar el acceso social.');
      return res.redirect(`${publicBase}/?social_error=${msg}`);
    }
  }

  @Public()
  @Get('oauth/:provider/callback')
  @ApiOperation({
    summary: 'Callback OAuth 2.0 de Facebook y GitHub',
  })
  async oauthCallback(
    @Param('provider') provider: string,
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') oauthError: string | undefined,
    @Ip() ip: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const publicBase = this.resolvePublicBase(req);
    if (oauthError || !code) {
      const msg = encodeURIComponent('Se canceló o no se pudo autorizar el acceso social.');
      return res.redirect(`${publicBase}/?social_error=${msg}`);
    }

    try {
      const tokens = await this.authService.handleOAuthCallback(
        provider,
        code,
        state,
        ip,
        publicBase,
      );
      const encodedSession = Buffer.from(JSON.stringify(tokens), 'utf8').toString('base64url');
      return res.redirect(`${publicBase}/?social_session=${encodeURIComponent(encodedSession)}`);
    } catch (err: any) {
      const msg = encodeURIComponent(
        err.message || 'No pudimos completar el inicio de sesión social.',
      );
      return res.redirect(`${publicBase}/?social_error=${msg}`);
    }
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
  @ApiOperation({
    summary: 'Solicitar código de 6 dígitos por email (recuperar o crear contraseña de Google)',
  })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Public()
  @Post('verify-otp')
  @ApiOperation({
    summary:
      'Comprobar identidad con código de 6 dígitos antes de habilitar el campo para guardar la contraseña',
  })
  verifyOtp(@Body() dto: VerifyOtpCodeDto) {
    return this.authService.verifyOtpCode(dto);
  }

  @Public()
  @Post('reset-password')
  @ApiOperation({ summary: 'Guardar nueva contraseña tras verificar el código de 6 dígitos' })
  resetPassword(@Body() dto: ResetPasswordDto, @Ip() ip: string) {
    return this.authService.resetPassword(dto, ip);
  }
}
