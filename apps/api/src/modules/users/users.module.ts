import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthIdentity } from './entities/auth-identity.entity';
import { User } from './entities/user.entity';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, AuthIdentity])],
  providers: [UsersRepository, UsersService],
  exports: [UsersService],
})
export class UsersModule {}
