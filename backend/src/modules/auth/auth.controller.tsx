/**
 * Rutas HTTP de autenticación (/api/v1/auth/...). Reciben la petición y delegan la lógica en AuthService.
 * Las marcadas con @AuthThrottle() tienen el límite de peticiones estricto, porque validan credenciales o envían correos.
 */
import { Body, Controller, Get, Ip, Param, Patch, Post, Query, Req, Res, UnauthorizedException, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthThrottle } from '../../common/decorators/auth-throttle.decorator';
import { AuthenticatedUser, CurrentUser, Public } from '../../common/decorators/auth.decorators';
import {
  clearRefreshCookie,
  REFRESH_COOKIE,
  RefreshCookieInterceptor,
  setRefreshCookie,
} from '../../common/interceptors/refresh-cookie.interceptor';
import { OAUTH_NONCE_COOKIE, OAuthStateService } from '../../common/utils/oauth-state.service';
import { AppConfigService } from '../../config/app-config.service';
import { AccountDeletionService } from './account-deletion.service';
import { AuthService } from './auth.service';
import {
  ChangePasswordDto,
  DeleteAccountDto,
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
  SocialLoginDto,
  UpdateProfileDto,
  CompleteProfileDto,
  VerifyOtpCodeDto,
  VerifyRegistrationCodeDto,
} from './dto/auth.dto';

