import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuditService } from '../../common/audit/audit.service';
import { CryptoService } from '../../common/crypto/crypto.service';
import { StorageService } from '../storage/storage.service';
import { AccountDeletionService } from './account-deletion.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { SocialTokenVerifierService } from './social-token-verifier.service';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({}),
  ],
  controllers: [AuthController],
  providers: [AuthService, AccountDeletionService, StorageService, SocialTokenVerifierService, JwtStrategy, AuditService, CryptoService],
  exports: [AuthService, JwtModule, AuditService, CryptoService],
})
export class AuthModule {}
