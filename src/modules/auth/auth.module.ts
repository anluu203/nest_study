import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [
    UsersModule,
    JwtModule.registerAsync({
      global: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService): JwtModuleOptions => {
        const secret = config.get<string>('JWT_SECRET');
        if (!secret) {
          throw new Error('JWT_SECRET environment variable is required');
        }

        const configuredExpiration =
          config.get<string>('JWT_EXPIRATION')?.trim() || '1d';
        // jsonwebtoken treats a numeric string such as "60" as milliseconds.
        // Environment variables are always strings, so convert digit-only values
        // to numbers to make JWT_EXPIRATION=60 mean 60 seconds.
        const expiresIn = /^\d+$/.test(configuredExpiration)
          ? Number(configuredExpiration)
          : configuredExpiration;

        return {
          secret,
          signOptions: {
            expiresIn,
          } as JwtModuleOptions['signOptions'],
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