/** RefreshCookieInterceptor mueve el refresh token de las respuestas a una cookie httpOnly. */
@ApiTags('Autenticación y Seguridad')
@Controller('auth')
@UseInterceptors(RefreshCookieInterceptor)
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly accountDeletion: AccountDeletionService,
    private readonly oauthState: OAuthStateService,
    private readonly config: AppConfigService,
  ) {}

  /** `req.protocol` respeta `trust proxy`; en producción manda PUBLIC_APP_URL (ver AppConfigService). */
  private requestBase(req: Request): string | undefined {
    const host = req.get('host');
    return host ? `${req.protocol}://${host}` : undefined;
  }

  /** Paso 1 del registro de una agencia: crea la cuenta sin verificar y envía el código. */
  @Public()
  @AuthThrottle()
  @Post('register')
  @ApiOperation({ summary: 'Iniciar registro de Agencia y enviar código de verificación de 6 dígitos' })
  register(@Body() dto: RegisterDto, @Ip() ip: string) {
    return this.authService.register(dto, ip);
  }

  /** Paso 2 del registro: valida el código y abre la sesión. */
  @Public()
  @AuthThrottle()
  @Post('verify-registration')
  @ApiOperation({ summary: 'Verificar código de 6 dígitos enviado al correo al crear cuenta y abrir sesión' })
  verifyRegistration(@Body() dto: VerifyRegistrationCodeDto, @Ip() ip: string) {
    return this.authService.verifyRegistrationCode(dto, ip);
  }

  /** Inicio de sesión. Puede responder con tokens o pedir verificar el correo o crear una contraseña. */
  @Public()
  @AuthThrottle()
  @Post('login')
  @ApiOperation({
    summary: 'Iniciar sesión con email y contraseña (o enviar código de 6 dígitos si la cuenta aún no tiene contraseña)',
  })
  login(@Body() dto: LoginDto, @Ip() ip: string) {
    return this.authService.login(dto, ip);
  }

  /** Acceso con un token ya emitido por el proveedor (Google desde la web o la app Android). */
  @Public()
  @AuthThrottle()
  @Post('social')
  @ApiOperation({ summary: 'Inicio de sesión social (Google, Facebook, GitHub) con Nombre, Apellido y Agencia' })
  socialLogin(@Body() dto: SocialLoginDto, @Ip() ip: string) {
    return this.authService.socialLogin(dto, ip);
  }

  /** Identificadores públicos que la web necesita para mostrar los botones de acceso social. */
  @Public()
  @Get('social/config')
  @ApiOperation({ summary: 'Identificadores públicos de apps para iniciar sesión con Google, Facebook y GitHub' })
  socialConfig() {
    return this.authService.getSocialPublicConfig();
  }

  /** Inicia el acceso con Facebook o GitHub: guarda el nonce en una cookie y redirige al proveedor. */
  @Public()
  @AuthThrottle()
  @Get('oauth/:provider')
  @ApiOperation({ summary: 'Redirigir al flujo OAuth 2.0 de Facebook o GitHub' })
  oauthRedirect(
    @Param('provider') provider: string,
    @Query('firstName') firstName: string | undefined,
    @Query('lastName') lastName: string | undefined,
    @Query('agencyName') agencyName: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const base = this.config.publicBaseUrl(this.requestBase(req));
    try {
      const nonce = this.oauthState.newNonce();
      const url = this.authService.getOAuthAuthorizeUrl(
        provider,
        { firstName, lastName, agencyName },
        this.requestBase(req),
        nonce,
      );
      res.cookie(OAUTH_NONCE_COOKIE, nonce, {
        httpOnly: true,
        sameSite: 'lax',
        secure: base.startsWith('https://'),
        maxAge: this.oauthState.ttlSeconds * 1000,
        path: '/',
      });
      return res.redirect(url);
    } catch (err: any) {
      const msg = encodeURIComponent(err.message || 'No se pudo iniciar el acceso social.');
      return res.redirect(`${base}/?social_error=${msg}`);
    }
  }

  /** El proveedor vuelve aquí con un código: se canjea, se abre la sesión y se redirige a la web. */
  @Public()
  @AuthThrottle()
  @Get('oauth/:provider/callback')
  @ApiOperation({ summary: 'Callback OAuth 2.0 de Facebook y GitHub' })
  async oauthCallback(
    @Param('provider') provider: string,
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') oauthError: string | undefined,
    @Ip() ip: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const base = this.config.publicBaseUrl(this.requestBase(req));
    res.clearCookie(OAUTH_NONCE_COOKIE, { path: '/' });
    if (oauthError || !code) {
      const msg = encodeURIComponent('Se canceló o no se pudo autorizar el acceso social.');
      return res.redirect(`${base}/?social_error=${msg}`);
    }

    try {
      const tokens = await this.authService.handleOAuthCallback(
        provider,
        code,
        state,
        this.oauthState.readCookie(req.headers.cookie, OAUTH_NONCE_COOKIE),
        ip,
        this.requestBase(req),
      );
      // Los tokens viajan en el fragmento (#): nunca llegan a servidores, proxies ni logs de acceso.
      const { refreshToken, ...session } = tokens;
      setRefreshCookie(res, refreshToken, this.config);
      const encodedSession = Buffer.from(JSON.stringify(session), 'utf8').toString('base64url');
      return res.redirect(`${base}/#social_session=${encodedSession}`);
    } catch (err: any) {
      const msg = encodeURIComponent(err.message || 'No pudimos completar el inicio de sesión social.');
      return res.redirect(`${base}/?social_error=${msg}`);
    }
  }

  /** Renueva la sesión con la cookie. Si falla, borra la cookie para no seguir reintentando. */
  @Public()
  @Post('refresh')
  @ApiOperation({ summary: 'Rotar Refresh Token y obtener nuevo par Access/Refresh con detección de reuso' })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response, @Ip() ip: string) {
    const refreshToken = this.oauthState.readCookie(req.headers.cookie, REFRESH_COOKIE);
    if (!refreshToken) throw new UnauthorizedException('No hay una sesión para renovar.');
    try {
      return await this.authService.refreshTokens({ refreshToken }, ip);
    } catch (err) {
      clearRefreshCookie(res, this.config);
      throw err;
    }
  }

  /** Cierra la sesión. Es pública para que funcione aunque el access token ya haya vencido. */
  @Public()
  @Post('logout')
  @ApiOperation({ summary: 'Cerrar sesión y revocar refresh tokens activos' })
  logout(@Req() req: Request, @Ip() ip: string, @Res({ passthrough: true }) res: Response) {
    clearRefreshCookie(res, this.config);
    return this.authService.logoutWithRefreshToken(this.oauthState.readCookie(req.headers.cookie, REFRESH_COOKIE), ip);
  }

  /** Devuelve los datos del usuario autenticado. */
  @ApiBearerAuth('jwt-auth')
  @Get('me')
  @ApiOperation({ summary: 'Obtener perfil y permisos del usuario autenticado' })
  me(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }

  /** Datos obligatorios que completa una sola vez quien se registró con un proveedor social. */
  @ApiBearerAuth('jwt-auth')
  @Post('me/complete-profile')
  @ApiOperation({ summary: 'Completar los datos básicos de una cuenta creada con Google, Facebook o GitHub' })
  completeProfile(@CurrentUser() user: AuthenticatedUser, @Body() dto: CompleteProfileDto) {
    return this.authService.completeProfile(user.sub, dto);
  }

  /** Edita el perfil propio desde Ajustes. */
  @ApiBearerAuth('jwt-auth')
  @Patch('me')
  @ApiOperation({ summary: 'Actualizar nombre y zona horaria del usuario autenticado' })
  updateMe(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateProfileDto) {
    return this.authService.updateProfile(user.sub, dto);
  }

  /** Cambia la contraseña desde Ajustes y renueva la sesión de este dispositivo. */
  @ApiBearerAuth('jwt-auth')
  @AuthThrottle()
  @Post('me/change-password')
  @ApiOperation({ summary: 'Cambiar la contraseña propia, o crearla si la cuenta entró solo con una red social' })
  changePassword(@CurrentUser() user: AuthenticatedUser, @Body() dto: ChangePasswordDto, @Ip() ip: string) {
    return this.authService.changePassword(user.sub, dto, ip);
  }

  /** Elimina la cuenta propia y borra la cookie de sesión. */
  @ApiBearerAuth('jwt-auth')
  @AuthThrottle()
  @Post('me/delete')
  @ApiOperation({ summary: 'Eliminar la propia cuenta. El administrador no puede hacerlo' })
  async deleteMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: DeleteAccountDto,
    @Ip() ip: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.accountDeletion.deleteOwnAccount(user, dto.password, ip);
    clearRefreshCookie(res, this.config);
    return result;
  }

  /** Envía un código para recuperar o crear la contraseña. */
  @Public()
  @AuthThrottle()
  @Post('forgot-password')
  @ApiOperation({ summary: 'Solicitar código de 6 dígitos por email (recuperar o crear contraseña)' })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  /** Comprueba el código antes de mostrar el campo de nueva contraseña. */
  @Public()
  @AuthThrottle()
  @Post('verify-otp')
  @ApiOperation({ summary: 'Comprobar identidad con código de 6 dígitos antes de habilitar el campo de contraseña' })
  verifyOtp(@Body() dto: VerifyOtpCodeDto) {
    return this.authService.verifyOtpCode(dto);
  }

  /** Guarda la nueva contraseña y abre una sesión. */
  @Public()
  @AuthThrottle()
  @Post('reset-password')
  @ApiOperation({ summary: 'Guardar nueva contraseña tras verificar el código de 6 dígitos' })
  resetPassword(@Body() dto: ResetPasswordDto, @Ip() ip: string) {
    return this.authService.resetPassword(dto, ip);
  }
}
