import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuditService } from '../../common/audit/audit.service';
import { StorageModule } from '../storage/storage.module';
import { AccountDeletionService } from './account-deletion.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { SocialTokenVerifierService } from './social-token-verifier.service';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({}),
    StorageModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, AccountDeletionService, SocialTokenVerifierService, JwtStrategy, AuditService],
  exports: [AuthService, JwtModule, AuditService],
})
export class AuthModule {}
